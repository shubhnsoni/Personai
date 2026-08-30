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

/**
 * THE SORT CHAIN, PUBLISHED AS DATA BECAUSE A CONSUMER INHERITS IT.
 *
 * This function returns a TOTAL order and the operations view's cohortTasks reader depends on that: it
 * applies its own per-domain cap with `declared.slice(0, MAX_ITEMS_PER_DOMAIN)` and deliberately does
 * not re-sort, because a second opinion about cohort priority is the one thing that reader exists not to
 * have. An inherited guarantee that lives only in a comment lapses silently, so the chain is published
 * here and asserted from this list rather than from a regex over this file's text.
 *
 * WHY IT IS TOTAL, with every clause load-bearing:
 *   - `at` first, so the earliest work leads and undated work sorts last.
 *   - `reason` second, which separates items sharing one timestamp - notably a whole cohort's absences
 *     against one HELD session, every one of which carries that session's heldAt.
 *   - `id` LAST and only last. Every id emitted below is the primary key of exactly one row of exactly
 *     one table, and the membership branch is if/else-if so one membership cannot emit two items. No two
 *     items can therefore share an id, and the chain cannot end in a tie.
 */
export const COHORT_NEEDS_ACTION_SORT_KEYS = ["at", "reason", "id"] as const

/**
 * THE READS ARE UNBOUNDED. THAT IS A DECLARED GAP, NOT AN OVERSIGHT.
 *
 * Commit 92d6005 bounded every reader in operations/engine.ts in the database, and its harness asserts
 * that "every reader is bounded IN THE DATABASE by take, so none fetches a whole table to show twenty
 * rows". That assertion counts `.findMany(` in engine.ts ALONE, so it never covered this file - and this
 * file is the ninth domain that view reports. The claim has been narrowed to what it measures, and this
 * gap is now asserted from the count below, so it can be neither silently widened nor silently closed.
 *
 * WHY NO `take` IS APPLIED HERE. The inventory lesson recorded in engine.ts is that bounding a query
 * without moving the DECIDING comparison into SQL does not return fewer of the right rows, it returns
 * the wrong rows. Four of the seven reads are index reads whose results build the `in` lists and the map
 * lookups the others depend on, so truncating them would drop items from categories they do not
 * themselves produce. For the three reads that do produce items, the deciding comparison cannot be
 * expressed in this query API at all:
 *
 *   - attendance sorts on `session.heldAt ?? session.endsAt`, a COALESCE across two columns of a
 *     RELATED table. `orderBy` cannot express it, so a bounded attendance read could not be ordered by
 *     the key that decides which rows belong in the answer.
 *   - memberships emit three different reasons from one read, and `reason` is the second sort key. In
 *     the database `renewalState` orders by enum declaration order - SCHEDULED, REMINDED, LAPSED - while
 *     the reason tokens order alphabetically as renewal-lapsed, renewal-marked-scheduled,
 *     renewal-reminded. The two disagree on every pair, and no `orderBy` maps one onto the other.
 *   - the final tie-break is `localeCompare`, which is ICU collation, while `ORDER BY id` is the
 *     column's collation. They agree on cuids and need not agree in general, so the row a database cap
 *     cut is not provably the row this comparator would have cut.
 *
 * Bounding here would also change what this function MEANS - from "all owner work for this profile" to
 * "at most N of it" - and the cap belongs to the consuming view, which declares it as
 * MAX_ITEMS_PER_DOMAIN and does not export it. That is an integration decision with an owner.
 *
 * WHAT WAS DONE INSTEAD. Every predicate that decides an item's presence from one table's own columns
 * now runs in the database, so each read fetches its candidate rows rather than every row in the
 * profile's history. Those are exactly the predicates the classification below applies, so the answer is
 * unchanged - the harness recomputes it from unfiltered reads and asserts the two sequences are
 * identical - and because a filter is not a cut it cannot drop a row the comparator would have kept.
 * This does not make the cost proportional to the answer, and it is not claimed to.
 */
export const COHORT_NEEDS_ACTION_UNBOUNDED_READS = Object.freeze({
    count: 7,
    reason:
        "Each read is a full read of its candidate set. Four are index reads feeding the other reads' `in` lists and map lookups; for the three that produce items the deciding comparison - a COALESCE across two columns of a related table, an enum-to-reason-token mapping, and ICU collation - cannot be expressed in orderBy, so a take would cut the wrong rows rather than fewer of the right ones.",
})

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
 * UNDATED WORK SORTS LAST, SAID DIRECTLY INSTEAD OF ARITHMETICALLY.
 *
 * This comparison used to map a null `at` to Number.POSITIVE_INFINITY and subtract. That ordered every
 * mixed pair correctly, but for two undated items it computed `Infinity - Infinity`, which is NaN. The
 * result was still right, and only because NaN is falsy: `||` fell through to `reason`. That is an
 * accident rather than a design, and a plausible tidy-up breaks it silently - `if (aTime !== bTime)
 * return aTime - bTime` reads as equivalent and would return NaN from the comparator, because NaN is the
 * one value that is not equal to itself.
 *
 * Two undated items are a live case, not a theoretical one: a SCHEDULED renewal with no renewalDueAt and
 * a SUBMITTED submission with no submittedAt both produce `at: null`, and both columns are nullable.
 * Naming the case removes the NaN and the infinity arithmetic together, and leaves the resulting order
 * identical to what the old form produced for every input.
 */
function compareAt(a: Date | null, b: Date | null): number {
    if (a === null) return b === null ? 0 : 1
    if (b === null) return -1
    return a.getTime() - b.getTime()
}

/** The chain COHORT_NEEDS_ACTION_SORT_KEYS publishes, and the total order the operations view inherits. */
function byAtThenReasonThenId(a: CohortNeedsActionItem, b: CohortNeedsActionItem): number {
    return compareAt(a.at, b.at) || a.reason.localeCompare(b.reason) || a.id.localeCompare(b.id)
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

    const activeMembership = (id: string): boolean => {
        const status = membershipById.get(id)?.status
        return status !== undefined && status !== "COMPLETED" && status !== "WITHDRAWN"
    }
    /*
     * THE SAME PREDICATES, ASKED OF THE DATABASE. See COHORT_NEEDS_ACTION_UNBOUNDED_READS.
     *
     * Each clause below is one the classification further down applies anyway, so nothing about the
     * answer changes; what changes is that a profile with ten years of reviewed submissions no longer
     * reads ten years of reviewed submissions to report this week's. These are FILTERS and not cuts,
     * which is what makes them safe without an ordering: a filter can only remove rows the comparator
     * would have discarded, whereas a `take` over an order the database was not asked for removes rows
     * the comparator would have kept.
     *
     * The narrowed `in` lists are the same reduction. Attendance is asked only about HELD sessions and
     * ACTIVE memberships because its branch requires both, so the full session and membership sets no
     * longer travel into the query.
     */
    const activeMembershipIds = membershipIds.filter((id) => activeMembership(id))
    const heldSessionIds = sessions.filter((row) => row.status === "HELD").map((row) => row.id)

    const [attendance, submissions, certificates] = await Promise.all([
        db.cohortAttendance.findMany({
            where: { membershipId: { in: activeMembershipIds }, sessionId: { in: heldSessionIds }, status: "ABSENT" },
            select: { id: true, membershipId: true, sessionId: true, status: true },
        }),
        db.cohortSubmission.findMany({
            where: {
                membershipId: { in: activeMembershipIds },
                assignmentId: { in: [...assignmentById.keys()] },
                state: "SUBMITTED",
            },
            select: { id: true, membershipId: true, assignmentId: true, state: true, submittedAt: true },
        }),
        /*
         * NOT narrowed to active memberships, and the asymmetry is the whole point of writing it out.
         * The certificate branch below is the one branch that does NOT require an active membership: a
         * COMPLETED membership holding an ELIGIBLE certificate is precisely outstanding issuance work,
         * so narrowing this read to active memberships would delete real items. Only the predicate this
         * read's own branch applies - state ELIGIBLE - moves into the database.
         */
        db.cohortCertificate.findMany({
            where: { membershipId: { in: membershipIds }, state: "ELIGIBLE" },
            select: { id: true, membershipId: true, state: true, updatedAt: true },
        }),
    ])
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

    return Object.freeze(items.sort(byAtThenReasonThenId))
}
