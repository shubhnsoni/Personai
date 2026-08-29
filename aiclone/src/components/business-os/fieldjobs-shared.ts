/**
 * Shared view types and fetch helpers for the field-jobs surface.
 *
 * These mirror the { ok, data } / { ok, error } envelope produced by src/lib/fieldjobs/http.ts.
 * The envelope contract is asserted by scripts/one-off/check-fieldjob-routes.ts, so this client
 * copy cannot drift silently.
 *
 * Nothing here fabricates a record. Every view type is a projection of a persisted row, and an
 * absent row is an empty list or null, never a sample.
 */

export type FieldRequestView = Readonly<{
    id: string
    source: string
    summary: string
    status: string
    requesterName: string | null
    requesterPhone: string | null
    siteAddress: string | null
    estimateCents: number | null
    currency: string
    declineReason: string | null
    allowedTransitions: readonly string[]
    createdAt: string
}>

export type FieldJobView = Readonly<{
    id: string
    requestId: string | null
    reference: string
    title: string
    status: string
    priority: string
    siteAddress: string
    siteNotes: string | null
    contactName: string | null
    contactPhone: string | null
    scheduledStartAt: string | null
    scheduledEndAt: string | null
    estimateCents: number | null
    currency: string
    dispatchedAt: string | null
    startedAt: string | null
    completedAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
    allowedTransitions: readonly string[]
    isScheduled: boolean
}>

export type FieldAssignmentView = Readonly<{
    id: string
    resourceId: string
    resourceName: string
    role: string
    state: string
    assignedAt: string
    onSiteAt: string | null
    completedAt: string | null
    declineReason: string | null
    releaseReason: string | null
    allowedTransitions: readonly string[]
    isActive: boolean
}>

export type FieldEventView = Readonly<{
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

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

export class FieldJobRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "FieldJobRequestError"
    }
}

export async function fieldJobRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new FieldJobRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new FieldJobRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

export function isAbort(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A 409 here is nearly always the thing the owner needs to read - "a job cannot be dispatched
 * without an accountable lead technician", "2 technicians are still mid-visit" - so it is shown
 * verbatim. An infrastructure failure is not, because its message would only leak internals. A 403
 * is deliberately the same copy for a foreign job and a missing one, so the UI cannot be used to
 * discover that a job exists.
 */
export function fieldJobErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof FieldJobRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return { title: "Field job access required", description: "This workspace does not grant you access to that record." }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 409) return { title: "That change is not allowed", description: error.message }
        if (error.status === 503) {
            return { title: "Field jobs are unavailable", description: "Field job storage is not responding. Nothing was changed." }
        }
        return { title: "Field jobs could not load", description: error.message }
    }
    return { title: "Field jobs could not load", description: "An unexpected problem occurred. Nothing was changed." }
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
