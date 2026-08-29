/**
 * Cohort lifecycle tables.
 *
 * Pure data plus total functions over it. This module imports nothing, so the same
 * tables the write boundary enforces can be imported by a client component without
 * dragging Prisma or Clerk into the browser bundle. That is what stops the UI from
 * offering a transition the server would refuse.
 *
 * Every table is exhaustive over its enum: each state has an entry, and a terminal
 * state has an explicitly empty list rather than a missing key.
 */

export const COHORT_STATUSES = ["PLANNED", "ENROLLING", "RUNNING", "COMPLETED", "CANCELLED"] as const
export type CohortStatusValue = (typeof COHORT_STATUSES)[number]

const COHORT_TRANSITIONS: Readonly<Record<CohortStatusValue, readonly CohortStatusValue[]>> = Object.freeze({
    PLANNED: Object.freeze(["ENROLLING", "CANCELLED"] as const),
    ENROLLING: Object.freeze(["RUNNING", "CANCELLED"] as const),
    RUNNING: Object.freeze(["COMPLETED", "CANCELLED"] as const),
    COMPLETED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

/** Only these cohort states accept new members. A finished batch cannot be joined. */
export const ENROLLABLE_COHORT_STATUSES: readonly CohortStatusValue[] = Object.freeze(["PLANNED", "ENROLLING", "RUNNING"])

export const MEMBERSHIP_STATUSES = ["INVITED", "ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN"] as const
export type MembershipStatusValue = (typeof MEMBERSHIP_STATUSES)[number]

const MEMBERSHIP_TRANSITIONS: Readonly<Record<MembershipStatusValue, readonly MembershipStatusValue[]>> =
    Object.freeze({
        INVITED: Object.freeze(["ACTIVE", "WITHDRAWN"] as const),
        ACTIVE: Object.freeze(["PAUSED", "COMPLETED", "WITHDRAWN"] as const),
        PAUSED: Object.freeze(["ACTIVE", "WITHDRAWN"] as const),
        COMPLETED: Object.freeze([] as const),
        WITHDRAWN: Object.freeze([] as const),
    })

/**
 * Completion is gated on the cohort's own published policy, evaluated against persisted
 * records. Marking a learner complete is a claim about them that outlives the cohort, so
 * it is not allowed to be optimistic.
 */
export const POLICY_GATED_MEMBERSHIP_STATUSES: readonly MembershipStatusValue[] = Object.freeze(["COMPLETED"])

export const SESSION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "HELD", "CANCELLED"] as const
export type SessionStatusValue = (typeof SESSION_STATUSES)[number]

const SESSION_TRANSITIONS: Readonly<Record<SessionStatusValue, readonly SessionStatusValue[]>> = Object.freeze({
    SCHEDULED: Object.freeze(["IN_PROGRESS", "CANCELLED"] as const),
    IN_PROGRESS: Object.freeze(["HELD", "CANCELLED"] as const),
    HELD: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

/**
 * Attendance may only be recorded for a session that has actually started. A SCHEDULED
 * session has not happened yet and a CANCELLED one never will, so attendance against
 * either would be a fabricated record.
 */
export const ATTENDABLE_SESSION_STATUSES: readonly SessionStatusValue[] = Object.freeze(["IN_PROGRESS", "HELD"])

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as const
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number]

/** Only these count towards an attendance threshold. EXCUSED is neither credit nor fault. */
export const ATTENDANCE_CREDITED: readonly AttendanceStatusValue[] = Object.freeze(["PRESENT", "LATE"])
export const ATTENDANCE_EXEMPT: readonly AttendanceStatusValue[] = Object.freeze(["EXCUSED"])

export const SUBMISSION_STATES = ["DRAFT", "SUBMITTED", "RETURNED", "ACCEPTED", "REJECTED"] as const
export type SubmissionStateValue = (typeof SUBMISSION_STATES)[number]

const SUBMISSION_TRANSITIONS: Readonly<Record<SubmissionStateValue, readonly SubmissionStateValue[]>> = Object.freeze({
    DRAFT: Object.freeze(["SUBMITTED"] as const),
    SUBMITTED: Object.freeze(["RETURNED", "ACCEPTED", "REJECTED"] as const),
    // Returned work goes back to the learner, who resubmits.
    RETURNED: Object.freeze(["SUBMITTED"] as const),
    REJECTED: Object.freeze(["SUBMITTED"] as const),
    ACCEPTED: Object.freeze([] as const),
})

/** SUBMITTED is the only state that requires something to actually have been handed in. */
export const ARTIFACT_REQUIRED_SUBMISSION_STATES: readonly SubmissionStateValue[] = Object.freeze(["SUBMITTED"])

export const CERTIFICATE_STATES = ["INELIGIBLE", "ELIGIBLE", "ISSUED", "REVOKED"] as const
export type CertificateStateValue = (typeof CERTIFICATE_STATES)[number]

const CERTIFICATE_TRANSITIONS: Readonly<Record<CertificateStateValue, readonly CertificateStateValue[]>> =
    Object.freeze({
        INELIGIBLE: Object.freeze(["ELIGIBLE"] as const),
        // A cohort policy change can withdraw eligibility that was never acted on.
        ELIGIBLE: Object.freeze(["ISSUED", "INELIGIBLE"] as const),
        ISSUED: Object.freeze(["REVOKED"] as const),
        REVOKED: Object.freeze([] as const),
    })

export const RENEWAL_STATES = ["NONE", "SCHEDULED", "REMINDED", "RENEWED", "LAPSED", "CANCELLED"] as const
export type RenewalStateValue = (typeof RENEWAL_STATES)[number]

const RENEWAL_TRANSITIONS: Readonly<Record<RenewalStateValue, readonly RenewalStateValue[]>> = Object.freeze({
    NONE: Object.freeze(["SCHEDULED"] as const),
    SCHEDULED: Object.freeze(["REMINDED", "RENEWED", "LAPSED", "CANCELLED"] as const),
    REMINDED: Object.freeze(["RENEWED", "LAPSED", "CANCELLED"] as const),
    // A renewed or lapsed membership can be put back on a renewal cycle.
    RENEWED: Object.freeze(["SCHEDULED"] as const),
    LAPSED: Object.freeze(["SCHEDULED"] as const),
    CANCELLED: Object.freeze([] as const),
})

/**
 * REMINDED asserts that a reminder was really queued, so it requires a linked TaskJob.
 * Without that rule the state would be a claim with nothing behind it.
 */
export const TASK_REQUIRED_RENEWAL_STATES: readonly RenewalStateValue[] = Object.freeze(["REMINDED"])

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

export const cohortFlow = make<CohortStatusValue>(COHORT_TRANSITIONS, COHORT_STATUSES)
export const membershipFlow = make<MembershipStatusValue>(MEMBERSHIP_TRANSITIONS, MEMBERSHIP_STATUSES)
export const sessionFlow = make<SessionStatusValue>(SESSION_TRANSITIONS, SESSION_STATUSES)
export const submissionFlow = make<SubmissionStateValue>(SUBMISSION_TRANSITIONS, SUBMISSION_STATES)
export const certificateFlow = make<CertificateStateValue>(CERTIFICATE_TRANSITIONS, CERTIFICATE_STATES)
export const renewalFlow = make<RenewalStateValue>(RENEWAL_TRANSITIONS, RENEWAL_STATES)

export function isAttendanceStatus(value: unknown): value is AttendanceStatusValue {
    return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value)
}

/** Timestamp column set when a cohort reaches a given status. */
export const COHORT_TIMESTAMP_FIELD: Readonly<Partial<Record<CohortStatusValue, "startsOn" | "endsOn">>> =
    Object.freeze({})

/** Timestamp column set when a membership reaches a given status. */
export const MEMBERSHIP_TIMESTAMP_FIELD: Readonly<
    Partial<Record<MembershipStatusValue, "joinedAt" | "completedAt" | "leftAt">>
> = Object.freeze({
    ACTIVE: "joinedAt",
    COMPLETED: "completedAt",
    WITHDRAWN: "leftAt",
})
