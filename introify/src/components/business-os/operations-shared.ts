/**
 * View types and fetch helper for the operations command centre.
 *
 * A per-domain shared module, matching the convention `inspection-shared.ts` and
 * `commerce-shared.ts` already establish. The fetch shape is similar to theirs by design and NOT
 * imported from them: the error copy is the load-bearing part of each, and a shared helper
 * parameterised by a noun would let a caller silently produce copy describing the wrong object.
 *
 * Nothing here fabricates a record. Every view type is a projection of a persisted row, and an
 * absent row is an empty list, never a sample.
 */

export type OperationsDomain =
    | "reservations"
    | "appointments"
    | "fieldJobs"
    | "inspections"
    | "inventory"
    | "fulfilments"
    | "returns"
    | "caseMilestones"

export type AttentionItemView = Readonly<{
    domain: OperationsDomain
    id: string
    reason: string
    label: string
    /** ISO string or null. Null means the domain has no notion of a due date, NOT "unknown". */
    at: string | null
    overdue: boolean
}>

export type DomainSummaryView = Readonly<{
    domain: OperationsDomain
    count: number
    overdue: number
    /**
     * Which tenant boundary this count was read on. Most domains are profile-scoped; case milestones
     * are workspace-scoped because CaseProject carries workspaceId. For an owner with more than one
     * workspace those are different sets, which is why the server reports it instead of implying one.
     */
    scope: "profile" | "workspace"
}>

export type OperationsSummaryView = Readonly<{
    asOf: string
    horizonHours: number
    total: number
    totalOverdue: number
    domains: readonly DomainSummaryView[]
    items: readonly AttentionItemView[]
    /** Exactly what this total is a total OF. */
    covers: readonly string[]
    /** What it is not, with the reason. Rendered, never hidden. */
    doesNotCover: Readonly<Record<string, string>>
    /**
     * True when the domains that actually returned something were NOT all read on one tenant boundary,
     * so this `total` adds a profile-wide figure to a workspace-wide one and reconciles against neither
     * screen on its own. False when the whole answer sits on one boundary, and false when there is no
     * answer. Measured per response by the server, so it varies with the data - it is not a statement
     * about which domains the view covers, which is reported per domain as `DomainSummaryView.scope`.
     */
    mixedScope: boolean
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

export class OperationsRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message)
        this.name = "OperationsRequestError"
    }
}

export async function operationsRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new OperationsRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new OperationsRequestError(response.status, error.code, error.message, "details" in error ? error.details : undefined)
    }
    return envelope.data
}

export function isAbortError(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A 403 here means the caller is not a member of this workspace, or the workspace is not linked to a
 * profile that owns operations. Unlike the record surfaces there is no foreign-row case to describe,
 * because this view never resolves a caller-supplied record id - it only ever asks for everything
 * belonging to the caller's own profile. A 503 blames nobody and states nothing was changed, which is
 * trivially true of a view that cannot write.
 */
export function operationsErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof OperationsRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Operations access required",
                description: "You do not have access to this workspace's operations.",
            }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 503) {
            return {
                title: "Operations are unavailable",
                description: "The operations view is not responding right now. Nothing was changed - this view only reads.",
            }
        }
        return { title: "Operations could not load", description: error.message }
    }
    return {
        title: "Operations could not load",
        description: "An unexpected problem occurred. Nothing was changed - this view only reads.",
    }
}

const DOMAIN_LABELS: Readonly<Record<OperationsDomain, string>> = Object.freeze({
    reservations: "Reservations",
    appointments: "Appointments",
    fieldJobs: "Field jobs",
    inspections: "Inspections",
    inventory: "Stock",
    fulfilments: "Shipments",
    returns: "Returns",
    caseMilestones: "Case milestones",
})

export function domainLabel(domain: string): string {
    return DOMAIN_LABELS[domain as OperationsDomain] ?? domain
}

/** Turns a camelCase domain key from doesNotCover into something readable, without inventing words. */
export function readableKey(key: string): string {
    const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2")
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export function formatAt(value: string | null): string {
    if (!value) return "no due date"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "no due date" : parsed.toLocaleString()
}
