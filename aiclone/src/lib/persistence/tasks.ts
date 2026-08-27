import { randomUUID } from "node:crypto"

import { Prisma, type PrismaClient, type TaskJob } from "@prisma/client"

import {
    DEFAULT_BACKOFF,
    DEFAULT_LEASE_MS,
    DEFAULT_MAX_ATTEMPTS,
    IllegalTaskTransitionError,
    computeBackoffMs,
    type BackoffPolicy,
    type EnqueueInput,
    type TaskRecord,
} from "@/lib/foundation"

import { PersistenceError } from "./errors"

const ENVELOPE_VERSION = 1
const TERMINAL_STATES = new Set(["SUCCEEDED", "DEAD_LETTERED"])

export type PersistedTaskEnvelope<TPayload> = Readonly<{
    version: typeof ENVELOPE_VERSION
    workspaceId: string
    idempotencyKey: string | null
    payload: TPayload
}>

function storageIdempotencyKey(workspaceId: string, key: string): string {
    return `workspace:${workspaceId}:${key}`
}

function parseEnvelope<TPayload>(value: string): PersistedTaskEnvelope<TPayload> {
    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        throw new PersistenceError("DEPENDENCY_UNAVAILABLE", "Stored task payload is invalid")
    }
    if (!parsed || typeof parsed !== "object") {
        throw new PersistenceError("DEPENDENCY_UNAVAILABLE", "Stored task payload is invalid")
    }
    const candidate = parsed as Partial<PersistedTaskEnvelope<TPayload>>
    if (candidate.version !== ENVELOPE_VERSION || typeof candidate.workspaceId !== "string") {
        throw new PersistenceError("DEPENDENCY_UNAVAILABLE", "Stored task envelope is unsupported")
    }
    return Object.freeze({
        version: ENVELOPE_VERSION,
        workspaceId: candidate.workspaceId,
        idempotencyKey: typeof candidate.idempotencyKey === "string" ? candidate.idempotencyKey : null,
        payload: candidate.payload as TPayload,
    })
}

function toTaskRecord<TPayload>(row: TaskJob): TaskRecord<TPayload> {
    const envelope = parseEnvelope<TPayload>(row.payload)
    return {
        id: row.id,
        idempotencyKey: envelope.idempotencyKey,
        payload: envelope.payload,
        state: row.state as TaskRecord<TPayload>["state"],
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
        nextAttemptAt: row.nextAttemptAt,
        leaseExpiresAt: row.leaseExpiresAt,
        leaseToken: row.leaseToken,
        lastError: row.lastError,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

export class PersistedTaskQueue<TPayload = unknown> {
    constructor(
        private readonly db: PrismaClient,
        private readonly backoff: BackoffPolicy = DEFAULT_BACKOFF,
    ) {}

    async enqueue(workspaceId: string, input: EnqueueInput<TPayload>): Promise<TaskRecord<TPayload>> {
        const idempotencyKey = input.idempotencyKey?.trim() || null
        const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
        const delayMs = input.delayMs ?? 0
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
            throw new PersistenceError("BAD_REQUEST", "maxAttempts must be a positive integer")
        }
        if (!Number.isInteger(delayMs) || delayMs < 0) {
            throw new PersistenceError("BAD_REQUEST", "delayMs must be a non-negative integer")
        }

        const storedKey = idempotencyKey ? storageIdempotencyKey(workspaceId, idempotencyKey) : null
        const envelope: PersistedTaskEnvelope<TPayload> = Object.freeze({
            version: ENVELOPE_VERSION,
            workspaceId,
            idempotencyKey,
            payload: input.payload,
        })

        try {
            return await this.db.$transaction(async (tx) => {
                if (storedKey) {
                    const existing = await tx.taskJob.findUnique({ where: { idempotencyKey: storedKey } })
                    if (existing && !TERMINAL_STATES.has(existing.state)) {
                        this.requireWorkspace(existing, workspaceId)
                        return toTaskRecord<TPayload>(existing)
                    }
                    if (existing) {
                        await tx.taskJob.update({ where: { id: existing.id }, data: { idempotencyKey: null } })
                    }
                }

                const now = new Date()
                const created = await tx.taskJob.create({
                    data: {
                        idempotencyKey: storedKey,
                        payload: JSON.stringify(envelope),
                        state: "PENDING",
                        attempts: 0,
                        maxAttempts,
                        nextAttemptAt: new Date(now.getTime() + delayMs),
                    },
                })
                return toTaskRecord<TPayload>(created)
            })
        } catch (error) {
            if (storedKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const winner = await this.db.taskJob.findUnique({ where: { idempotencyKey: storedKey } })
                if (winner && !TERMINAL_STATES.has(winner.state)) {
                    this.requireWorkspace(winner, workspaceId)
                    return toTaskRecord<TPayload>(winner)
                }
            }
            throw error
        }
    }

    async lease(
        workspaceId: string,
        limit: number,
        leaseMs: number = DEFAULT_LEASE_MS,
        now: Date = new Date(),
    ): Promise<readonly TaskRecord<TPayload>[]> {
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw new PersistenceError("BAD_REQUEST", "limit must be an integer from 1 to 100")
        }
        if (!Number.isInteger(leaseMs) || leaseMs < 1) {
            throw new PersistenceError("BAD_REQUEST", "leaseMs must be a positive integer")
        }

        await this.reapExpiredLeases(workspaceId, now)
        const candidates = await this.db.taskJob.findMany({
            where: { state: "PENDING", nextAttemptAt: { lte: now } },
            orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
            take: Math.max(100, limit * 10),
        })
        const leased: TaskRecord<TPayload>[] = []
        for (const candidate of candidates) {
            if (leased.length >= limit) break
            let envelope: PersistedTaskEnvelope<TPayload>
            try {
                envelope = parseEnvelope<TPayload>(candidate.payload)
            } catch {
                continue
            }
            if (envelope.workspaceId !== workspaceId) continue

            const leaseToken = randomUUID()
            const claimed = await this.db.taskJob.updateMany({
                where: { id: candidate.id, state: "PENDING", nextAttemptAt: { lte: now } },
                data: {
                    state: "LEASED",
                    leaseToken,
                    leaseExpiresAt: new Date(now.getTime() + leaseMs),
                    attempts: { increment: 1 },
                },
            })
            if (claimed.count !== 1) continue
            const row = await this.db.taskJob.findUnique({ where: { id: candidate.id } })
            if (row) leased.push(toTaskRecord<TPayload>(row))
        }
        return Object.freeze(leased)
    }

    async complete(workspaceId: string, taskId: string, leaseToken: string): Promise<TaskRecord<TPayload>> {
        return this.db.$transaction(async (tx) => {
            const task = await this.requireTask(tx, workspaceId, taskId)
            this.requireLease(task, leaseToken, "complete")
            const updated = await tx.taskJob.update({
                where: { id: taskId },
                data: { state: "SUCCEEDED", leaseToken: null, leaseExpiresAt: null, idempotencyKey: null },
            })
            return toTaskRecord<TPayload>(updated)
        })
    }

    async fail(workspaceId: string, taskId: string, leaseToken: string, error: string): Promise<TaskRecord<TPayload>> {
        return this.db.$transaction(async (tx) => {
            const task = await this.requireTask(tx, workspaceId, taskId)
            this.requireLease(task, leaseToken, "fail")
            const now = new Date()
            const terminal = task.attempts >= task.maxAttempts
            const updated = await tx.taskJob.update({
                where: { id: taskId },
                data: {
                    state: terminal ? "DEAD_LETTERED" : "PENDING",
                    leaseToken: null,
                    leaseExpiresAt: null,
                    lastError: error,
                    idempotencyKey: terminal ? null : task.idempotencyKey,
                    ...(!terminal ? { nextAttemptAt: new Date(now.getTime() + computeBackoffMs(task.attempts, this.backoff)) } : {}),
                },
            })
            return toTaskRecord<TPayload>(updated)
        })
    }

    async get(workspaceId: string, taskId: string): Promise<TaskRecord<TPayload> | undefined> {
        const task = await this.db.taskJob.findUnique({ where: { id: taskId } })
        if (!task) return undefined
        this.requireWorkspace(task, workspaceId)
        return toTaskRecord<TPayload>(task)
    }

    async reapExpiredLeases(workspaceId: string, now: Date = new Date()): Promise<readonly TaskRecord<TPayload>[]> {
        const expired = await this.db.taskJob.findMany({
            where: { state: "LEASED", leaseExpiresAt: { lte: now } },
            orderBy: [{ leaseExpiresAt: "asc" }, { id: "asc" }],
            take: 500,
        })
        const reaped: TaskRecord<TPayload>[] = []
        for (const task of expired) {
            let envelope: PersistedTaskEnvelope<TPayload>
            try {
                envelope = parseEnvelope<TPayload>(task.payload)
            } catch {
                continue
            }
            if (envelope.workspaceId !== workspaceId) continue
            const result = await this.db.taskJob.updateMany({
                where: { id: task.id, state: "LEASED", leaseExpiresAt: { lte: now } },
                data: { state: "PENDING", leaseToken: null, leaseExpiresAt: null, nextAttemptAt: now },
            })
            if (result.count === 1) {
                const updated = await this.db.taskJob.findUnique({ where: { id: task.id } })
                if (updated) reaped.push(toTaskRecord<TPayload>(updated))
            }
        }
        return Object.freeze(reaped)
    }

    private async requireTask(
        tx: Prisma.TransactionClient,
        workspaceId: string,
        taskId: string,
    ): Promise<TaskJob> {
        const task = await tx.taskJob.findUnique({ where: { id: taskId } })
        if (!task) throw new PersistenceError("NOT_FOUND", "Task not found")
        this.requireWorkspace(task, workspaceId)
        return task
    }

    private requireWorkspace(task: TaskJob, workspaceId: string): void {
        const envelope = parseEnvelope<TPayload>(task.payload)
        if (envelope.workspaceId !== workspaceId) {
            // Deliberately hide existence across tenant boundaries.
            throw new PersistenceError("NOT_FOUND", "Task not found")
        }
    }

    private requireLease(task: TaskJob, leaseToken: string, action: "complete" | "fail"): void {
        if (task.state !== "LEASED" || !leaseToken || task.leaseToken !== leaseToken) {
            throw new IllegalTaskTransitionError(task.id, task.state as TaskRecord<TPayload>["state"], action)
        }
    }
}
