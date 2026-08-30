import type { PrismaClient } from "@prisma/client"

/** Exactly the persisted cohort models this classifier reads. */
export const COHORT_NEEDS_ACTION_COVERAGE = [
    "Cohort",
    "CohortMembership",
    "CohortSession",
    "CohortAttendance",
    "CohortAssignment",
    "CohortSubmission",
    "CohortCertificate",
] as const
export type CohortNeedsActionModel = (typeof COHORT_NEEDS_ACTION_COVERAGE)[number]

/** Cohort concerns deliberately outside this owner-attention declaration. */
export const COHORT_NEEDS_ACTION_NOT_COVERED: Readonly<Record<string, string>> = Object.freeze({
    learnerWork:
        "Draft, returned and rejected submissions remain with the learner until they are submitted again; they are not owner work.",
    missingAttendance:
        "The absence of an attendance row is not classified because the cohort engine does not declare whether it means unrecorded or not applicable.",
    inProgressAttendance:
        "Attendance on an in-progress session remains correctable; only a held session makes an absence a final exception.",
    renewalDelivery:
        "Reminder execution belongs to the linked TaskJob; this declaration reads renewal state and never performs delivery.",
    certificateEligibility:
        "Eligibility computation remains in CohortProgressService; this declaration only consumes the persisted ELIGIBLE judgement.",
})

/** Cohort records are owned by Profile and are therefore resolved on profileId. */
export const COHORT_NEEDS_ACTION_SCOPE = "profile" as const
export const COHORT_NEEDS_ACTION_DOMAIN = "cohortTasks" as const

export type CohortNeedsActionReason =
    | "assignment-submitted"
    | "attendance-absent"
    | "renewal-marked-scheduled"
    | "renewal-reminded"
    | "renewal-lapsed"
    | "certificate-eligible"

/** Structurally consumable as an operations AttentionItem once cohortTasks joins its domain union. */
export type CohortNeedsActionItem = Readonly<{
    domain: typeof COHORT_NEEDS_ACTION_DOMAIN
    id: string
    reason: CohortNeedsActionReason
    label: string
    at: Date | null
    overdue: boolean
}>

type CohortNeedsActionDb = Pick<
    PrismaClient,
    | "cohort"
    | "cohortMembership"
    | "cohortSession"
    | "cohortAttendance"
    | "cohortAssignment"
    | "cohortSubmission"
    | "cohortCertificate"
>

function isPast(at: Date | null, asOf: Date): boolean {
    return at !== null && at.getTime() < asOf.getTime()
}

function item(
    id: string,
    reason: CohortNeedsActionReason,
    label: string,
    at: Date | null,
    asOf: Date,
    stateOverdue = false,
): CohortNeedsActionItem {
    return Object.freeze({
        domain: COHORT_NEEDS_ACTION_DOMAIN,
        id,
        reason,
        label,
        at,
        overdue: stateOverdue || isPast(at, asOf),
    })
}

/**
 * Purely classifies persisted cohort state for one profile. It writes nothing and has no
 * adapter side effects. State ownership stays here so consumers do not reinterpret it.
 */
export async function resolveCohortNeedsAction(
    db: CohortNeedsActionDb,
    profileId: string,
    asOf: Date = new Date(),
): Promise<readonly CohortNeedsActionItem[]> {
    const cohorts = await db.cohort.findMany({
        where: { profileId, status: { not: "CANCELLED" } },
        select: { id: true, title: true },
    })
    const cohortById = new Map(cohorts.map((row) => [row.id, row] as const))
    const cohortIds = [...cohortById.keys()]

    const [memberships, sessions, assignments] = await Promise.all([
        db.cohortMembership.findMany({
            where: { cohortId: { in: cohortIds } },
            select: {
                id: true,
                cohortId: true,
                status: true,
                renewalState: true,
                renewalDueAt: true,
            },
        }),
        db.cohortSession.findMany({
            where: { cohortId: { in: cohortIds } },
            select: { id: true, cohortId: true, title: true, status: true, endsAt: true, heldAt: true },
        }),
        db.cohortAssignment.findMany({
            where: { cohortId: { in: cohortIds } },
            select: { id: true, cohortId: true, title: true, dueAt: true },
        }),
    ])

    const membershipById = new Map(memberships.map((row) => [row.id, row] as const))
    const sessionById = new Map(sessions.map((row) => [row.id, row] as const))
    const assignmentById = new Map(assignments.map((row) => [row.id, row] as const))
    const membershipIds = [...membershipById.keys()]

    const [attendance, submissions, certificates] = await Promise.all([
        db.cohortAttendance.findMany({
            where: { membershipId: { in: membershipIds }, sessionId: { in: [...sessionById.keys()] } },
            select: { id: true, membershipId: true, sessionId: true, status: true },
        }),
        db.cohortSubmission.findMany({
            where: { membershipId: { in: membershipIds }, assignmentId: { in: [...assignmentById.keys()] } },
            select: { id: true, membershipId: true, assignmentId: true, state: true, submittedAt: true },
        }),
        db.cohortCertificate.findMany({
            where: { membershipId: { in: membershipIds } },
            select: { id: true, membershipId: true, state: true, updatedAt: true },
        }),
    ])

    const activeMembership = (id: string): boolean => {
        const status = membershipById.get(id)?.status
        return status !== undefined && status !== "COMPLETED" && status !== "WITHDRAWN"
    }
    const items: CohortNeedsActionItem[] = []

    for (const submission of submissions) {
        const assignment = assignmentById.get(submission.assignmentId)
        if (!assignment || submission.state !== "SUBMITTED" || !activeMembership(submission.membershipId)) continue
        const cohort = cohortById.get(assignment.cohortId)
        if (!cohort) continue
        items.push(
            item(
                submission.id,
                "assignment-submitted",
                `${assignment.title} in ${cohort.title} is awaiting review`,
                submission.submittedAt,
                asOf,
            ),
        )
    }

    for (const row of attendance) {
        const session = sessionById.get(row.sessionId)
        if (!session || session.status !== "HELD" || row.status !== "ABSENT" || !activeMembership(row.membershipId)) continue
        const cohort = cohortById.get(session.cohortId)
        if (!cohort) continue
        items.push(
            item(
                row.id,
                "attendance-absent",
                `Absence recorded for ${session.title} in ${cohort.title}`,
                session.heldAt ?? session.endsAt,
                asOf,
            ),
        )
    }

    for (const membership of memberships) {
        if (!activeMembership(membership.id)) continue
        const cohort = cohortById.get(membership.cohortId)
        if (!cohort) continue
        if (membership.renewalState === "SCHEDULED") {
            /*
             * REPORTING A RECORD'S OWN STATE, AND SAYING WHOSE STATE IT IS.
             *
             * The reason was "renewal-scheduled" and the label "Renewal is scheduled for a member of X".
             * Both are copied verbatim by the operations due-work preview and rendered to an owner, so
             * they are owner-facing copy authored here rather than internal tokens.
             *
             * WHICH CLAIM IS THIS? It is a report of persisted state. renewalState is SCHEDULED because
             * somebody called `scheduleRenewal` with a due date - see workflow.ts - and renewalDueAt is
             * that date. Saying so is TRUE and it is what the owner needs. It is NOT this platform
             * claiming it arranged a delivery: reaching REMINDED is what asserts a real reminder exists,
             * and TASK_REQUIRED_RENEWAL_STATES in lifecycle.ts makes that state unreachable without a
             * linked TaskJob. At SCHEDULED there may be no reminder row at all, and delivery is declared
             * out of scope by COHORT_NEEDS_ACTION_NOT_COVERED.renewalDelivery above.
             *
             * So the fix is attribution, not suppression. "Renewal is scheduled" is passive with no
             * holder named, and in a list a platform rendered that reads as the platform having
             * scheduled it - the reading that makes an owner stop checking something nothing is going to
             * act on. "Renewal is marked scheduled" names the record as the holder of the state, so the
             * same fact survives and the misreading does not. The reason token carries the same marker
             * because the operations panel renders it verbatim as an item's attention reason.
             *
             * The rule this follows, and the harness that enforces it, are in
             * src/lib/operations/due-work-preview-types.ts under THE NARROWING.
             */
            items.push(
                item(
                    membership.id,
                    "renewal-marked-scheduled",
                    `Renewal is marked scheduled for a member of ${cohort.title}`,
                    membership.renewalDueAt,
                    asOf,
                ),
            )
        } else if (membership.renewalState === "REMINDED") {
            items.push(
                item(
                    membership.id,
                    "renewal-reminded",
                    `Renewal reminder is outstanding for a member of ${cohort.title}`,
                    membership.renewalDueAt,
                    asOf,
                ),
            )
        } else if (membership.renewalState === "LAPSED") {
            items.push(
                item(
                    membership.id,
                    "renewal-lapsed",
                    `Renewal has lapsed for a member of ${cohort.title}`,
                    membership.renewalDueAt,
                    asOf,
                    true,
                ),
            )
        }
    }

    for (const certificate of certificates) {
        if (certificate.state !== "ELIGIBLE") continue
        const membership = membershipById.get(certificate.membershipId)
        const cohort = membership ? cohortById.get(membership.cohortId) : undefined
        if (!cohort) continue
        items.push(
            item(
                certificate.id,
                "certificate-eligible",
                `Certificate is eligible to issue for ${cohort.title}`,
                certificate.updatedAt,
                asOf,
            ),
        )
    }

    return Object.freeze(
        items.sort((a, b) => {
            const aTime = a.at?.getTime() ?? Number.POSITIVE_INFINITY
            const bTime = b.at?.getTime() ?? Number.POSITIVE_INFINITY
            return aTime - bTime || a.reason.localeCompare(b.reason) || a.id.localeCompare(b.id)
        }),
    )
}
