/**
 * Cases and projects lifecycle rules — the single source of truth for every case-side
 * status vocabulary.
 *
 * A pure module: no Prisma, no I/O. Every transition table can therefore be enumerated
 * exhaustively in a test without touching a database, which is what makes "every invalid
 * transition is refused" a checkable claim rather than a sampled one.
 */

// ---------------------------------------------------------------------------
// Case / project
// ---------------------------------------------------------------------------

export const CASE_STATUSES = [
    "INTAKE",
    "BRIEFED",
    "ACTIVE",
    "ON_HOLD",
    "DELIVERED",
    "CLOSED",
    "CANCELLED",
] as const
export type CaseStatusValue = (typeof CASE_STATUSES)[number]

export const CASE_TERMINAL: readonly CaseStatusValue[] = Object.freeze(["CLOSED", "CANCELLED"])

const CASE_TRANSITIONS: Readonly<Record<CaseStatusValue, readonly CaseStatusValue[]>> = Object.freeze({
    INTAKE: Object.freeze(["BRIEFED", "CANCELLED"] as const),
    BRIEFED: Object.freeze(["ACTIVE", "ON_HOLD", "CANCELLED"] as const),
    ACTIVE: Object.freeze(["ON_HOLD", "DELIVERED", "CANCELLED"] as const),
    ON_HOLD: Object.freeze(["ACTIVE", "CANCELLED"] as const),
    DELIVERED: Object.freeze(["CLOSED", "ACTIVE"] as const),
    CLOSED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export const INTAKE_STATUSES = ["NEW", "QUALIFYING", "ACCEPTED", "DECLINED", "CONVERTED"] as const
export type IntakeStatusValue = (typeof INTAKE_STATUSES)[number]

const INTAKE_TRANSITIONS: Readonly<Record<IntakeStatusValue, readonly IntakeStatusValue[]>> = Object.freeze({
    NEW: Object.freeze(["QUALIFYING", "ACCEPTED", "DECLINED"] as const),
    QUALIFYING: Object.freeze(["ACCEPTED", "DECLINED"] as const),
    // CONVERTED is reached only by conversion, never by a bare status edit.
    ACCEPTED: Object.freeze(["DECLINED"] as const),
    DECLINED: Object.freeze([] as const),
    CONVERTED: Object.freeze([] as const),
})

/** Only an ACCEPTED intake may be converted into a case. */
export const CONVERTIBLE_INTAKE_STATUSES: readonly IntakeStatusValue[] = Object.freeze(["ACCEPTED"])

// ---------------------------------------------------------------------------
// Milestone
// ---------------------------------------------------------------------------

export const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED", "CANCELLED"] as const
export type MilestoneStatusValue = (typeof MILESTONE_STATUSES)[number]

const MILESTONE_TRANSITIONS: Readonly<Record<MilestoneStatusValue, readonly MilestoneStatusValue[]>> = Object.freeze({
    PENDING: Object.freeze(["IN_PROGRESS", "BLOCKED", "CANCELLED"] as const),
    IN_PROGRESS: Object.freeze(["DONE", "BLOCKED", "CANCELLED"] as const),
    BLOCKED: Object.freeze(["IN_PROGRESS", "CANCELLED"] as const),
    DONE: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

// ---------------------------------------------------------------------------
// Deliverable
// ---------------------------------------------------------------------------

export const DELIVERABLE_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "DELIVERED", "REJECTED"] as const
export type DeliverableStatusValue = (typeof DELIVERABLE_STATUSES)[number]

const DELIVERABLE_TRANSITIONS: Readonly<Record<DeliverableStatusValue, readonly DeliverableStatusValue[]>> =
    Object.freeze({
        DRAFT: Object.freeze(["IN_REVIEW", "REJECTED"] as const),
        IN_REVIEW: Object.freeze(["APPROVED", "REJECTED"] as const),
        APPROVED: Object.freeze(["DELIVERED", "REJECTED"] as const),
        REJECTED: Object.freeze(["DRAFT"] as const),
        DELIVERED: Object.freeze([] as const),
    })

/**
 * Transitions that may not proceed without a granted Approval on the case.
 *
 * DELIVERED is gated because handing a deliverable to a client is the point of no
 * return: it is externally visible and cannot be quietly undone. The engine refuses it
 * until an Approval linked to the case is in state `approved`.
 */
export const APPROVAL_GATED_DELIVERABLE_STATUSES: readonly DeliverableStatusValue[] = Object.freeze(["DELIVERED"])

// ---------------------------------------------------------------------------
// Document request
// ---------------------------------------------------------------------------

export const DOCUMENT_REQUEST_STATUSES = ["REQUESTED", "RECEIVED", "WAIVED", "REJECTED"] as const
export type DocumentRequestStatusValue = (typeof DOCUMENT_REQUEST_STATUSES)[number]

const DOCUMENT_REQUEST_TRANSITIONS: Readonly<
    Record<DocumentRequestStatusValue, readonly DocumentRequestStatusValue[]>
> = Object.freeze({
    REQUESTED: Object.freeze(["RECEIVED", "WAIVED", "REJECTED"] as const),
    // A rejected submission puts the ball back in the client's court.
    REJECTED: Object.freeze(["REQUESTED", "RECEIVED", "WAIVED"] as const),
    RECEIVED: Object.freeze(["REJECTED"] as const),
    WAIVED: Object.freeze([] as const),
})

/** RECEIVED is the only status that requires an actual document to point at. */
export const DOCUMENT_REQUIRED_STATUSES: readonly DocumentRequestStatusValue[] = Object.freeze(["RECEIVED"])

// ---------------------------------------------------------------------------
// Invoice / billing state
// ---------------------------------------------------------------------------

export const INVOICE_STATES = [
    "NONE",
    "DRAFT",
    "ISSUED",
    "PARTIALLY_PAID",
    "PAID",
    "VOID",
    "WRITTEN_OFF",
] as const
export type InvoiceStateValue = (typeof INVOICE_STATES)[number]

const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStateValue, readonly InvoiceStateValue[]>> = Object.freeze({
    NONE: Object.freeze(["DRAFT"] as const),
    DRAFT: Object.freeze(["ISSUED", "VOID"] as const),
    ISSUED: Object.freeze(["PARTIALLY_PAID", "PAID", "VOID", "WRITTEN_OFF"] as const),
    PARTIALLY_PAID: Object.freeze(["PAID", "WRITTEN_OFF"] as const),
    PAID: Object.freeze([] as const),
    VOID: Object.freeze([] as const),
    WRITTEN_OFF: Object.freeze([] as const),
})

// ---------------------------------------------------------------------------
// Generic accessors
// ---------------------------------------------------------------------------

function make<T extends string>(table: Readonly<Record<T, readonly T[]>>, all: readonly T[]) {
    return {
        all,
        allowedFrom: (from: T): readonly T[] => table[from] ?? Object.freeze([]),
        can: (from: T, to: T): boolean => (table[from] ?? []).includes(to),
        isTerminal: (from: T): boolean => (table[from] ?? []).length === 0,
        is: (value: unknown): value is T => typeof value === "string" && (all as readonly string[]).includes(value),
    }
}

export const caseFlow = make<CaseStatusValue>(CASE_TRANSITIONS, CASE_STATUSES)
export const intakeFlow = make<IntakeStatusValue>(INTAKE_TRANSITIONS, INTAKE_STATUSES)
export const milestoneFlow = make<MilestoneStatusValue>(MILESTONE_TRANSITIONS, MILESTONE_STATUSES)
export const deliverableFlow = make<DeliverableStatusValue>(DELIVERABLE_TRANSITIONS, DELIVERABLE_STATUSES)
export const documentRequestFlow = make<DocumentRequestStatusValue>(
    DOCUMENT_REQUEST_TRANSITIONS,
    DOCUMENT_REQUEST_STATUSES,
)
export const invoiceFlow = make<InvoiceStateValue>(INVOICE_TRANSITIONS, INVOICE_STATES)

/** Timestamp column set when a case reaches a given status. */
export const CASE_TIMESTAMP_FIELD: Readonly<
    Partial<Record<CaseStatusValue, "openedAt" | "deliveredAt" | "closedAt" | "cancelledAt">>
> = Object.freeze({
    ACTIVE: "openedAt",
    DELIVERED: "deliveredAt",
    CLOSED: "closedAt",
    CANCELLED: "cancelledAt",
})
