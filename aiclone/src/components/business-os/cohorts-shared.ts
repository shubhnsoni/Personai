/**
 * Shared view types and fetch helpers for the cohort console.
 *
 * These mirror the { ok, data } / { ok, error } envelope produced by
 * src/lib/cohorts/http.ts. The envelope contract is asserted by
 * scripts/one-off/check-cohort-routes.ts, so this client copy cannot drift silently.
 *
 * Nothing here fabricates a record. Every view type is a projection of a persisted row,
 * and an absent row is an empty list or null, never a sample.
 */

export type CohortView = Readonly<{
    id: string
    profileId: string
    courseId: string
    code: string
    title: string
    status: string
    timezone: string
    startsOn: string | null
    endsOn: string | null
    capacity: number | null
    attendanceThresholdPct: number
    requireAllAssignments: boolean
    requireAllLessons: boolean
    allowedTransitions: readonly string[]
    createdAt: string
    updatedAt: string
}>

export type MembershipView = Readonly<{
    id: string
    cohortId: string
    enrollmentId: string
    status: string
    joinedAt: string | null
    completedAt: string | null
    leftAt: string | null
    leaveReason: string | null
    renewalState: string
    renewalDueAt: string | null
    renewalRemindAt: string | null
    renewalTaskJobId: string | null
    allowedTransitions: readonly string[]
    enrollment: Readonly<{
        id: string
        visitorEmail: string
        visitorName: string | null
        memberId: string | null
        status: string
    }>
}>

export type SessionView = Readonly<{
    id: string
    ordinal: number
    title: string
    startsAt: string
    endsAt: string
    status: string
    locationId: string | null
    heldAt: string | null
    cancelReason: string | null
    allowedTransitions: readonly string[]
}>

export type AttendanceView = Readonly<{
    id: string
    sessionId: string
    membershipId: string
    status: string
    note: string | null
    recordedAt: string
}>

export type AssignmentView = Readonly<{
    id: string
    ordinal: number
    title: string
    instructions: string | null
    dueAt: string | null
    maxPoints: number
}>

export type SubmissionView = Readonly<{
    id: string
    assignmentId: string
    membershipId: string
    state: string
    documentId: string | null
    notes: string | null
    submittedAt: string | null
    reviewedAt: string | null
    reviewedBy: string | null
    points: number | null
    feedback: string | null
    allowedTransitions: readonly string[]
}>

export type CertificateView = Readonly<{
    id: string
    membershipId: string
    state: string
    serial: string | null
    issuedAt: string | null
    revokedAt: string | null
    reason: string | null
    documentId: string | null
    allowedTransitions: readonly string[]
}>

export type ProgressView = Readonly<{
    eligible: boolean
    reasons: readonly string[]
    lessons: Readonly<{ totalLessons: number; completedLessons: number; percent: number }>
    assignments: Readonly<{ totalAssignments: number; acceptedSubmissions: number; outstandingAssignments: number }>
    attendance: Readonly<{
        attendableSessions: number
        creditedSessions: number
        exemptSessions: number
        percent: number
    }>
    policy: Readonly<{
        attendanceThresholdPct: number
        requireAllAssignments: boolean
        requireAllLessons: boolean
    }>
}>

export type CohortEventView = Readonly<{
    id: string
    seq: string
    kind: string
    from: string | null
    to: string
    actor: string
    actorId: string | null
    at: string
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

export class CohortRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "CohortRequestError"
    }
}

export async function cohortRequest<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new CohortRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new CohortRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

export function isAbort(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError"
}

/**
 * A refusal an owner can act on is shown verbatim — a 409 here usually names the exact
 * unmet completion requirement, which is the most useful thing the screen can say. An
 * infrastructure failure is not shown, because its message would only leak internals. A
 * 403 is deliberately the same copy for a foreign cohort and a missing one, so the UI
 * does not become an enumerator.
 */
export function cohortErrorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof CohortRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Cohort access required",
                description: "This workspace does not grant you access to that cohort.",
            }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 409) return { title: "That change is not allowed yet", description: error.message }
        if (error.status === 503) {
            return {
                title: "Cohorts are unavailable",
                description: "Cohort storage is not responding. Nothing was changed.",
            }
        }
        return { title: "Cohorts could not load", description: error.message }
    }
    return {
        title: "Cohorts could not load",
        description: "An unexpected problem occurred. Nothing was changed.",
    }
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
