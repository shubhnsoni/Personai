/**
 * Appointment lifecycle rules — the SINGLE SOURCE OF TRUTH for appointment status.
 *
 * A pure module: no Prisma, no I/O, no database import, so every transition can be
 * exhaustively tested without touching a database.
 *
 * WHY THIS FILE OWNS THE VOCABULARY
 * `Booking.status` is a `text` column, not a Prisma enum. It is `text NOT NULL` in the
 * live schema with real data in it, so converting it would have been a breaking change
 * rather than an additive one (see 20260829010000_appointments_foundation). The column
 * therefore accepts any string at the database level, and this module is what makes the
 * vocabulary real by validating on the way in.
 *
 * ALIGNMENT CONTRACT — read before editing OCCUPYING_STATUSES
 * `OCCUPYING_STATUSES` below MUST match the status list in the partial predicate of the
 * `Booking_resource_no_overlap` exclusion constraint:
 *
 *     WHERE ("resourceId" IS NOT NULL
 *            AND "status" IN ('PENDING_PAYMENT','HELD','CONFIRMED','CHECKED_IN'))
 *
 * If the two drift, the database and the application disagree about what a conflict is:
 * a status the app treats as occupying but the constraint ignores could be
 * double-booked by a direct SQL writer, and a status the constraint treats as occupying
 * but the app ignores would produce surprising 23P01 errors. A harness asserts the two
 * lists agree, so drift fails a test rather than reaching production.
 */

export const APPOINTMENT_STATUSES = [
    "PENDING_PAYMENT",
    "HELD",
    "CONFIRMED",
    "CHECKED_IN",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "EXPIRED",
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

/** No further transition is permitted from these. */
export const TERMINAL_STATUSES: readonly AppointmentStatus[] = Object.freeze([
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "EXPIRED",
])

/**
 * Statuses that hold the resource and therefore participate in conflict detection.
 * MUST stay in step with the exclusion constraint predicate — see the header.
 */
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = Object.freeze([
    "PENDING_PAYMENT",
    "HELD",
    "CONFIRMED",
    "CHECKED_IN",
])

const ALLOWED_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = Object.freeze({
    PENDING_PAYMENT: Object.freeze(["HELD", "CONFIRMED", "CANCELLED", "EXPIRED"] as const),
    HELD: Object.freeze(["CONFIRMED", "CANCELLED", "EXPIRED"] as const),
    CONFIRMED: Object.freeze(["CHECKED_IN", "CANCELLED", "NO_SHOW"] as const),
    CHECKED_IN: Object.freeze(["COMPLETED", "NO_SHOW"] as const),
    COMPLETED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
    NO_SHOW: Object.freeze([] as const),
    EXPIRED: Object.freeze([] as const),
})

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
    return typeof value === "string" && (APPOINTMENT_STATUSES as readonly string[]).includes(value)
}

export function isTerminal(status: AppointmentStatus): boolean {
    return TERMINAL_STATUSES.includes(status)
}

export function occupiesResource(status: AppointmentStatus): boolean {
    return OCCUPYING_STATUSES.includes(status)
}

export function allowedTransitionsFrom(status: AppointmentStatus): readonly AppointmentStatus[] {
    return ALLOWED_TRANSITIONS[status] ?? Object.freeze([])
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
    return allowedTransitionsFrom(from).includes(to)
}

/** The column that records each milestone, so the engine holds no second copy. */
export const TRANSITION_TIMESTAMP_FIELD: Readonly<
    Partial<Record<AppointmentStatus, "confirmedAt" | "checkedInAt" | "completedAt" | "cancelledAt" | "noShowAt">>
> = Object.freeze({
    CONFIRMED: "confirmedAt",
    CHECKED_IN: "checkedInAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
    NO_SHOW: "noShowAt",
})

// ---------------------------------------------------------------------------
// Deposit lifecycle
// ---------------------------------------------------------------------------

export const DEPOSIT_STATES = [
    "NONE",
    "REQUIRED",
    "AUTHORIZED",
    "CAPTURED",
    "REFUNDED",
    "FORFEITED",
    "FAILED",
] as const

export type DepositState = (typeof DEPOSIT_STATES)[number]

const ALLOWED_DEPOSIT_TRANSITIONS: Readonly<Record<DepositState, readonly DepositState[]>> = Object.freeze({
    NONE: Object.freeze(["REQUIRED"] as const),
    REQUIRED: Object.freeze(["AUTHORIZED", "FAILED", "NONE"] as const),
    AUTHORIZED: Object.freeze(["CAPTURED", "REFUNDED", "FORFEITED", "FAILED"] as const),
    CAPTURED: Object.freeze(["REFUNDED", "FORFEITED"] as const),
    REFUNDED: Object.freeze([] as const),
    FORFEITED: Object.freeze([] as const),
    FAILED: Object.freeze(["REQUIRED"] as const),
})

export function canTransitionDeposit(from: DepositState, to: DepositState): boolean {
    return (ALLOWED_DEPOSIT_TRANSITIONS[from] ?? []).includes(to)
}

export function allowedDepositTransitionsFrom(from: DepositState): readonly DepositState[] {
    return ALLOWED_DEPOSIT_TRANSITIONS[from] ?? Object.freeze([])
}

export function isDepositState(value: unknown): value is DepositState {
    return typeof value === "string" && (DEPOSIT_STATES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Waitlist lifecycle
// ---------------------------------------------------------------------------

export const WAITLIST_STATUSES = ["WAITING", "OFFERED", "CONVERTED", "EXPIRED", "CANCELLED"] as const

export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number]

const ALLOWED_WAITLIST_TRANSITIONS: Readonly<Record<WaitlistStatus, readonly WaitlistStatus[]>> = Object.freeze({
    WAITING: Object.freeze(["OFFERED", "CANCELLED", "EXPIRED"] as const),
    OFFERED: Object.freeze(["CONVERTED", "EXPIRED", "CANCELLED"] as const),
    CONVERTED: Object.freeze([] as const),
    EXPIRED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

export function canTransitionWaitlist(from: WaitlistStatus, to: WaitlistStatus): boolean {
    return (ALLOWED_WAITLIST_TRANSITIONS[from] ?? []).includes(to)
}

export function isWaitlistStatus(value: unknown): value is WaitlistStatus {
    return typeof value === "string" && (WAITLIST_STATUSES as readonly string[]).includes(value)
}
