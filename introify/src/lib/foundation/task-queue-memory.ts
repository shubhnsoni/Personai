/**
 * In-memory reference implementation of the TaskQueue contract.
 * No I/O, no timers — `lease`/`reapExpiredLeases` take an explicit `now`
 * (defaulting to `new Date()`) purely so tests can drive time deterministically.
 */

import {
    DEFAULT_BACKOFF,
    DEFAULT_LEASE_MS,
    DEFAULT_MAX_ATTEMPTS,
    type BackoffPolicy,
    type EnqueueInput,
    IllegalTaskTransitionError,
    type TaskQueue,
    type TaskRecord,
    computeBackoffMs,
} from "./task-queue"

let counter = 0
function nextId(): string {
    counter += 1
    return `task_${counter.toString(36)}`
}

let tokenCounter = 0
function nextLeaseToken(): string {
    tokenCounter += 1
    return `lease_${tokenCounter.toString(36)}`
}

export class InMemoryTaskQueue<TPayload = unknown> implements TaskQueue<TPayload> {
    private readonly tasks = new Map<string, TaskRecord<TPayload>>()
    private readonly idempotencyIndex = new Map<string, string>()

    constructor(private readonly backoff: BackoffPolicy = DEFAULT_BACKOFF) {}

    enqueue(input: EnqueueInput<TPayload>): TaskRecord<TPayload> {
        const key = input.idempotencyKey ?? null
        if (key) {
            const existingId = this.idempotencyIndex.get(key)
            if (existingId) {
                const existing = this.tasks.get(existingId)
                if (existing && existing.state !== "SUCCEEDED" && existing.state !== "DEAD_LETTERED") {
                    return existing
                }
            }
        }

        const now = new Date()
        const record: TaskRecord<TPayload> = {
            id: nextId(),
            idempotencyKey: key,
            payload: input.payload,
            state: "PENDING",
            attempts: 0,
            maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            nextAttemptAt: new Date(now.getTime() + (input.delayMs ?? 0)),
            leaseExpiresAt: null,
            leaseToken: null,
            lastError: null,
            createdAt: now,
            updatedAt: now,
        }
        this.tasks.set(record.id, record)
        if (key) this.idempotencyIndex.set(key, record.id)
        return record
    }

    lease(limit: number, leaseMs: number = DEFAULT_LEASE_MS, now: Date = new Date()): TaskRecord<TPayload>[] {
        const leased: TaskRecord<TPayload>[] = []
        for (const task of this.tasks.values()) {
            if (leased.length >= limit) break
            if (task.state !== "PENDING") continue
            if (task.nextAttemptAt.getTime() > now.getTime()) continue
            task.state = "LEASED"
            task.leaseToken = nextLeaseToken()
            task.leaseExpiresAt = new Date(now.getTime() + leaseMs)
            task.attempts += 1
            task.updatedAt = now
            leased.push(task)
        }
        return leased
    }

    complete(taskId: string, leaseToken: string): TaskRecord<TPayload> {
        const task = this.requireTask(taskId)
        if (task.state !== "LEASED") throw new IllegalTaskTransitionError(taskId, task.state, "complete")
        this.requireValidLease(task, leaseToken)
        task.state = "SUCCEEDED"
        task.leaseToken = null
        task.leaseExpiresAt = null
        task.updatedAt = new Date()
        return task
    }

    fail(taskId: string, leaseToken: string, error: string): TaskRecord<TPayload> {
        const task = this.requireTask(taskId)
        if (task.state !== "LEASED") throw new IllegalTaskTransitionError(taskId, task.state, "fail")
        this.requireValidLease(task, leaseToken)
        const now = new Date()
        task.lastError = error
        task.leaseToken = null
        task.leaseExpiresAt = null
        task.updatedAt = now
        if (task.attempts >= task.maxAttempts) {
            task.state = "DEAD_LETTERED"
        } else {
            task.state = "PENDING"
            task.nextAttemptAt = new Date(now.getTime() + computeBackoffMs(task.attempts, this.backoff))
        }
        return task
    }

    get(taskId: string): TaskRecord<TPayload> | undefined {
        return this.tasks.get(taskId)
    }

    reapExpiredLeases(now: Date = new Date()): TaskRecord<TPayload>[] {
        const reaped: TaskRecord<TPayload>[] = []
        for (const task of this.tasks.values()) {
            if (task.state !== "LEASED") continue
            if (!task.leaseExpiresAt || task.leaseExpiresAt.getTime() > now.getTime()) continue
            task.state = "PENDING"
            task.leaseToken = null
            task.leaseExpiresAt = null
            // Expiry is not a failure: the attempt already counted in lease() stands,
            // but no backoff or dead-letter accounting applies here.
            task.nextAttemptAt = now
            task.updatedAt = now
            reaped.push(task)
        }
        return reaped
    }

    private requireTask(taskId: string): TaskRecord<TPayload> {
        const task = this.tasks.get(taskId)
        if (!task) throw new Error(`Unknown task: ${taskId}`)
        return task
    }

    private requireValidLease(task: TaskRecord<TPayload>, leaseToken: string): void {
        if (task.leaseToken !== leaseToken) {
            throw new IllegalTaskTransitionError(task.id, task.state, `complete/fail with stale lease token`)
        }
    }
}
