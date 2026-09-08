/**
 * Retainer runtime for cases and projects (Wave G3).
 *
 * Composes CaseContext rather than introducing a second tenancy or refusal path: the same
 * requireWorkspace / ownedCase / denied / conflict / rethrowUnique used by every other cases
 * service. That is deliberate - a retainer is not a new subsystem, it is a way of paying for the
 * work the cases engine already tracks.
 *
 * NOTHING HERE EXECUTES A PAYMENT. `setBilling` moves a period through the existing
 * CaseInvoiceState vocabulary and may record the id of a CaseInvoice row, and that is the whole
 * of its involvement with money. No Payment row is created, updated or read.
 *
 * THE BALANCE IS DERIVED, NOT ASSERTED. `usedUnits` / `usedValueCents` on a period are maintained
 * inside the same transaction as the draw that moved them, and every draw stores the balance it
 * produced, so replaying the ledger must reproduce the period. `balance()` recomputes remaining
 * and overage on read rather than storing them, because a stored derived figure is a second
 * number that has to agree with the first.
 *
 * OVERAGE IS REPORTED, NOT PREVENTED. A draw that takes used past included is accepted and the
 * overage is surfaced. Refusing it would misrepresent work that was actually done, and an owner
 * who cannot see overage cannot bill for it.
 */
import type { PrismaClient } from "@prisma/client"

import {
    CONSUMING_DRAW_KINDS,
    DRAWABLE_RETAINER_STATES,
    RENEWING_PERIOD_STATES,
    RETAINER_PERIOD_DAYS,
    RETAINER_PERIOD_TIMESTAMP_FIELD,
    RETAINER_TIMESTAMP_FIELD,
    invoiceFlow,
    retainerFlow,
    retainerPeriodFlow,
    type InvoiceStateValue,
    type RetainerBasisValue,
    type RetainerDrawKindValue,
    type RetainerPeriodKindValue,
    type RetainerPeriodStateValue,
    type RetainerStateValue,
} from "./lifecycle"
import type { CaseActor, CaseContext } from "./shared"

type RawRetainer = {
    id: string
    workspaceId: string
    contactId: string | null
    reference: string
    title: string
    state: RetainerStateValue
    basis: RetainerBasisValue
    includedUnits: number | null
    includedValueCents: number | null
    currency: string
    periodKind: RetainerPeriodKindValue
    periodDays: number | null
    rolloverAllowed: boolean
    autoRenew: boolean
    activatedAt: Date | null
    pausedAt: Date | null
    expiredAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    createdAt: Date
    updatedAt: Date
}

export type RetainerRecord = Readonly<
    RawRetainer & {
        allowedTransitions: readonly RetainerStateValue[]
        /** Length of one period in days. Null only for a CUSTOM retainer with no length yet. */
        periodLengthDays: number | null
    }
>

export function toRetainerRecord(row: RawRetainer): RetainerRecord {
    return Object.freeze({
        ...row,
        allowedTransitions: retainerFlow.allowedFrom(row.state),
        periodLengthDays: row.periodKind === "CUSTOM" ? row.periodDays : (RETAINER_PERIOD_DAYS[row.periodKind] ?? null),
    })
}

type RawPeriod = {
    id: string
    retainerId: string
    ordinal: number
    startsOn: Date
    endsOn: Date
    includedUnits: number | null
    includedValueCents: number | null
    usedUnits: number
    usedValueCents: number
    state: RetainerPeriodStateValue
    billingState: InvoiceStateValue
    invoiceId: string | null
    closedAt: Date | null
    renewedAt: Date | null
    lapsedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export type PeriodRecord = Readonly<
    RawPeriod & {
        allowedTransitions: readonly RetainerPeriodStateValue[]
        allowedBillingTransitions: readonly InvoiceStateValue[]
        /** Derived on read. Negative remaining is impossible; overage carries the excess. */
        remaining: number
        overage: number
        basis: RetainerBasisValue
    }
>

export function toPeriodRecord(row: RawPeriod): PeriodRecord {
    const basis: RetainerBasisValue = row.includedUnits !== null ? "UNITS" : "VALUE"
    const included = basis === "UNITS" ? (row.includedUnits ?? 0) : (row.includedValueCents ?? 0)
    const used = basis === "UNITS" ? row.usedUnits : row.usedValueCents
    return Object.freeze({
        ...row,
        basis,
        allowedTransitions: retainerPeriodFlow.allowedFrom(row.state),
        allowedBillingTransitions: invoiceFlow.allowedFrom(row.billingState),
        remaining: Math.max(0, included - used),
        overage: Math.max(0, used - included),
    })
}

export type DrawRecord = Readonly<{
    id: string
    retainerId: string
    periodId: string
    caseId: string | null
    seq: string
    kind: RetainerDrawKindValue
    unitsDelta: number | null
    valueDeltaCents: number | null
    usedUnitsAfter: number
    usedValueCentsAfter: number
    note: string | null
    actor: string
    actorId: string | null
    at: Date
}>

export type RetainerBalance = Readonly<{
    retainerId: string
    basis: RetainerBasisValue
    currency: string
    openPeriod: PeriodRecord | null
    /** Totals across every period, so a closed period's consumption is not forgotten. */
    lifetimeUsed: number
    lifetimeIncluded: number
    lifetimeOverage: number
    periodCount: number
}>

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

const RETAINER_SELECT = {
    id: true,
    workspaceId: true,
    contactId: true,
    reference: true,
    title: true,
    state: true,
    basis: true,
    includedUnits: true,
    includedValueCents: true,
    currency: true,
    periodKind: true,
    periodDays: true,
    rolloverAllowed: true,
    autoRenew: true,
    activatedAt: true,
    pausedAt: true,
    expiredAt: true,
    cancelledAt: true,
    cancelReason: true,
    createdAt: true,
    updatedAt: true,
} as const

export class CaseRetainerService {
    constructor(private readonly ctx: CaseContext) {}

    // -----------------------------------------------------------------------
    // The agreement
    // -----------------------------------------------------------------------

    /**
     * Creates a retainer. Idempotent on (workspaceId, idempotencyKey), checked before any work is
     * done and backed by a unique index so a lost race becomes a conflict rather than a duplicate
     * agreement.
     */
    async create(
        workspaceId: string,
        input: Readonly<{
            reference: string
            title: string
            basis: RetainerBasisValue
            includedUnits?: number | null
            includedValueCents?: number | null
            currency?: string | null
            periodKind?: RetainerPeriodKindValue | null
            periodDays?: number | null
            rolloverAllowed?: boolean
            autoRenew?: boolean
            contactId?: string | null
            idempotencyKey?: string | null
        }>,
        actor: CaseActor,
    ): Promise<{ record: RetainerRecord; replayed: boolean }> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const reference = this.ctx.required(input.reference, "reference")
        const title = this.ctx.required(input.title, "title")
        const key = input.idempotencyKey?.trim() || null
        const periodKind: RetainerPeriodKindValue = input.periodKind ?? "MONTHLY"
        const contactId = await this.ctx.assertContact(ws, input.contactId?.trim() || null)

        // The database enforces the basis rule too, but a 409 that names the problem is more use
        // to a caller than a constraint violation.
        if (input.basis === "UNITS") {
            const units = input.includedUnits
            if (typeof units !== "number" || !Number.isInteger(units) || units <= 0) {
                this.ctx.conflict("A unit-denominated retainer needs includedUnits as a positive integer")
            }
            if (input.includedValueCents != null) {
                this.ctx.conflict("A unit-denominated retainer cannot also carry includedValueCents")
            }
        } else {
            const value = input.includedValueCents
            if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
                this.ctx.conflict("A value-denominated retainer needs includedValueCents as a positive integer")
            }
            if (input.includedUnits != null) {
                this.ctx.conflict("A value-denominated retainer cannot also carry includedUnits")
            }
        }
        if (periodKind === "CUSTOM") {
            const days = input.periodDays
            if (typeof days !== "number" || !Number.isInteger(days) || days <= 0) {
                this.ctx.conflict("A CUSTOM period needs periodDays as a positive integer")
            }
        } else if (input.periodDays != null) {
            this.ctx.conflict(`A ${periodKind} retainer must not carry periodDays; its length is implied`)
        }

        if (key) {
            const existing = await this.ctx.db.caseRetainer.findUnique({
                where: { workspaceId_idempotencyKey: { workspaceId: ws, idempotencyKey: key } },
                select: RETAINER_SELECT,
            })
            if (existing) return { record: toRetainerRecord(existing as RawRetainer), replayed: true }
        }

        try {
            const row = await this.ctx.db.$transaction(async (tx) => {
                const created = await tx.caseRetainer.create({
                    data: {
                        workspaceId: ws,
                        contactId,
                        reference,
                        title,
                        basis: input.basis,
                        includedUnits: input.basis === "UNITS" ? input.includedUnits! : null,
                        includedValueCents: input.basis === "VALUE" ? input.includedValueCents! : null,
                        currency: input.currency?.trim() || "USD",
                        periodKind,
                        periodDays: periodKind === "CUSTOM" ? input.periodDays! : null,
                        rolloverAllowed: input.rolloverAllowed ?? false,
                        autoRenew: input.autoRenew ?? false,
                        ...(key ? { idempotencyKey: key } : {}),
                    },
                    select: RETAINER_SELECT,
                })
                await this.event(tx, created.id, "agreement", created.id, null, "DRAFT", actor, {
                    reference,
                    basis: input.basis,
                })
                return created
            })
            return { record: toRetainerRecord(row as RawRetainer), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "A retainer with that reference or idempotency key already exists")
        }
    }

    async list(workspaceId: string): Promise<readonly RetainerRecord[]> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const rows = await this.ctx.db.caseRetainer.findMany({
            where: { workspaceId: ws },
            orderBy: { createdAt: "desc" },
            select: RETAINER_SELECT,
        })
        // Re-validated on the way out, the same belt-and-braces the cases engine already uses.
        for (const row of rows) if (row.workspaceId !== ws) this.ctx.denied()
        return Object.freeze(rows.map((r) => toRetainerRecord(r as RawRetainer)))
    }

    async get(workspaceId: string, retainerId: string): Promise<RetainerRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const row = await this.owned(ws, retainerId)
        return toRetainerRecord(row)
    }

    async transition(
        workspaceId: string,
        retainerId: string,
        to: RetainerStateValue,
        actor: CaseActor,
        reason?: string | null,
    ): Promise<RetainerRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(retainerId, "retainerId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockRetainer(tx, id, ws)
            if (retainerFlow.isTerminal(current.state)) {
                this.ctx.conflict(`This retainer is already ${current.state.toLowerCase()} and cannot change`)
            }
            if (!retainerFlow.can(current.state, to)) {
                this.ctx.conflict(`Cannot move a ${current.state.toLowerCase()} retainer to ${to.toLowerCase()}`)
            }
            const stamp = RETAINER_TIMESTAMP_FIELD[to]
            const updated = await tx.caseRetainer.update({
                where: { id },
                data: {
                    state: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason?.trim() || null } : {}),
                },
                select: RETAINER_SELECT,
            })
            await this.event(tx, id, "agreement", id, current.state, to, actor, reason ? { reason } : undefined)
            return updated
        })
        return toRetainerRecord(row as RawRetainer)
    }

    // -----------------------------------------------------------------------
    // Case association
    // -----------------------------------------------------------------------

    /**
     * Links a case so work on it may draw against the retainer. `ownedCase` proves the case is in
     * the caller's workspace; a database trigger proves it independently, because the engine is
     * not the only possible writer.
     */
    async linkCase(workspaceId: string, retainerId: string, caseId: string, actor: CaseActor): Promise<{ linked: boolean }> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const retainer = await this.owned(ws, retainerId)
        const owned = await this.ctx.ownedCase(ws, caseId)

        const existing = await this.ctx.db.caseRetainerCaseLink.findUnique({
            where: { retainerId_caseId: { retainerId: retainer.id, caseId: owned.id } },
        })
        if (existing) return { linked: false }

        await this.ctx.db.$transaction(async (tx) => {
            await tx.caseRetainerCaseLink.create({ data: { retainerId: retainer.id, caseId: owned.id } })
            await this.event(tx, retainer.id, "caseLink", owned.id, null, "LINKED", actor, { caseId: owned.id })
            // The case timeline is where a reader looks for what happened to a case, so the link
            // is recorded there too. The retainer stream remains the complete one.
            await this.ctx.appendEvent(tx, owned.id, "RETAINER", null, "LINKED", actor, {
                retainerId: retainer.id,
                reference: retainer.reference,
            })
        })
        return { linked: true }
    }

    /**
     * Unlinks a case. Refused once the case has drawn against the retainer: the ledger rows name
     * that case, and removing the link would leave history referring to a coverage that the
     * records now deny ever existed.
     */
    async unlinkCase(workspaceId: string, retainerId: string, caseId: string, actor: CaseActor): Promise<{ unlinked: boolean }> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const retainer = await this.owned(ws, retainerId)
        const owned = await this.ctx.ownedCase(ws, caseId)

        const draws = await this.ctx.db.caseRetainerDraw.count({
            where: { retainerId: retainer.id, caseId: owned.id },
        })
        if (draws > 0) {
            this.ctx.conflict(
                `This case has ${draws} draw${draws === 1 ? "" : "s"} against the retainer, so the link cannot be removed`,
            )
        }
        const existing = await this.ctx.db.caseRetainerCaseLink.findUnique({
            where: { retainerId_caseId: { retainerId: retainer.id, caseId: owned.id } },
        })
        if (!existing) return { unlinked: false }

        await this.ctx.db.$transaction(async (tx) => {
            await tx.caseRetainerCaseLink.delete({
                where: { retainerId_caseId: { retainerId: retainer.id, caseId: owned.id } },
            })
            await this.event(tx, retainer.id, "caseLink", owned.id, "LINKED", "UNLINKED", actor, { caseId: owned.id })
        })
        return { unlinked: true }
    }

    async listCases(workspaceId: string, retainerId: string): Promise<readonly Readonly<{ caseId: string; reference: string; title: string; status: string; linkedAt: Date }>[]> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const retainer = await this.owned(ws, retainerId)
        const rows = await this.ctx.db.caseRetainerCaseLink.findMany({
            where: { retainerId: retainer.id },
            orderBy: { createdAt: "asc" },
            select: {
                caseId: true,
                createdAt: true,
                case: { select: { reference: true, title: true, status: true, workspaceId: true } },
            },
        })
        for (const row of rows) if (row.case.workspaceId !== ws) this.ctx.denied()
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    caseId: r.caseId,
                    reference: r.case.reference,
                    title: r.case.title,
                    status: r.case.status as string,
                    linkedAt: r.createdAt,
                }),
            ),
        )
    }

    // -----------------------------------------------------------------------
    // Periods
    // -----------------------------------------------------------------------

    /**
     * Opens the next period. The allowance is copied from the agreement AT THIS MOMENT, so a later
     * amendment cannot rewrite what this period included. Rollover adds the unused remainder of
     * the previous period when the agreement allows it.
     */
    async openPeriod(
        workspaceId: string,
        retainerId: string,
        input: Readonly<{ startsOn?: Date | null }>,
        actor: CaseActor,
    ): Promise<PeriodRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(retainerId, "retainerId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockRetainer(tx, id, ws)
            if (!DRAWABLE_RETAINER_STATES.includes(current.state)) {
                this.ctx.conflict(`A ${current.state.toLowerCase()} retainer cannot open a period`)
            }
            const open = await tx.caseRetainerPeriod.findFirst({
                where: { retainerId: id, state: "OPEN" },
                select: { id: true, ordinal: true },
            })
            if (open) {
                this.ctx.conflict(`Period ${open.ordinal} is still open; close or renew it before opening another`)
            }
            const agreement = await tx.caseRetainer.findUniqueOrThrow({ where: { id }, select: RETAINER_SELECT })
            const last = await tx.caseRetainerPeriod.findFirst({
                where: { retainerId: id },
                orderBy: { ordinal: "desc" },
                select: {
                    ordinal: true,
                    endsOn: true,
                    includedUnits: true,
                    includedValueCents: true,
                    usedUnits: true,
                    usedValueCents: true,
                },
            })
            const lengthDays =
                agreement.periodKind === "CUSTOM"
                    ? agreement.periodDays
                    : (RETAINER_PERIOD_DAYS[agreement.periodKind as RetainerPeriodKindValue] ?? null)
            if (lengthDays == null) this.ctx.conflict("This retainer has no period length, so a period cannot be dated")

            const startsOn = input.startsOn ?? last?.endsOn ?? new Date()
            const endsOn = new Date(startsOn.getTime() + lengthDays * 24 * 60 * 60 * 1000)

            let includedUnits = agreement.includedUnits
            let includedValueCents = agreement.includedValueCents
            if (agreement.rolloverAllowed && last) {
                if (agreement.basis === "UNITS" && includedUnits != null) {
                    includedUnits += Math.max(0, (last.includedUnits ?? 0) - last.usedUnits)
                }
                if (agreement.basis === "VALUE" && includedValueCents != null) {
                    includedValueCents += Math.max(0, (last.includedValueCents ?? 0) - last.usedValueCents)
                }
            }

            const created = await tx.caseRetainerPeriod.create({
                data: {
                    retainerId: id,
                    ordinal: (last?.ordinal ?? 0) + 1,
                    startsOn,
                    endsOn,
                    includedUnits: agreement.basis === "UNITS" ? includedUnits : null,
                    includedValueCents: agreement.basis === "VALUE" ? includedValueCents : null,
                    state: "OPEN",
                },
            })
            await this.event(tx, id, "period", created.id, null, "OPEN", actor, {
                ordinal: created.ordinal,
                rolledOver: agreement.rolloverAllowed && Boolean(last),
            })
            return created
        })
        return toPeriodRecord(row as RawPeriod)
    }

    async listPeriods(workspaceId: string, retainerId: string): Promise<readonly PeriodRecord[]> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const retainer = await this.owned(ws, retainerId)
        const rows = await this.ctx.db.caseRetainerPeriod.findMany({
            where: { retainerId: retainer.id },
            orderBy: { ordinal: "asc" },
        })
        return Object.freeze(rows.map((r) => toPeriodRecord(r as RawPeriod)))
    }

    /**
     * Ends a period. RENEWED is the only outcome that produces the next one, and it does so in the
     * same transaction, so a renewal cannot half-happen.
     */
    async transitionPeriod(
        workspaceId: string,
        retainerId: string,
        periodId: string,
        to: RetainerPeriodStateValue,
        actor: CaseActor,
    ): Promise<{ period: PeriodRecord; next: PeriodRecord | null }> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(retainerId, "retainerId")
        const pid = this.ctx.required(periodId, "periodId")

        const out = await this.ctx.db.$transaction(async (tx) => {
            const retainer = await this.lockRetainer(tx, id, ws)
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; retainerId: string; state: RetainerPeriodStateValue; ordinal: number; endsOn: Date }>>(
                `select "id","retainerId","state","ordinal","endsOn" from "CaseRetainerPeriod" where "id" = $1 for update`,
                pid,
            )
            const current = rows[0]
            if (!current || current.retainerId !== id) this.ctx.denied()
            if (retainerPeriodFlow.isTerminal(current.state)) {
                this.ctx.conflict(`Period ${current.ordinal} is already ${current.state.toLowerCase()} and cannot change`)
            }
            if (!retainerPeriodFlow.can(current.state, to)) {
                this.ctx.conflict(`Cannot move an ${current.state.toLowerCase()} period to ${to.toLowerCase()}`)
            }
            if (RENEWING_PERIOD_STATES.includes(to) && !DRAWABLE_RETAINER_STATES.includes(retainer.state)) {
                this.ctx.conflict(`A ${retainer.state.toLowerCase()} retainer cannot be renewed`)
            }

            const stamp = RETAINER_PERIOD_TIMESTAMP_FIELD[to]
            const closed = await tx.caseRetainerPeriod.update({
                where: { id: pid },
                data: { state: to, ...(stamp ? { [stamp]: new Date() } : {}) },
            })
            await this.event(tx, id, "period", pid, current.state, to, actor, { ordinal: current.ordinal })

            let next: RawPeriod | null = null
            if (RENEWING_PERIOD_STATES.includes(to)) {
                const agreement = await tx.caseRetainer.findUniqueOrThrow({ where: { id }, select: RETAINER_SELECT })
                const lengthDays =
                    agreement.periodKind === "CUSTOM"
                        ? agreement.periodDays
                        : (RETAINER_PERIOD_DAYS[agreement.periodKind as RetainerPeriodKindValue] ?? null)
                if (lengthDays == null) this.ctx.conflict("This retainer has no period length, so it cannot be renewed")
                let includedUnits = agreement.includedUnits
                let includedValueCents = agreement.includedValueCents
                if (agreement.rolloverAllowed) {
                    if (agreement.basis === "UNITS" && includedUnits != null) {
                        includedUnits += Math.max(0, (closed.includedUnits ?? 0) - closed.usedUnits)
                    }
                    if (agreement.basis === "VALUE" && includedValueCents != null) {
                        includedValueCents += Math.max(0, (closed.includedValueCents ?? 0) - closed.usedValueCents)
                    }
                }
                next = (await tx.caseRetainerPeriod.create({
                    data: {
                        retainerId: id,
                        ordinal: current.ordinal + 1,
                        startsOn: current.endsOn,
                        endsOn: new Date(current.endsOn.getTime() + lengthDays * 24 * 60 * 60 * 1000),
                        includedUnits: agreement.basis === "UNITS" ? includedUnits : null,
                        includedValueCents: agreement.basis === "VALUE" ? includedValueCents : null,
                        state: "OPEN",
                    },
                })) as RawPeriod
                await this.event(tx, id, "period", next.id, null, "OPEN", actor, {
                    ordinal: next.ordinal,
                    renewedFrom: pid,
                })
            }
            return { closed: closed as RawPeriod, next }
        })
        return { period: toPeriodRecord(out.closed), next: out.next ? toPeriodRecord(out.next) : null }
    }

    /**
     * Moves a period's BILLING state through the existing invoice vocabulary and may record the
     * CaseInvoice it was billed on. It creates no Payment and reads none: this records where the
     * billing got to, nothing more.
     */
    async setBilling(
        workspaceId: string,
        retainerId: string,
        periodId: string,
        to: InvoiceStateValue,
        actor: CaseActor,
        options?: Readonly<{ invoiceId?: string | null }>,
    ): Promise<PeriodRecord> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(retainerId, "retainerId")
        const pid = this.ctx.required(periodId, "periodId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            await this.lockRetainer(tx, id, ws)
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; retainerId: string; billingState: InvoiceStateValue; ordinal: number }>>(
                `select "id","retainerId","billingState","ordinal" from "CaseRetainerPeriod" where "id" = $1 for update`,
                pid,
            )
            const current = rows[0]
            if (!current || current.retainerId !== id) this.ctx.denied()
            if (invoiceFlow.isTerminal(current.billingState)) {
                this.ctx.conflict(`Billing for period ${current.ordinal} is already ${current.billingState.toLowerCase()}`)
            }
            if (!invoiceFlow.can(current.billingState, to)) {
                this.ctx.conflict(`Cannot move billing from ${current.billingState.toLowerCase()} to ${to.toLowerCase()}`)
            }

            let invoiceId: string | null | undefined
            const requested = options?.invoiceId?.trim() || null
            if (requested) {
                // The invoice has to belong to a case this retainer actually covers, or the billing
                // record would point at work the agreement never covered.
                const invoice = await tx.caseInvoice.findUnique({
                    where: { id: requested },
                    select: { id: true, caseId: true, case: { select: { workspaceId: true } } },
                })
                if (!invoice || invoice.case.workspaceId !== ws) this.ctx.denied()
                const link = await tx.caseRetainerCaseLink.findUnique({
                    where: { retainerId_caseId: { retainerId: id, caseId: invoice.caseId } },
                })
                if (!link) {
                    this.ctx.conflict("That invoice belongs to a case this retainer does not cover")
                }
                invoiceId = invoice.id
            }

            const updated = await tx.caseRetainerPeriod.update({
                where: { id: pid },
                data: { billingState: to, ...(invoiceId ? { invoiceId } : {}) },
            })
            await this.event(tx, id, "billing", pid, current.billingState, to, actor, {
                ...(invoiceId ? { invoiceId } : {}),
                paymentExecuted: false,
            })
            return updated
        })
        return toPeriodRecord(row as RawPeriod)
    }

    // -----------------------------------------------------------------------
    // Draws
    // -----------------------------------------------------------------------

    /**
     * Records consumption against the open period. Takes a row lock on the period first, so two
     * concurrent draws serialise and both land with correct after-balances rather than one
     * overwriting the other.
     *
     * Idempotent on (periodId, idempotencyKey). Replaying returns the original row rather than
     * refusing, because a caller retrying a timed-out request has not asked for anything twice.
     */
    async recordDraw(
        workspaceId: string,
        retainerId: string,
        input: Readonly<{
            kind: RetainerDrawKindValue
            units?: number | null
            valueCents?: number | null
            caseId?: string | null
            note?: string | null
            idempotencyKey?: string | null
        }>,
        actor: CaseActor,
    ): Promise<{ draw: DrawRecord; period: PeriodRecord; replayed: boolean }> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const id = this.ctx.required(retainerId, "retainerId")
        const key = input.idempotencyKey?.trim() || null

        const magnitude = input.units ?? input.valueCents
        if (typeof magnitude !== "number" || !Number.isInteger(magnitude) || magnitude === 0) {
            this.ctx.conflict("A draw needs a non-zero whole number of units or cents")
        }
        if (input.units != null && input.valueCents != null) {
            this.ctx.conflict("A draw is denominated in units or in cents, not both")
        }
        if (CONSUMING_DRAW_KINDS.includes(input.kind) && magnitude < 0) {
            this.ctx.conflict("A DRAW consumes the allowance, so it cannot be negative; use a CREDIT")
        }

        const out = await this.ctx.db.$transaction(async (tx) => {
            const retainer = await this.lockRetainer(tx, id, ws)
            if (!DRAWABLE_RETAINER_STATES.includes(retainer.state)) {
                this.ctx.conflict(`A ${retainer.state.toLowerCase()} retainer cannot accept a draw`)
            }
            const openRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
                `select "id" from "CaseRetainerPeriod" where "retainerId" = $1 and "state" = 'OPEN' for update`,
                id,
            )
            if (openRows.length === 0) this.ctx.conflict("This retainer has no open period, so nothing can be drawn")
            const period = (await tx.caseRetainerPeriod.findUniqueOrThrow({ where: { id: openRows[0].id } })) as RawPeriod

            if (key) {
                const existing = await tx.caseRetainerDraw.findUnique({
                    where: { periodId_idempotencyKey: { periodId: period.id, idempotencyKey: key } },
                })
                if (existing) {
                    return { draw: existing, period, replayed: true }
                }
            }

            const basis: RetainerBasisValue = period.includedUnits !== null ? "UNITS" : "VALUE"
            const givenUnits = input.units != null
            if (basis === "UNITS" && !givenUnits) {
                this.ctx.conflict("The open period is denominated in units, so the draw must be too")
            }
            if (basis === "VALUE" && givenUnits) {
                this.ctx.conflict("The open period is denominated in money, so the draw must be too")
            }

            let caseId: string | null = null
            const requestedCase = input.caseId?.trim() || null
            if (requestedCase) {
                const owned = await this.ctx.ownedCase(ws, requestedCase)
                const link = await tx.caseRetainerCaseLink.findUnique({
                    where: { retainerId_caseId: { retainerId: id, caseId: owned.id } },
                })
                if (!link) this.ctx.conflict("That case is not covered by this retainer, so it cannot draw against it")
                caseId = owned.id
            }

            const delta = magnitude
            const usedUnitsAfter = basis === "UNITS" ? period.usedUnits + delta : period.usedUnits
            const usedValueCentsAfter = basis === "VALUE" ? period.usedValueCents + delta : period.usedValueCents
            if (usedUnitsAfter < 0 || usedValueCentsAfter < 0) {
                this.ctx.conflict(
                    `That credit is larger than what has been used (${basis === "UNITS" ? period.usedUnits : period.usedValueCents})`,
                )
            }

            const draw = await tx.caseRetainerDraw.create({
                data: {
                    retainerId: id,
                    periodId: period.id,
                    caseId,
                    kind: input.kind,
                    unitsDelta: basis === "UNITS" ? delta : null,
                    valueDeltaCents: basis === "VALUE" ? delta : null,
                    usedUnitsAfter,
                    usedValueCentsAfter,
                    note: input.note?.trim() || null,
                    actor: actor.actorType,
                    actorId: actor.actorId,
                    ...(key ? { idempotencyKey: key } : {}),
                },
            })
            const updatedPeriod = (await tx.caseRetainerPeriod.update({
                where: { id: period.id },
                data: { usedUnits: usedUnitsAfter, usedValueCents: usedValueCentsAfter },
            })) as RawPeriod

            const included = basis === "UNITS" ? (updatedPeriod.includedUnits ?? 0) : (updatedPeriod.includedValueCents ?? 0)
            const used = basis === "UNITS" ? usedUnitsAfter : usedValueCentsAfter
            await this.event(tx, id, "draw", draw.id, null, input.kind, actor, {
                delta,
                basis,
                periodId: period.id,
                ...(caseId ? { caseId } : {}),
                ...(used > included ? { overage: used - included } : {}),
            })
            if (caseId) {
                await this.ctx.appendEvent(tx, caseId, "RETAINER", null, input.kind, actor, {
                    retainerId: id,
                    delta,
                    basis,
                })
            }
            return { draw, period: updatedPeriod, replayed: false }
        })

        return {
            draw: this.toDraw(out.draw as never),
            period: toPeriodRecord(out.period),
            replayed: out.replayed,
        }
    }

    async listDraws(workspaceId: string, retainerId: string, periodId?: string | null): Promise<readonly DrawRecord[]> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const retainer = await this.owned(ws, retainerId)
        const rows = await this.ctx.db.caseRetainerDraw.findMany({
            where: { retainerId: retainer.id, ...(periodId?.trim() ? { periodId: periodId.trim() } : {}) },
            orderBy: { seq: "asc" },
        })
        return Object.freeze(rows.map((r) => this.toDraw(r as never)))
    }

    /**
     * Recomputed on every read. Nothing here is stored, because a stored remaining figure is a
     * second number that has to agree with the ledger, and the two would eventually disagree.
     */
    async balance(workspaceId: string, retainerId: string): Promise<RetainerBalance> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const retainer = await this.owned(ws, retainerId)
        const periods = await this.ctx.db.caseRetainerPeriod.findMany({
            where: { retainerId: retainer.id },
            orderBy: { ordinal: "asc" },
        })
        const basis: RetainerBasisValue = retainer.basis
        let lifetimeUsed = 0
        let lifetimeIncluded = 0
        let lifetimeOverage = 0
        let open: RawPeriod | null = null
        for (const raw of periods as RawPeriod[]) {
            const included = basis === "UNITS" ? (raw.includedUnits ?? 0) : (raw.includedValueCents ?? 0)
            const used = basis === "UNITS" ? raw.usedUnits : raw.usedValueCents
            lifetimeIncluded += included
            lifetimeUsed += used
            lifetimeOverage += Math.max(0, used - included)
            if (raw.state === "OPEN") open = raw
        }
        return Object.freeze({
            retainerId: retainer.id,
            basis,
            currency: retainer.currency,
            openPeriod: open ? toPeriodRecord(open) : null,
            lifetimeUsed,
            lifetimeIncluded,
            lifetimeOverage,
            periodCount: periods.length,
        })
    }

    /** The complete agreement history: state changes, periods, links, billing and draws. */
    async timeline(
        workspaceId: string,
        retainerId: string,
    ): Promise<readonly Readonly<{ id: string; seq: string; kind: string; subjectType: string; subjectId: string; from: string | null; to: string; actor: string; actorId: string | null; at: Date; metadata: unknown }>[]> {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const retainer = await this.owned(ws, retainerId)
        const rows = await this.ctx.db.caseRetainerEvent.findMany({
            where: { retainerId: retainer.id },
            orderBy: { seq: "asc" },
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    id: r.id,
                    seq: String(r.seq),
                    kind: r.kind as string,
                    subjectType: r.subjectType,
                    subjectId: r.subjectId,
                    from: r.from,
                    to: r.to,
                    actor: r.actor as string,
                    actorId: r.actorId,
                    at: r.at,
                    metadata: r.metadata,
                }),
            ),
        )
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    private toDraw(row: {
        id: string
        retainerId: string
        periodId: string
        caseId: string | null
        seq: bigint
        kind: string
        unitsDelta: number | null
        valueDeltaCents: number | null
        usedUnitsAfter: number
        usedValueCentsAfter: number
        note: string | null
        actor: string
        actorId: string | null
        at: Date
    }): DrawRecord {
        return Object.freeze({
            id: row.id,
            retainerId: row.retainerId,
            periodId: row.periodId,
            caseId: row.caseId,
            seq: String(row.seq),
            kind: row.kind as RetainerDrawKindValue,
            unitsDelta: row.unitsDelta,
            valueDeltaCents: row.valueDeltaCents,
            usedUnitsAfter: row.usedUnitsAfter,
            usedValueCentsAfter: row.usedValueCentsAfter,
            note: row.note,
            actor: row.actor,
            actorId: row.actorId,
            at: row.at,
        })
    }

    /** Resolve-then-authorize. Absent and foreign are the same refusal, as everywhere else. */
    private async owned(workspaceId: string, retainerId: string): Promise<RawRetainer> {
        const id = this.ctx.required(retainerId, "retainerId")
        const row = await this.ctx.db.caseRetainer.findUnique({ where: { id }, select: RETAINER_SELECT })
        if (!row || row.workspaceId !== workspaceId) this.ctx.denied()
        return row as RawRetainer
    }

    private async lockRetainer(tx: Tx, retainerId: string, workspaceId: string) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; workspaceId: string; state: RetainerStateValue }>>(
            `select "id","workspaceId","state" from "CaseRetainer" where "id" = $1 for update`,
            retainerId,
        )
        const current = rows[0]
        if (!current || current.workspaceId !== workspaceId) this.ctx.denied()
        return current
    }

    private async event(
        tx: Tx,
        retainerId: string,
        subjectType: string,
        subjectId: string,
        from: string | null,
        to: string,
        actor: CaseActor,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        await tx.caseRetainerEvent.create({
            data: {
                retainerId,
                kind: "RETAINER",
                subjectType,
                subjectId,
                from,
                to,
                actor: actor.actorType,
                actorId: actor.actorId,
                ...(metadata ? { metadata: metadata as never } : {}),
            },
        })
    }
}
