/**
 * fieldJobs lifecycle tables (Wave G4). Pure data, no imports, no I/O - so a client component can
 * import a transition table without pulling Prisma or Clerk.
 *
 * Three state machines, because there are three things with independent lives: the REQUEST
 * somebody sent in, the JOB somebody committed to, and each ASSIGNMENT a technician was given.
 * An assignment can be declined without the job changing, and a request can be declined without a
 * job ever existing.
 */

export const REQUEST_STATUSES = ["NEW", "QUALIFYING", "QUOTED", "ACCEPTED", "DECLINED", "CONVERTED"] as const
export type RequestStatusValue = (typeof REQUEST_STATUSES)[number]

const REQUEST_TRANSITIONS: Readonly<Record<RequestStatusValue, readonly RequestStatusValue[]>> = Object.freeze({
    NEW: Object.freeze(["QUALIFYING", "DECLINED"] as const),
    // QUALIFYING can reach ACCEPTED directly, because not every job needs a quote - a callout on
    // a published rate does not.
    QUALIFYING: Object.freeze(["QUOTED", "ACCEPTED", "DECLINED"] as const),
    QUOTED: Object.freeze(["ACCEPTED", "DECLINED"] as const),
    ACCEPTED: Object.freeze(["CONVERTED", "DECLINED"] as const),
    DECLINED: Object.freeze([] as const),
    CONVERTED: Object.freeze([] as const),
})

/** Only an ACCEPTED request may become a job. */
export const CONVERTIBLE_REQUEST_STATUSES: readonly RequestStatusValue[] = Object.freeze(["ACCEPTED"])
/** A quote may only be attached while the request is still being worked out. */
export const QUOTABLE_REQUEST_STATUSES: readonly RequestStatusValue[] = Object.freeze(["QUALIFYING", "QUOTED"])

export const JOB_STATUSES = ["DRAFT", "SCHEDULED", "DISPATCHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const
export type JobStatusValue = (typeof JOB_STATUSES)[number]

const JOB_TRANSITIONS: Readonly<Record<JobStatusValue, readonly JobStatusValue[]>> = Object.freeze({
    DRAFT: Object.freeze(["SCHEDULED", "CANCELLED"] as const),
    // SCHEDULED can go back to DRAFT, because un-scheduling is a normal thing an owner does when
    // a customer moves. DISPATCHED cannot: a technician has already been told.
    SCHEDULED: Object.freeze(["DRAFT", "DISPATCHED", "CANCELLED"] as const),
    DISPATCHED: Object.freeze(["IN_PROGRESS", "CANCELLED"] as const),
    // A job in progress can still be cancelled - work does get abandoned - but it cannot go back
    // to DISPATCHED, because somebody was already on site.
    IN_PROGRESS: Object.freeze(["COMPLETED", "CANCELLED"] as const),
    COMPLETED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
})

/** A job cannot be dispatched without a schedule; dispatching an undated job tells nobody when. */
export const SCHEDULE_REQUIRED_JOB_STATUSES: readonly JobStatusValue[] = Object.freeze(["SCHEDULED", "DISPATCHED"])
/** A job cannot be dispatched without an accountable technician. */
export const LEAD_REQUIRED_JOB_STATUSES: readonly JobStatusValue[] = Object.freeze(["DISPATCHED"])
/** Work cannot start until somebody is actually on site. */
export const ON_SITE_REQUIRED_JOB_STATUSES: readonly JobStatusValue[] = Object.freeze(["IN_PROGRESS"])
/** A job is not complete while a technician is still mid-visit. */
export const ALL_DONE_REQUIRED_JOB_STATUSES: readonly JobStatusValue[] = Object.freeze(["COMPLETED"])

export const JOB_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const
export type JobPriorityValue = (typeof JOB_PRIORITIES)[number]

export const ASSIGNMENT_ROLES = ["LEAD", "HELPER"] as const
export type AssignmentRoleValue = (typeof ASSIGNMENT_ROLES)[number]

export const ASSIGNMENT_STATES = [
    "ASSIGNED",
    "ACCEPTED",
    "DECLINED",
    "EN_ROUTE",
    "ON_SITE",
    "COMPLETED",
    "RELEASED",
] as const
export type AssignmentStateValue = (typeof ASSIGNMENT_STATES)[number]

const ASSIGNMENT_TRANSITIONS: Readonly<Record<AssignmentStateValue, readonly AssignmentStateValue[]>> = Object.freeze({
    // An assignment is a REQUEST until the technician answers it, which is why ACCEPTED and
    // DECLINED both exist. Recording only ASSIGNED would make a silent refusal look like
    // agreement.
    ASSIGNED: Object.freeze(["ACCEPTED", "DECLINED", "RELEASED"] as const),
    ACCEPTED: Object.freeze(["EN_ROUTE", "RELEASED"] as const),
    EN_ROUTE: Object.freeze(["ON_SITE", "RELEASED"] as const),
    ON_SITE: Object.freeze(["COMPLETED", "RELEASED"] as const),
    DECLINED: Object.freeze([] as const),
    COMPLETED: Object.freeze([] as const),
    RELEASED: Object.freeze([] as const),
})

/** States in which an assignment still counts as live for the one-lead and one-per-job rules. */
export const ACTIVE_ASSIGNMENT_STATES: readonly AssignmentStateValue[] = Object.freeze([
    "ASSIGNED",
    "ACCEPTED",
    "EN_ROUTE",
    "ON_SITE",
    "COMPLETED",
])
/** States that must carry an explanation. An unexplained refusal reads as a mistake later. */
export const REASON_REQUIRED_ASSIGNMENT_STATES: readonly AssignmentStateValue[] = Object.freeze(["DECLINED", "RELEASED"])
/** The technician is physically at the site from here on. */
export const ON_SITE_ASSIGNMENT_STATES: readonly AssignmentStateValue[] = Object.freeze(["ON_SITE", "COMPLETED"])

function make<T extends string>(table: Readonly<Record<T, readonly T[]>>, all: readonly T[]) {
    return {
        all,
        allowedFrom: (from: T): readonly T[] => table[from] ?? Object.freeze([]),
        can: (from: T, to: T): boolean => (table[from] ?? []).includes(to),
        isTerminal: (from: T): boolean => (table[from] ?? []).length === 0,
        is: (value: unknown): value is T => typeof value === "string" && (all as readonly string[]).includes(value),
    }
}

export const requestFlow = make<RequestStatusValue>(REQUEST_TRANSITIONS, REQUEST_STATUSES)
export const jobFlow = make<JobStatusValue>(JOB_TRANSITIONS, JOB_STATUSES)
export const assignmentFlow = make<AssignmentStateValue>(ASSIGNMENT_TRANSITIONS, ASSIGNMENT_STATES)

export function isJobPriority(value: unknown): value is JobPriorityValue {
    return typeof value === "string" && (JOB_PRIORITIES as readonly string[]).includes(value)
}
export function isAssignmentRole(value: unknown): value is AssignmentRoleValue {
    return typeof value === "string" && (ASSIGNMENT_ROLES as readonly string[]).includes(value)
}

/** Timestamp column set when a job reaches a given status. */
export const JOB_TIMESTAMP_FIELD: Readonly<
    Partial<Record<JobStatusValue, "dispatchedAt" | "startedAt" | "completedAt" | "cancelledAt">>
> = Object.freeze({
    DISPATCHED: "dispatchedAt",
    IN_PROGRESS: "startedAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
})

/** Timestamp column set when an assignment reaches a given state. */
export const ASSIGNMENT_TIMESTAMP_FIELD: Readonly<
    Partial<Record<AssignmentStateValue, "respondedAt" | "enRouteAt" | "onSiteAt" | "completedAt" | "releasedAt">>
> = Object.freeze({
    ACCEPTED: "respondedAt",
    DECLINED: "respondedAt",
    EN_ROUTE: "enRouteAt",
    ON_SITE: "onSiteAt",
    COMPLETED: "completedAt",
    RELEASED: "releasedAt",
})
