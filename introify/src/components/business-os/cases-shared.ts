/**
 * Shared view types and fetch helpers for the cases/projects surface.
 *
 * These mirror the { ok, data } / { ok, error } envelope produced by
 * src/lib/cases/http.ts. The envelope contract is asserted by
 * scripts/one-off/check-case-routes.ts, so this client copy cannot drift silently.
 *
 * Nothing here fabricates a record: every view type is a projection of a persisted
 * row, and an absent row is represented as an empty list or null, never a sample.
 */

export type CaseView = Readonly<{
    id: string
    workspaceId: string
    reference: string
    title: string
    status: string
    invoiceState: string
    contactId: string | null
    locationId: string | null
    intakeId: string | null
    openedAt: string | null
    deliveredAt: string | null
    closedAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
    allowedTransitions: readonly string[]
    createdAt: string
    updatedAt: string
}>

export type IntakeView = Readonly<{
    id: string
    source: string
    summary: string
    status: string
    contactId: string | null
    declineReason: string | null
    createdAt: string
}>

export type BriefView = Readonly<{
    id: string
    objectives: string
    scope: string | null
    constraints: string | null
    agreedAt: string | null
}>

export type MilestoneView = Readonly<{
    id: string
    title: string
    ordinal: number
    status: string
    dueAt: string | null
    completedAt: string | null
}>

export type DocumentRequestView = Readonly<{
    id: string
    title: string
    description: string | null
    status: string
    dueAt: string | null
    documentId: string | null
    receivedAt: string | null
    waivedReason: string | null
}>

export type DeliverableView = Readonly<{
    id: string
    title: string
    status: string
    milestoneId: string | null
    documentId: string | null
    deliveredAt: string | null
}>

export type TaskView = Readonly<{
    id: string
    state: string
    attempts: number
    maxAttempts: number
    lastError: string | null
}>

export type ApprovalView = Readonly<{
    id: string
    state: string
    reason: string | null
    requestedBy: string
    decidedBy: string | null
    decidedAt: string | null
}>

export type InvoiceView = Readonly<{
    id: string
    reference: string
    amountCents: number
    currency: string
    state: string
    issuedAt: string | null
    paidAt: string | null
    paymentId: string | null
}>

export type CaseEventView = Readonly<{
    id: string
    seq: string
    kind: string
    from: string | null
    to: string
    actor: string
    actorId: string | null
    at: string
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

export class CaseRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "CaseRequestError"
    }
}

export async function caseRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new CaseRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new CaseRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

export function isAbort(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A refusal an owner can act on is shown verbatim; an infrastructure failure is not,
 * because its message would only leak internals. A 403 is deliberately the same copy
 * for a foreign case and a nonexistent one so the UI does not become an enumerator.
 */
export function caseErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof CaseRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Case access required",
                description: "This workspace does not grant you access to that case.",
            }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 409) return { title: "That change conflicts", description: error.message }
        if (error.status === 503) {
            return {
                title: "Cases are unavailable",
                description: "Case storage is not responding. Nothing was changed.",
            }
        }
        return { title: "Cases could not load", description: error.message }
    }
    return {
        title: "Cases could not load",
        description: "An unexpected problem occurred. Nothing was changed.",
    }
}

export function formatWhen(value: string | null): string {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString()
}

export function money(amountCents: number, currency: string): string {
    return `${currency} ${(amountCents / 100).toFixed(2)}`
}

export function titleCase(value: string): string {
    return value
        .split("_")
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" ")
}


// ---------------------------------------------------------------------------
// Retainers (Wave G5). Same rule as everything above: every field is a projection of a
// persisted row. `remaining` and `overage` arrive computed from the server rather than being
// worked out in the browser, because the server is where the ledger is.
// ---------------------------------------------------------------------------

export type RetainerView = Readonly<{
    id: string
    reference: string
    title: string
    state: string
    basis: string
    includedUnits: number | null
    includedValueCents: number | null
    currency: string
    periodKind: string
    periodDays: number | null
    periodLengthDays: number | null
    rolloverAllowed: boolean
    autoRenew: boolean
    contactId: string | null
    activatedAt: string | null
    pausedAt: string | null
    expiredAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
    allowedTransitions: readonly string[]
    createdAt: string
}>

export type RetainerPeriodView = Readonly<{
    id: string
    ordinal: number
    startsOn: string
    endsOn: string
    basis: string
    includedUnits: number | null
    includedValueCents: number | null
    usedUnits: number
    usedValueCents: number
    remaining: number
    overage: number
    state: string
    billingState: string
    invoiceId: string | null
    allowedTransitions: readonly string[]
    allowedBillingTransitions: readonly string[]
}>

export type RetainerDrawView = Readonly<{
    id: string
    seq: string
    kind: string
    periodId: string
    caseId: string | null
    unitsDelta: number | null
    valueDeltaCents: number | null
    usedUnitsAfter: number
    usedValueCentsAfter: number
    note: string | null
    actor: string
    at: string
}>

export type RetainerCaseView = Readonly<{
    caseId: string
    reference: string
    title: string
    status: string
    linkedAt: string
}>

export type RetainerBalanceView = Readonly<{
    retainerId: string
    basis: string
    currency: string
    openPeriod: RetainerPeriodView | null
    lifetimeUsed: number
    lifetimeIncluded: number
    lifetimeOverage: number
    periodCount: number
}>

export type RetainerEventView = Readonly<{
    id: string
    seq: string
    kind: string
    subjectType: string
    subjectId: string
    from: string | null
    to: string
    actor: string
    at: string
}>

/**
 * A retainer allowance is either a count of units or an amount of money, never both, so it needs
 * one formatter that knows which. Showing "20" where the agreement is denominated in money, or
 * "USD 0.20" where it is denominated in units, would be a quiet lie about the contract.
 */
export function allowance(basis: string, units: number, cents: number, currency: string): string {
    return basis === "UNITS" ? `${units} units` : money(cents, currency)
}
