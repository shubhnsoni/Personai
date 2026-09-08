/**
 * Reservation lifecycle rules.
 *
 * Deliberately a pure module with no database or Prisma dependency, so every
 * transition can be exhaustively tested without any I/O. The engine imports these
 * rules; it does not restate them.
 */

export const RESERVATION_STATUSES = [
    "REQUESTED",
    "HELD",
    "CONFIRMED",
    "SEATED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
] as const

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number]

/** Statuses from which no further transition is permitted. */
export const TERMINAL_STATUSES: readonly ReservationStatusValue[] = Object.freeze([
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
])

/**
 * Statuses that occupy the table and therefore participate in overlap checks.
 * This MUST stay in step with the partial predicate on the Reservation_no_overlap
 * exclusion constraint in 20260828170000_restaurant_reservations. If they drift,
 * the database and the application would disagree about what a conflict is.
 */
export const OCCUPYING_STATUSES: readonly ReservationStatusValue[] = Object.freeze([
    "REQUESTED",
    "HELD",
    "CONFIRMED",
    "SEATED",
])

/** The only permitted transitions. Everything absent from this map is refused. */
const ALLOWED_TRANSITIONS: Readonly<Record<ReservationStatusValue, readonly ReservationStatusValue[]>> =
    Object.freeze({
        REQUESTED: Object.freeze(["HELD", "CONFIRMED", "CANCELLED"] as const),
        HELD: Object.freeze(["CONFIRMED", "CANCELLED"] as const),
        CONFIRMED: Object.freeze(["SEATED", "CANCELLED", "NO_SHOW"] as const),
        SEATED: Object.freeze(["COMPLETED"] as const),
        COMPLETED: Object.freeze([] as const),
        CANCELLED: Object.freeze([] as const),
        NO_SHOW: Object.freeze([] as const),
    })

export function isTerminal(status: ReservationStatusValue): boolean {
    return TERMINAL_STATUSES.includes(status)
}

export function occupiesTable(status: ReservationStatusValue): boolean {
    return OCCUPYING_STATUSES.includes(status)
}

export function allowedTransitionsFrom(
    status: ReservationStatusValue,
): readonly ReservationStatusValue[] {
    return ALLOWED_TRANSITIONS[status] ?? Object.freeze([])
}

export function canTransition(
    from: ReservationStatusValue,
    to: ReservationStatusValue,
): boolean {
    return allowedTransitionsFrom(from).includes(to)
}

/**
 * The timestamp column that records each terminal or milestone transition, so the
 * engine does not carry a second copy of this mapping.
 */
export const TRANSITION_TIMESTAMP_FIELD: Readonly<
    Partial<Record<ReservationStatusValue, "confirmedAt" | "seatedAt" | "completedAt" | "cancelledAt" | "noShowAt">>
> = Object.freeze({
    CONFIRMED: "confirmedAt",
    SEATED: "seatedAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
    NO_SHOW: "noShowAt",
})

export function isReservationStatus(value: unknown): value is ReservationStatusValue {
    return typeof value === "string" && (RESERVATION_STATUSES as readonly string[]).includes(value)
}
