/**
 * fieldJobs:inspection lifecycle tables (Wave H0/H1). Pure data, no imports, no I/O - so a client
 * component can import a transition table without pulling Prisma or Clerk, exactly as
 * lifecycle.ts does for the foundation.
 *
 * TWO STATE MACHINES, because there are two things with independent lives: the INSPECTION, and the
 * INVOICE HANDOFF that may follow it. A handoff can be declined without the inspection changing,
 * and an inspection can be completed without anybody deciding to bill it.
 *
 * SUBMITTED is not decoration. A technician finishing on site and the office accepting the result
 * are different facts, and it is the office that hands work to billing. Collapsing them would make
 * "who said this passed" unanswerable. SUBMITTED can go back to IN_PROGRESS, because an office
 * sending a job card back for more detail is ordinary; it cannot go straight to CANCELLED-and-back,
 * because CANCELLED is terminal.
 */

export const INSPECTION_STATUSES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED"] as const
export type InspectionStatusValue = (typeof INSPECTION_STATUSES)[number]

const INSPECTION_TRANSITIONS: Readonly<Record<InspectionStatusValue, readonly InspectionStatusValue[]>> = Object.freeze({
    DRAFT: Object.freeze(["IN_PROGRESS", "CANCELLED"] as const),
    IN_PROGRESS: Object.freeze(["SUBMITTED", "CANCELLED"] as const),
    // Back to IN_PROGRESS is deliberate: an office returning a job card for more detail is normal
    // work, and forcing a cancel-and-recreate would throw away the readings already taken.
    SUBMITTED: Object.freeze(["COMPLETED", "IN_PROGRESS", "CANCELLED"] as const),
    COMPLETED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

/** A verdict is required to reach these. A finished inspection that says nothing is not a record. */
export const OUTCOME_REQUIRED_STATUSES: readonly InspectionStatusValue[] = Object.freeze(["COMPLETED"])
/** Completion notes are required here, for the same reason. */
export const NOTES_REQUIRED_STATUSES: readonly InspectionStatusValue[] = Object.freeze(["COMPLETED"])
/** A cancellation must explain itself, or it reads as a mistake a week later. */
export const REASON_REQUIRED_STATUSES: readonly InspectionStatusValue[] = Object.freeze(["CANCELLED"])
/** Every required line must be answered before this. PENDING blocks; NOT_APPLICABLE does not. */
export const ALL_REQUIRED_ANSWERED_STATUSES: readonly InspectionStatusValue[] = Object.freeze(["SUBMITTED", "COMPLETED"])
/** Results and parts may only be recorded while the inspection is open. */
export const RECORDABLE_STATUSES: readonly InspectionStatusValue[] = Object.freeze(["DRAFT", "IN_PROGRESS"])

export const INSPECTION_OUTCOMES = ["PASS", "FAIL", "ADVISORY"] as const
export type InspectionOutcomeValue = (typeof INSPECTION_OUTCOMES)[number]

export const INSPECTION_ITEM_KINDS = ["CHECK", "MEASUREMENT", "ASSET"] as const
export type InspectionItemKindValue = (typeof INSPECTION_ITEM_KINDS)[number]

export const INSPECTION_ITEM_RESULTS = ["PENDING", "PASS", "FAIL", "NOT_APPLICABLE"] as const
export type InspectionItemResultValue = (typeof INSPECTION_ITEM_RESULTS)[number]

/** PENDING is "nobody has looked yet". NOT_APPLICABLE is an answer. Only the first one blocks. */
export const UNANSWERED_ITEM_RESULTS: readonly InspectionItemResultValue[] = Object.freeze(["PENDING"])
/** A failure must say why. */
export const NOTES_REQUIRED_ITEM_RESULTS: readonly InspectionItemResultValue[] = Object.freeze(["FAIL"])

/**
 * Invoice HANDOFF, not invoicing. Nothing here creates an invoice, writes a Payment row or contacts
 * a provider. DECLINED is terminal because "we decided not to bill this" is a decision, not a
 * waiting room; if that changes, the inspection is the wrong place to record it.
 */
export const INVOICE_HANDOFF_STATES = ["NOT_READY", "READY", "HANDED_OFF", "DECLINED"] as const
export type InvoiceHandoffStateValue = (typeof INVOICE_HANDOFF_STATES)[number]

const HANDOFF_TRANSITIONS: Readonly<Record<InvoiceHandoffStateValue, readonly InvoiceHandoffStateValue[]>> = Object.freeze({
    NOT_READY: Object.freeze(["READY", "DECLINED"] as const),
    READY: Object.freeze(["HANDED_OFF", "DECLINED", "NOT_READY"] as const),
    HANDED_OFF: Object.freeze([] as const),
    DECLINED: Object.freeze([] as const),
})

/** Only NOT_READY is reachable before the inspection is finished; the database agrees. */
export const HANDOFF_STATES_REQUIRING_COMPLETION: readonly InvoiceHandoffStateValue[] = Object.freeze([
    "READY",
    "HANDED_OFF",
    "DECLINED",
])
/** A handoff that happened has a time it happened at. */
export const HANDOFF_STATES_REQUIRING_TIMESTAMP: readonly InvoiceHandoffStateValue[] = Object.freeze(["HANDED_OFF"])

function make<T extends string>(table: Readonly<Record<T, readonly T[]>>, all: readonly T[]) {
    return {
        all,
        allowedFrom: (from: T): readonly T[] => table[from] ?? Object.freeze([]),
        can: (from: T, to: T): boolean => (table[from] ?? []).includes(to),
        isTerminal: (from: T): boolean => (table[from] ?? []).length === 0,
        is: (value: unknown): value is T => typeof value === "string" && (all as readonly string[]).includes(value),
    }
}

export const inspectionFlow = make<InspectionStatusValue>(INSPECTION_TRANSITIONS, INSPECTION_STATUSES)
export const handoffFlow = make<InvoiceHandoffStateValue>(HANDOFF_TRANSITIONS, INVOICE_HANDOFF_STATES)

export function isInspectionOutcome(value: unknown): value is InspectionOutcomeValue {
    return typeof value === "string" && (INSPECTION_OUTCOMES as readonly string[]).includes(value)
}
export function isInspectionItemKind(value: unknown): value is InspectionItemKindValue {
    return typeof value === "string" && (INSPECTION_ITEM_KINDS as readonly string[]).includes(value)
}
export function isInspectionItemResult(value: unknown): value is InspectionItemResultValue {
    return typeof value === "string" && (INSPECTION_ITEM_RESULTS as readonly string[]).includes(value)
}

/** Timestamp column set when an inspection reaches a given status. */
export const INSPECTION_TIMESTAMP_FIELD: Readonly<
    Partial<Record<InspectionStatusValue, "startedAt" | "submittedAt" | "completedAt" | "cancelledAt">>
> = Object.freeze({
    IN_PROGRESS: "startedAt",
    SUBMITTED: "submittedAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
})

/**
 * The subject vocabulary this domain adds to the SHARED FieldJobEvent ledger.
 *
 * FieldJobEvent's own comment says subjectType and subjectId are what let one stream cover the
 * request, the job, an assignment and the schedule. Inspection is the fifth subject and adds no
 * event table and no FieldJobEventKind value - Postgres cannot remove an enum value, so adding one
 * would have made the migration's rollback unable to return byte-identical catalog state.
 */
export const INSPECTION_EVENT_SUBJECTS = ["inspection", "inspectionItem", "inspectionPart", "inspectionHandoff"] as const
export type InspectionEventSubject = (typeof INSPECTION_EVENT_SUBJECTS)[number]
