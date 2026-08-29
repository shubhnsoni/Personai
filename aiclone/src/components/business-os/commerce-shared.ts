/**
 * Shared view types and fetch helpers for the commerce surface.
 *
 * These mirror the { ok, data } / { ok, error } envelope produced by
 * src/lib/commerce/http.ts. The envelope contract is asserted by
 * scripts/one-off/check-commerce-routes.ts, so this client copy cannot drift silently.
 *
 * Nothing here fabricates a record. Every view type is a projection of a persisted row, and
 * an absent row is an empty list or null, never a sample.
 */

export type ProductView = Readonly<{
    id: string
    title: string
    sku: string | null
    priceCents: number
    currency: string
    isActive: boolean
    fulfillment: string
    variantCount: number
}>

export type OrderView = Readonly<{
    id: string
    number: number
    status: string
    payStatus: string
    channel: string
    totalCents: number
    currency: string
    guestName: string | null
    placedAt: string
    lineCount: number
    fulfilmentCount: number
    returnCount: number
}>

export type VariantView = Readonly<{
    id: string
    productId: string
    isDefault: boolean
    isActive: boolean
    title: string
    ordinal: number
    priceCents: number | null
    compareAtCents: number | null
    sku: string | null
    effectivePriceCents: number
}>

export type OptionValueView = Readonly<{ id: string; value: string; ordinal: number }>
export type OptionView = Readonly<{
    id: string
    name: string
    ordinal: number
    values: readonly OptionValueView[]
}>

export type AllocationView = Readonly<{
    orderLineId: string
    title: string
    ordered: number
    allocated: number
    remaining: number
    fulfilled: number
}>

export type FulfilmentItemView = Readonly<{
    id: string
    orderLineId: string
    variantId: string
    qty: number
}>

export type FulfilmentView = Readonly<{
    id: string
    orderId: string
    reference: string
    state: string
    carrier: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    locationId: string | null
    packedAt: string | null
    shippedAt: string | null
    deliveredAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
    allowedTransitions: readonly string[]
    items: readonly FulfilmentItemView[]
}>

export type EligibilityView = Readonly<{
    orderLineId: string
    title: string
    ordered: number
    fulfilled: number
    claimed: number
    returnable: number
}>

export type ReturnItemView = Readonly<{
    id: string
    orderLineId: string
    variantId: string
    qty: number
    restockState: string
    restockedAt: string | null
    restockMovementId: string | null
    allowedRestockTransitions: readonly string[]
}>

export type ReturnView = Readonly<{
    id: string
    orderId: string
    reference: string
    state: string
    reason: string | null
    decisionNote: string | null
    decidedBy: string | null
    requestedAt: string
    decidedAt: string | null
    receivedAt: string | null
    refundPaymentId: string | null
    allowedTransitions: readonly string[]
    items: readonly ReturnItemView[]
}>

export type CommerceEventView = Readonly<{
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
    | Readonly<{ ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }>

export class CommerceRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details: Record<string, unknown> | null,
    ) {
        super(message)
        this.name = "CommerceRequestError"
    }
}

export async function commerceRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new CommerceRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.", null)
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok
            ? { code: "REQUEST_FAILED", message: "The request failed.", details: undefined }
            : envelope.error
        throw new CommerceRequestError(response.status, error.code, error.message, error.details ?? null)
    }
    return envelope.data
}

export function isAbort(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A 409 here almost always carries the number the owner needs — "only 3 units are still
 * unshipped", "only 2 units can still be returned", "1 units promised to orders" — so it is
 * shown verbatim. An infrastructure failure is not, because its message would only leak
 * internals. A 403 is deliberately the same copy for a foreign record and a missing one, so
 * the UI does not become an enumerator.
 */
export function commerceErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof CommerceRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Commerce access required",
                description: "This workspace does not grant you access to that record.",
            }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 409) return { title: "That change is not allowed", description: error.message }
        if (error.status === 503) {
            return { title: "Commerce is unavailable", description: "Commerce storage is not responding. Nothing was changed." }
        }
        return { title: "Commerce could not load", description: error.message }
    }
    return { title: "Commerce could not load", description: "An unexpected problem occurred. Nothing was changed." }
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
