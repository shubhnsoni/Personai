/**
 * Inventory lifecycle tables.
 *
 * Pure data plus total functions over it. This module imports nothing, so the same
 * tables the write boundary enforces can be imported by a client component without
 * dragging Prisma or Clerk into the browser bundle.
 */

export const RESERVATION_STATES = ["HELD", "RELEASED", "CONSUMED", "EXPIRED"] as const
export type ReservationStateValue = (typeof RESERVATION_STATES)[number]

/**
 * A hold is the only live state. Everything else is an outcome, and outcomes are final:
 * re-releasing a released hold would double-credit stock, and un-consuming one would
 * conjure units that have already left the shelf.
 */
const RESERVATION_TRANSITIONS: Readonly<Record<ReservationStateValue, readonly ReservationStateValue[]>> =
    Object.freeze({
        HELD: Object.freeze(["RELEASED", "CONSUMED", "EXPIRED"] as const),
        RELEASED: Object.freeze([] as const),
        CONSUMED: Object.freeze([] as const),
        EXPIRED: Object.freeze([] as const),
    })

export const MOVEMENT_KINDS = [
    "RECEIPT",
    "ADJUSTMENT",
    "RESERVE",
    "RELEASE",
    "CONSUME",
    "RETURN",
    "COUNT",
] as const
export type MovementKindValue = (typeof MOVEMENT_KINDS)[number]

/**
 * Which movements a caller may write directly. RESERVE, RELEASE and CONSUME are
 * produced only as a side effect of a reservation transition, so accepting them as
 * direct input would let a caller move the reserved balance without a hold behind it.
 */
export const DIRECT_MOVEMENT_KINDS: readonly MovementKindValue[] = Object.freeze([
    "RECEIPT",
    "ADJUSTMENT",
    "RETURN",
    "COUNT",
])

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

export const reservationFlow = make<ReservationStateValue>(RESERVATION_TRANSITIONS, RESERVATION_STATES)

export function isMovementKind(value: unknown): value is MovementKindValue {
    return typeof value === "string" && (MOVEMENT_KINDS as readonly string[]).includes(value)
}

export function isDirectMovementKind(value: unknown): value is MovementKindValue {
    return isMovementKind(value) && (DIRECT_MOVEMENT_KINDS as readonly string[]).includes(value)
}

/** Timestamp column set when a reservation reaches a given state. */
export const RESERVATION_TIMESTAMP_FIELD: Readonly<
    Partial<Record<ReservationStateValue, "releasedAt" | "consumedAt">>
> = Object.freeze({
    RELEASED: "releasedAt",
    EXPIRED: "releasedAt",
    CONSUMED: "consumedAt",
})

/** Sellable units. Reserved stock is physically present but already promised. */
export function availableUnits(onHand: number, reserved: number): number {
    return Math.max(0, onHand - reserved)
}
