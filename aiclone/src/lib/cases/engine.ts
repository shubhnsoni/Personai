import { PersistenceError } from "@/lib/persistence/errors"

import {
    CASE_TIMESTAMP_FIELD,
    CONVERTIBLE_INTAKE_STATUSES,
    caseFlow,
    intakeFlow,
    type CaseStatusValue,
    type IntakeStatusValue,
    type InvoiceStateValue,
} from "./lifecycle"
import type { CaseActor, CaseContext } from "./shared"

/** Intake and case-aggregate operations. Milestones and the rest live in workflow.ts. */

export type CaseRecord = Readonly<{
    id: string
    workspaceId: string
    locationId: string | null
    contactId: string | null
    intakeId: string | null
    reference: string
    title: string
    status: CaseStatusValue
    invoiceState: InvoiceStateValue
    openedAt: Date | null
    deliveredAt: Date | null
    closedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    createdAt: Date
    updatedAt: Date
    allowedTransitions: readonly CaseStatusValue[]
}>

type RawCase = {
    id: string
    workspaceId: string
    locationId: string | null
    contactId: string | null
    intakeId: string | null
    reference: string
    title: string
    status: string
    invoiceState: string
    openedAt: Date | null
    deliveredAt: Date | null
    closedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    createdAt: Date
    updatedAt: Date
}

export function toCaseRecord(row: RawCase): CaseRecord {
    const status = row.status as CaseStatusValue
    return Object.freeze({
        id: row.id,
        workspaceId: row.workspaceId,
        locationId: row.locationId,
        contactId: row.contactId,
        intakeId: row.intakeId,
        reference: row.reference,
        title: row.title,
        status,
        invoiceState: row.invoiceState as InvoiceStateValue,
        openedAt: row.openedAt,
        deliveredAt: row.deliveredAt,
        closedAt: row.closedAt,
        cancelledAt: row.cancelledAt,
        cancelReason: row.cancelReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        allowedTransitions: caseFlow.allowedFrom(status),
    })
}

export class CaseIntakeService {
    constructor(private readonly ctx: CaseContext) {}

    async create(
        workspaceId: string,
        input: Readonly<{ source: string; summary: string; contactId?: string | null; idempotencyKey?: string | null }>,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const source = this.ctx.required(input.source, "source")
        const summary = this.ctx.required(input.summary, "summary")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.caseIntake.findUnique({
                where: { workspaceId_idempotencyKey: { workspaceId: ws, idempotencyKey } },
            })
            if (existing) return { intake: existing, replayed: true }
        }

        const contactId = await this.ctx.assertContact(ws, input.contactId?.trim() || null)
        try {
            const intake = await this.ctx.db.caseIntake.create({
                data: { workspaceId: ws, source, summary, contactId, idempotencyKey, status: "NEW" },
            })
            return { intake, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "An intake with this idempotency key already exists")
        }
    }

    async list(workspaceId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const rows = await this.ctx.db.caseIntake.findMany({
            where: { workspaceId: ws },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        for (const r of rows) if (r.workspaceId !== ws) this.ctx.denied()
        return Object.freeze(rows)
    }

    async transition(workspaceId: string, intakeId: string, to: IntakeStatusValue, reason?: string | null) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(intakeId, "intakeId")

        return this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; workspaceId: string; status: IntakeStatusValue }>>(
                `select "id","workspaceId","status" from "CaseIntake" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.workspaceId !== ws) this.ctx.denied()
            if (!intakeFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} intake to ${to.toLowerCase()}`)
            }
            return tx.caseIntake.update({
                where: { id },
                data: { status: to, ...(to === "DECLINED" ? { declineReason: reason?.trim() || null } : {}) },
            })
        })
    }

    /**
     * Converts an ACCEPTED intake into a case inside one transaction, taking a row lock on
     * the intake first so two concurrent conversions cannot both produce a case.
     */
    async convert(
        workspaceId: string,
        intakeId: string,
        input: Readonly<{ reference: string; title: string; locationId?: string | null }>,
        actor: CaseActor,
    ): Promise<CaseRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(intakeId, "intakeId")
        const reference = this.ctx.required(input.reference, "reference")
        const title = this.ctx.required(input.title, "title")
        const locationId = await this.ctx.assertLocation(ws, input.locationId?.trim() || null)

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const rows = await tx.$queryRawUnsafe<
                    Array<{ id: string; workspaceId: string; status: IntakeStatusValue; contactId: string | null }>
                >(`select "id","workspaceId","status","contactId" from "CaseIntake" where "id" = $1 for update`, id)
                const intake = rows[0]
                if (!intake || intake.workspaceId !== ws) this.ctx.denied()
                if (!CONVERTIBLE_INTAKE_STATUSES.includes(intake.status)) {
                    this.ctx.conflict(
                        `Only an accepted intake can be converted; this one is ${intake.status.toLowerCase()}`,
                    )
                }
                const row = await tx.caseProject.create({
                    data: {
                        workspaceId: ws,
                        locationId,
                        contactId: intake.contactId,
                        intakeId: intake.id,
                        reference,
                        title,
                        status: "INTAKE",
                    },
                })
                await tx.caseIntake.update({ where: { id }, data: { status: "CONVERTED" } })
                await this.ctx.appendEvent(tx, row.id, "CREATED", null, "INTAKE", actor, { intakeId: id })
                return row
            })
            return toCaseRecord(created as RawCase)
        } catch (error) {
            this.ctx.rethrowUnique(error, "That case reference is already used in this workspace")
        }
    }
}

export class CaseProjectService {
    constructor(private readonly ctx: CaseContext) {}

    async create(
        workspaceId: string,
        input: Readonly<{
            reference: string
            title: string
            contactId?: string | null
            locationId?: string | null
            idempotencyKey?: string | null
        }>,
        actor: CaseActor,
    ): Promise<{ record: CaseRecord; replayed: boolean }> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const reference = this.ctx.required(input.reference, "reference")
        const title = this.ctx.required(input.title, "title")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.caseProject.findUnique({
                where: { workspaceId_idempotencyKey: { workspaceId: ws, idempotencyKey } },
            })
            if (existing) return { record: toCaseRecord(existing as RawCase), replayed: true }
        }

        const contactId = await this.ctx.assertContact(ws, input.contactId?.trim() || null)
        const locationId = await this.ctx.assertLocation(ws, input.locationId?.trim() || null)

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.caseProject.create({
                    data: { workspaceId: ws, reference, title, contactId, locationId, idempotencyKey, status: "INTAKE" },
                })
                await this.ctx.appendEvent(tx, row.id, "CREATED", null, "INTAKE", actor)
                return row
            })
            return { record: toCaseRecord(created as RawCase), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That case reference or idempotency key is already used")
        }
    }

    async list(workspaceId: string): Promise<readonly CaseRecord[]> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const rows = await this.ctx.db.caseProject.findMany({
            where: { workspaceId: ws },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        // Revalidate on the way out rather than trusting the query alone.
        for (const r of rows) if (r.workspaceId !== ws) this.ctx.denied()
        return Object.freeze(rows.map((r) => toCaseRecord(r as RawCase)))
    }

    async get(workspaceId: string, caseId: string): Promise<CaseRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        return toCaseRecord((await this.ctx.ownedCase(ws, caseId)) as RawCase)
    }

    async transition(
        workspaceId: string,
        caseId: string,
        to: CaseStatusValue,
        actor: CaseActor,
        reason?: string | null,
    ): Promise<CaseRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(caseId, "caseId")

        const updated = await this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; workspaceId: string; status: CaseStatusValue }>>(
                `select "id","workspaceId","status" from "CaseProject" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.workspaceId !== ws) this.ctx.denied()
            if (caseFlow.isTerminal(current.status)) {
                this.ctx.conflict(`This case is already ${current.status.toLowerCase()} and cannot change`)
            }
            if (!caseFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} case to ${to.toLowerCase()}`)
            }
            const stamp = CASE_TIMESTAMP_FIELD[to]
            const row = await tx.caseProject.update({
                where: { id },
                data: {
                    status: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason?.trim() || null } : {}),
                },
            })
            await this.ctx.appendEvent(tx, id, "STATUS", current.status, to, actor, reason ? { reason } : undefined)
            return row
        })
        return toCaseRecord(updated as RawCase)
    }

    /** Associates or clears the client Contact. The contact must be in the workspace. */
    async assignContact(
        workspaceId: string,
        caseId: string,
        contactId: string | null,
        actor: CaseActor,
    ): Promise<CaseRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const existing = await this.ctx.ownedCase(ws, caseId)
        const resolved = await this.ctx.assertContact(ws, contactId?.trim() || null)
        const updated = await this.ctx.db.$transaction(async (tx) => {
            const row = await tx.caseProject.update({ where: { id: existing.id }, data: { contactId: resolved } })
            await this.ctx.appendEvent(tx, existing.id, "NOTE", existing.contactId, resolved ?? "none", actor)
            return row
        })
        return toCaseRecord(updated as RawCase)
    }

    /** Creates or replaces the single brief for a case. */
    async upsertBrief(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ objectives: string; scope?: string | null; constraints?: string | null; agreed?: boolean }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const objectives = this.ctx.required(input.objectives, "objectives")

        return this.ctx.db.$transaction(async (tx) => {
            const brief = await tx.caseBrief.upsert({
                where: { caseId: owned.id },
                create: {
                    caseId: owned.id,
                    objectives,
                    scope: input.scope?.trim() || null,
                    constraints: input.constraints?.trim() || null,
                    agreedAt: input.agreed ? new Date() : null,
                },
                update: {
                    objectives,
                    scope: input.scope?.trim() || null,
                    constraints: input.constraints?.trim() || null,
                    ...(input.agreed ? { agreedAt: new Date() } : {}),
                },
            })
            await this.ctx.appendEvent(tx, owned.id, "NOTE", null, input.agreed ? "BRIEF_AGREED" : "BRIEF_UPDATED", actor)
            return brief
        })
    }

    async getBrief(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        return this.ctx.db.caseBrief.findUnique({ where: { caseId: owned.id } })
    }

    /** Append-only timeline, tenant-checked first. */
    async timeline(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const events = await this.ctx.db.caseEvent.findMany({
            where: { caseId: owned.id },
            orderBy: { seq: "asc" },
        })
        return Object.freeze(
            events.map((e) =>
                Object.freeze({
                    id: e.id,
                    seq: String(e.seq),
                    kind: e.kind,
                    from: e.from,
                    to: e.to,
                    actor: e.actor,
                    actorId: e.actorId,
                    at: e.at,
                }),
            ),
        )
    }
}

export { PersistenceError }
