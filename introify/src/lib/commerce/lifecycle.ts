/**
 * Commerce lifecycle tables for fulfilment and returns.
 *
 * Pure data plus total functions over it. This module imports nothing, so the same tables
 * the write boundary enforces can be imported by a client component without dragging
 * Prisma or Clerk into the browser bundle.
 */

export const FULFILMENT_STATES = ["DRAFT", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"] as const
export type FulfilmentStateValue = (typeof FULFILMENT_STATES)[number]

const FULFILMENT_TRANSITIONS: Readonly<Record<FulfilmentStateValue, readonly FulfilmentStateValue[]>> =
    Object.freeze({
        DRAFT: Object.freeze(["PACKED", "CANCELLED"] as const),
        PACKED: Object.freeze(["SHIPPED", "CANCELLED"] as const),
        // Once goods have left the building the shipment cannot be cancelled, only
        // delivered. Undoing it would put stock back that is physically gone.
        SHIPPED: Object.freeze(["DELIVERED"] as const),
        DELIVERED: Object.freeze([] as const),
        CANCELLED: Object.freeze([] as const),
    })

/** A shipment with no lines is not a shipment, so packing requires at least one. */
export const ITEMS_REQUIRED_FULFILMENT_STATES: readonly FulfilmentStateValue[] = Object.freeze(["PACKED"])

/**
 * SHIPPED is the point at which stock physically leaves. Any hold on the shipment's order
 * lines is consumed then - not at pack time, when the goods are still on the shelf, and not
 * at delivery, when they left days ago.
 */
export const STOCK_CONSUMING_FULFILMENT_STATES: readonly FulfilmentStateValue[] = Object.freeze(["SHIPPED"])

/** Only these count as "the customer actually received units" for return eligibility. */
export const FULFILLED_STATES: readonly FulfilmentStateValue[] = Object.freeze(["SHIPPED", "DELIVERED"])

/** These consume a line's ordered quantity. A cancelled shipment frees it again. */
export const ALLOCATING_FULFILMENT_STATES: readonly FulfilmentStateValue[] = Object.freeze([
    "DRAFT",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
])

export const RETURN_STATES = ["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "CANCELLED"] as const
export type ReturnStateValue = (typeof RETURN_STATES)[number]

const RETURN_TRANSITIONS: Readonly<Record<ReturnStateValue, readonly ReturnStateValue[]>> = Object.freeze({
    REQUESTED: Object.freeze(["APPROVED", "REJECTED", "CANCELLED"] as const),
    APPROVED: Object.freeze(["RECEIVED", "CANCELLED"] as const),
    // Outcomes are final. Re-deciding a rejected return, or un-receiving goods that are
    // already back on the premises, would each be a lie about the physical world.
    REJECTED: Object.freeze([] as const),
    RECEIVED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

/** A decision must be attributable, so these states require a decider. */
export const DECIDER_REQUIRED_RETURN_STATES: readonly ReturnStateValue[] = Object.freeze([
    "APPROVED",
    "REJECTED",
])

/** Stock may only go back on the shelf once the goods are physically back. */
export const RESTOCKABLE_RETURN_STATES: readonly ReturnStateValue[] = Object.freeze(["RECEIVED"])

/** These consume a line's returnable quantity. A rejected or cancelled return frees it. */
export const CLAIMING_RETURN_STATES: readonly ReturnStateValue[] = Object.freeze([
    "REQUESTED",
    "APPROVED",
    "RECEIVED",
])

export const RESTOCK_STATES = ["PENDING", "RESTOCKED", "DISCARDED"] as const
export type RestockStateValue = (typeof RESTOCK_STATES)[number]

const RESTOCK_TRANSITIONS: Readonly<Record<RestockStateValue, readonly RestockStateValue[]>> = Object.freeze({
    PENDING: Object.freeze(["RESTOCKED", "DISCARDED"] as const),
    RESTOCKED: Object.freeze([] as const),
    DISCARDED: Object.freeze([] as const),
})

export type Flow<T extends string> = Readonly<{
    all: readonly T[]
    allowedFrom: (from: T) => readonly T[]
    can: (from: T, to: T) => boolean
    isTerminal: (from: T) => boolean
    is: (value: unknown) => value is T
}>

function make<T extends string>(table: Readonly<Record<T, readonly T[]>>, all: readonly T[]): Flow<T> {
    return {
        all,
        allowedFrom: (from: T): readonly T[] => table[from] ?? Object.freeze([]),
        can: (from: T, to: T): boolean => (table[from] ?? []).includes(to),
        isTerminal: (from: T): boolean => (table[from] ?? []).length === 0,
        is: (value: unknown): value is T => typeof value === "string" && (all as readonly string[]).includes(value),
    }
}

export const fulfilmentFlow = make<FulfilmentStateValue>(FULFILMENT_TRANSITIONS, FULFILMENT_STATES)
export const returnFlow = make<ReturnStateValue>(RETURN_TRANSITIONS, RETURN_STATES)
export const restockFlow = make<RestockStateValue>(RESTOCK_TRANSITIONS, RESTOCK_STATES)

/** Timestamp column set when a fulfilment reaches a given state. */
export const FULFILMENT_TIMESTAMP_FIELD: Readonly<
    Partial<Record<FulfilmentStateValue, "packedAt" | "shippedAt" | "deliveredAt" | "cancelledAt">>
> = Object.freeze({
    PACKED: "packedAt",
    SHIPPED: "shippedAt",
    DELIVERED: "deliveredAt",
    CANCELLED: "cancelledAt",
})

/** Timestamp column set when a return reaches a given state. */
export const RETURN_TIMESTAMP_FIELD: Readonly<Partial<Record<ReturnStateValue, "decidedAt" | "receivedAt">>> =
    Object.freeze({
        APPROVED: "decidedAt",
        REJECTED: "decidedAt",
        RECEIVED: "receivedAt",
    })

/** Units of an order line still available to put on a shipment. */
export function remainingToFulfil(ordered: number, allocated: number): number {
    return Math.max(0, ordered - allocated)
}

/** Units of an order line a customer could still send back. */
export function remainingToReturn(fulfilled: number, claimed: number): number {
    return Math.max(0, fulfilled - claimed)
}
