/**
 * Shared view types and fetch helpers for the fieldJobs:inspection owner surface.
 *
 * These mirror the { ok, data } / { ok, error } envelope described in
 * INSPECTION_API_CONTRACT.md, the same envelope the rest of the fieldJobs surface uses. Root
 * implements the routes to match this contract; this client copy is written against the
 * document, not against a running route.
 *
 * Nothing here fabricates a record. Every view type is a projection of a persisted row, and an
 * absent row is an empty list or null, never a sample.
 *
 * Decimal fields (measuredValue, expectedMin, expectedMax) and the timeline's seq arrive as
 * STRINGS, by contract - never assume number here.
 */

export type InspectionStatus = "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED" | "CANCELLED"
export type InspectionOutcome = "PASS" | "FAIL" | "ADVISORY"
export type InspectionItemKind = "CHECK" | "MEASUREMENT" | "ASSET"
export type InspectionItemResult = "PENDING" | "PASS" | "FAIL" | "NOT_APPLICABLE"
export type InvoiceHandoffState = "NOT_READY" | "READY" | "HANDED_OFF" | "DECLINED"

export type InspectionTemplateView = Readonly<{
    id: string
    profileId: string
    serviceOfferingId: string | null
    name: string
    description: string | null
    isActive: boolean
    revision: number
    createdAt: string
    updatedAt: string
}>

export type InspectionView = Readonly<{
    id: string
    jobId: string
    profileId: string
    templateId: string | null
    assignmentId: string | null
    reference: string
    status: InspectionStatus
    outcome: InspectionOutcome | null
    startedAt: string | null
    submittedAt: string | null
    completedAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
    completionNotes: string | null
    evidenceManifest: unknown
    invoiceHandoffState: InvoiceHandoffState
    invoiceHandoffAt: string | null
    invoiceHandoffReference: string | null
    invoiceHandoffNote: string | null
    createdAt: string
    updatedAt: string
    allowedTransitions: readonly string[]
    pendingRequired: number
    isTerminal: boolean
}>

export type InspectionItemView = Readonly<{
    id: string
    inspectionId: string
    templateItemId: string | null
    position: number
    kind: InspectionItemKind
    label: string
    guidance: string | null
    required: boolean
    result: InspectionItemResult
    notes: string | null
    measuredValue: string | null
    unit: string | null
    expectedMin: string | null
    expectedMax: string | null
    assetLabel: string | null
    assetSerial: string | null
    assetLocationHint: string | null
    recordedAt: string | null
    createdAt: string
    updatedAt: string
    isWithinExpectedRange: boolean | null
}>

export type InspectionPartView = Readonly<{
    id: string
    inspectionId: string
    inventoryItemId: string
    movementId: string | null
    qty: number
    unitCostCents: number | null
    currency: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
}>

export type InspectionEventView = Readonly<{
    id: string
    seq: string
    kind: string
    subjectType: string
    subjectId: string
    from: string | null
    to: string
    actor: string
    actorId: string | null
    at: string
    metadata: unknown
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

export class InspectionRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "InspectionRequestError"
    }
}

export async function inspectionRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new InspectionRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new InspectionRequestError(response.status, error.code, error.message, "details" in error ? error.details : undefined)
    }
    return envelope.data
}

export function isAbort(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A 403 here is deliberately the same copy for a foreign inspection and a nonexistent one - the
 * contract says there is no 404, because a 404 would let a caller discover which ids exist. The
 * UI must never claim the id is absent. A 409 and 400 are shown verbatim because they carry
 * the numbers (pendingRequired, stock quantities) an owner needs to act. A 503 blames nobody.
 */
export function inspectionErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof InspectionRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Inspection access required",
                description: "You do not have access to this inspection.",
            }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 409) return { title: "That change is not allowed", description: error.message }
        if (error.status === 503) {
            return {
                title: "Inspections are unavailable",
                description: "The inspection engine is not responding right now. Nothing was changed.",
            }
        }
        return { title: "Inspections could not load", description: error.message }
    }
    return {
        title: "Inspections could not load",
        description: "An unexpected problem occurred. Nothing was changed.",
    }
}

/** error.details often carries numbers (pendingRequired, stock counts) worth showing alongside the message. */
export function detailsSummary(error: unknown): string | null {
    if (!(error instanceof InspectionRequestError) || !error.details) return null
    const parts = Object.entries(error.details).map(([key, value]) => `${key}: ${String(value)}`)
    return parts.length > 0 ? parts.join(", ") : null
}

export function formatWhen(value: string | null): string {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString()
}

export function titleCase(value: string): string {
    return value
        .split("_")
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" ")
}

/**
 * measuredValue/expectedMin/expectedMax are Decimal fields serialised as strings, by contract.
 * Parse only for display; never assume number, and never send a parsed number back to the server.
 */
export function formatDecimal(value: string | null): string | null {
    if (value === null) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? String(parsed) : value
}

export function measurementRange(item: InspectionItemView): string | null {
    if (item.expectedMin === null && item.expectedMax === null) return null
    const min = formatDecimal(item.expectedMin)
    const max = formatDecimal(item.expectedMax)
    if (min !== null && max !== null) return `expected ${min}–${max}${item.unit ? ` ${item.unit}` : ""}`
    if (min !== null) return `expected ≥ ${min}${item.unit ? ` ${item.unit}` : ""}`
    return `expected ≤ ${max}${item.unit ? ` ${item.unit}` : ""}`
}

export function itemResultVariant(result: InspectionItemResult) {
    if (result === "PASS") return "default" as const
    if (result === "FAIL") return "destructive" as const
    if (result === "NOT_APPLICABLE") return "secondary" as const
    return "outline" as const
}

export function inspectionStatusVariant(status: InspectionStatus) {
    if (status === "COMPLETED") return "default" as const
    if (status === "CANCELLED") return "destructive" as const
    return "secondary" as const
}

export function handoffVariant(state: InvoiceHandoffState) {
    if (state === "HANDED_OFF") return "default" as const
    if (state === "DECLINED") return "destructive" as const
    if (state === "READY") return "secondary" as const
    return "outline" as const
}
