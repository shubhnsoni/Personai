/**
 * Unified daily operations: one tenant-scoped answer to "what needs attention today".
 *
 * READ-ONLY BY CONSTRUCTION. This engine contains no `create`, `update`, `delete` or `upsert` call
 * of any kind, and a harness asserts that textually rather than trusting the reader. It exists
 * because an owner running six engines currently has to open six panels to find out whether anything
 * is waiting, and "nothing is waiting" is the answer they need most often and can get least easily.
 *
 * IT ADDS NO SCHEMA AND NO STATE. Every figure below is derived from records another engine already
 * owns and already validates. There is deliberately no `OperationsSnapshot` table: a cached summary
 * would be a second source of truth that could disagree with the first, and the disagreement would
 * surface as an owner being told to act on something that is already handled.
 *
 * WHAT IT DOES NOT DO, so the word "operations" does not carry more than it should:
 *
 *   No scheduler, no cron, no queue. Nothing here runs on a timer, and nothing processes due work.
 *   The directive this was built under asked for idempotent due-work processing too; that is NOT in
 *   this file, and claiming a scheduler exists without real execution evidence is exactly the kind of
 *   thing this program has repeatedly refused to do.
 *
 *   No notification, email, SMS or push. It answers a question when asked; it tells nobody anything.
 *
 *   No writes, so no side effects: reading this view cannot mark anything as seen, acknowledged or
 *   handled, and therefore cannot lose work.
 *
 * COVERAGE IS DECLARED, NOT IMPLIED. `OPERATIONS_DOMAINS` names exactly the domains this reads, and a
 * harness asserts the declared list matches what the code actually queries. A view that silently
 * omitted a domain would be worse than no view at all, because an owner would trust it and stop
 * checking. Domains deliberately NOT covered yet are listed in `UNCOVERED_DOMAINS` with the reason.
 */
import { PersistenceError } from "../persistence/errors"
import {
    COHORT_NEEDS_ACTION_DOMAIN,
    COHORT_NEEDS_ACTION_NOT_COVERED,
    COHORT_NEEDS_ACTION_SCOPE,
    resolveCohortNeedsAction,
} from "../cohorts/needs-action"
import type { OperationsContext } from "./shared"

/** Exactly the domains read below. Asserted against the implementation by a harness. */
export const OPERATIONS_DOMAINS = [
    "reservations",
    "appointments",
    "fieldJobs",
    "inspections",
    "inventory",
    "fulfilments",
    "returns",
    "caseMilestones",
    "cohortTasks",
] as const
export type OperationsDomain = (typeof OPERATIONS_DOMAINS)[number]

/**
 * WHICH TENANT BOUNDARY EACH DOMAIN IS READ ON, reported rather than implied.
 *
 * This is not bookkeeping. Most engines here are profile-scoped, but CaseProject is scoped by
 * workspaceId, and a profile can own several workspaces. So for an owner with two workspaces, the
 * field-job count is profile-wide while the case-milestone count is only this workspace's.
 *
 * Presenting one total over two different boundaries without saying so would be exactly the kind of
 * quiet inconsistency that makes somebody stop trusting a dashboard - they would notice the numbers
 * not adding up against another screen and have no way to find out why. Stating the scope per domain
 * turns a trap into a fact.
 */
export const OPERATIONS_DOMAIN_SCOPE: Readonly<Record<OperationsDomain, "profile" | "workspace">> = Object.freeze({
    reservations: "profile",
    appointments: "profile",
    fieldJobs: "profile",
    inspections: "profile",
    inventory: "profile",
    fulfilments: "profile",
    returns: "profile",
    // CaseProject carries workspaceId, not profileId.
    caseMilestones: "workspace",
    // Cohort carries profileId. The scope is declared by the cohort engine itself as
    // COHORT_NEEDS_ACTION_SCOPE, and asserted equal to this entry, so the two cannot drift.
    cohortTasks: "profile",
})

/**
 * Domains an owner might reasonably expect here and which are deliberately absent, with the reason.
 * Listed rather than omitted, because an unexplained gap reads as an oversight and gets "fixed"
 * badly by the next person.
 */
export const UNCOVERED_DOMAINS: Readonly<Record<string, string>> = Object.freeze({
    durableTasks:
        "The shared TaskJob queue has its own surface and its own notion of overdue. Restating it here " +
        "would create a second answer to the same question.",
    ...COHORT_NEEDS_ACTION_NOT_COVERED,
})

/** One thing waiting, in a shape that does not pretend to be the underlying record. */
export type AttentionItem = Readonly<{
    domain: OperationsDomain
    /** The id of the record in ITS OWN domain, so a caller can open it there. */
    id: string
    /** Why it is here. Stable enough to group on. */
    reason: string
    /** Owner-facing summary. Never fabricated - always derived from a persisted field. */
    label: string
    /** When it is due or became due, when the domain has such a notion. */
    at: Date | null
    /** True when `at` is in the past. Computed once against a single clock reading. */
    overdue: boolean
}>

export type DomainSummary = Readonly<{
    domain: OperationsDomain
    /** How many records in this domain need attention. */
    count: number
    /** How many of those are already overdue. */
    overdue: number
    /** Which tenant boundary this count was read on. See OPERATIONS_DOMAIN_SCOPE. */
    scope: "profile" | "workspace"
}>

export type OperationsSummary = Readonly<{
    /** The single clock reading every comparison in this response was made against. */
    asOf: Date
    /** Horizon used for "upcoming", in hours. */
    horizonHours: number
    profileId: string
    /** The workspace whose access was authorised, and the boundary workspace-scoped domains use. */
    workspaceId: string
    domains: readonly DomainSummary[]
    items: readonly AttentionItem[]
    total: number
    totalOverdue: number
    /** Declared coverage, so a caller can tell what this number is a total OF. */
    covers: readonly OperationsDomain[]
    /** Stated absences, so a caller does not read silence as "nothing there". */
    doesNotCover: Readonly<Record<string, string>>
    /**
     * True when the covered domains do NOT all share one tenant boundary. A caller that renders a
     * single total should say so when this is true.
     *
     * CONSTANT-TRUE TODAY. It is derived from the frozen OPERATIONS_DOMAIN_SCOPE map rather than from the
     * rows that were read, so it is a static property of this view's declared coverage and not an
     * observation about any workspace's data. See the computation in `summary` below.
     */
    mixedScope: boolean
}>

const DEFAULT_HORIZON_HOURS = 24
const MAX_HORIZON_HOURS = 24 * 14
const MAX_ITEMS_PER_DOMAIN = 20

/**
 * WHY EVERY READER BELOW ENDS ITS `orderBy` ON `id`.
 *
 * Each domain orders by a business key - a start time, a due date, a stock level - and none of those
 * keys is unique. Twelve reservations can share one start time; a whole warehouse can sit at onHand 0.
 * `ORDER BY` on a non-unique key leaves the order of tied rows undefined, so the database is free to
 * return them differently on two identical requests, and it does not have to change anything for that
 * to happen: a different plan, a different worker or a different physical row order is enough.
 *
 * Combined with `take`, that stops being cosmetic. When more rows tie than the cap admits, an undefined
 * order over the tied rows makes the CUT undefined too, so two identical requests can return a
 * different SET of items rather than merely a different arrangement of the same ones. An owner
 * refreshing this view would watch work appear and disappear with nothing having changed.
 *
 * `id` is the primary key, so appending it makes each ordering a TOTAL order and the result exactly
 * reproducible. It is appended LAST in every case, which is what makes it safe: it can only decide
 * between rows that the business keys have already declared equal, so it cannot move a row past one
 * the domain considers more urgent. The business ordering ahead of it - and therefore which rows the
 * cap keeps and which it drops - is unchanged.
 *
 * `id` is a cuid, so the tie-break is arbitrary rather than meaningful. That is the point: it is a
 * decision procedure for rows the domain has no preference between, not a claim that a lower id
 * matters more. The alternative to an arbitrary-but-stable rule here is not a meaningful rule, it is
 * no rule at all.
 */

/** Appointment statuses that still need somebody to do something. From appointments/lifecycle.ts. */
const APPOINTMENT_OPEN_STATUSES = ["PENDING_PAYMENT", "HELD", "CONFIRMED", "CHECKED_IN"] as const
/** Field-job statuses that mean the work is committed but not finished. */
const FIELD_JOB_OPEN_STATUSES = ["SCHEDULED", "DISPATCHED", "IN_PROGRESS"] as const
/** Inspection statuses that mean it is still open. */
const INSPECTION_OPEN_STATUSES = ["DRAFT", "IN_PROGRESS", "SUBMITTED"] as const

export class OperationsService {
    constructor(private readonly ctx: OperationsContext) {}

    /**
     * Everything waiting for this workspace's profile, as of one clock reading.
     *
     * The clock is read ONCE and passed down. Reading it per domain would let two figures in the same
     * response disagree about whether the same record is overdue, which is the sort of inconsistency
     * that makes an owner stop trusting a dashboard.
     */
    async summary(
        workspaceId: string,
        options: Readonly<{ horizonHours?: number | null }> = {},
    ): Promise<OperationsSummary> {
        const scope = await this.ctx.requireScope(workspaceId, "profile.read")
        const profileId = scope.profileId

        const horizonHours = options.horizonHours ?? DEFAULT_HORIZON_HOURS
        if (!Number.isInteger(horizonHours) || horizonHours <= 0 || horizonHours > MAX_HORIZON_HOURS) {
            throw new PersistenceError(
                "BAD_REQUEST",
                `horizonHours must be a whole number between 1 and ${MAX_HORIZON_HOURS}`,
                { field: "horizonHours" },
            )
        }

        const asOf = new Date()
        const until = new Date(asOf.getTime() + horizonHours * 3_600_000)

        const groups = await Promise.all([
            this.reservations(profileId, asOf, until),
            this.appointments(profileId, asOf, until),
            this.fieldJobs(profileId, asOf, until),
            this.inspections(profileId),
            this.inventory(profileId),
            this.fulfilments(profileId),
            this.returns(profileId),
            // Workspace-scoped, not profile-scoped. See OPERATIONS_DOMAIN_SCOPE.
            this.caseMilestones(scope.workspaceId, asOf, until),
            this.cohortTasks(profileId, asOf),
        ])

        const items = groups.flat()
        const domains: DomainSummary[] = OPERATIONS_DOMAINS.map((domain) => {
            const mine = items.filter((item) => item.domain === domain)
            return Object.freeze({
                domain,
                count: mine.length,
                overdue: mine.filter((item) => item.overdue).length,
                scope: OPERATIONS_DOMAIN_SCOPE[domain],
            })
        })

        // STATIC PROPERTY OF THE DECLARED COVERAGE LIST, NOT AN OBSERVATION ABOUT THE DATA.
        //
        // This reads OPERATIONS_DOMAIN_SCOPE, which is frozen at module load and always contains both
        // "profile" and "workspace" - caseMilestones is the workspace-scoped one. So the `scopes.size > 1`
        // below is true for every workspace, every profile and every dataset, including an empty one. It
        // is a fact about the list of domains this file declares, computed from a constant, and it carries
        // no information about the records that were actually read. Nothing derived from it should be
        // presented to an owner as something observed in their data.
        //
        // It is computed rather than hardcoded true because it must follow the coverage list: the day a
        // domain is added or removed the answer has to change with it, and a literal would not. A caller
        // rendering one total across these domains still has to say that the total spans two boundaries,
        // which is what this supports. Read it as "this view's declared coverage spans two tenant
        // boundaries", never as "your data spans two tenant boundaries".
        const scopes = new Set(OPERATIONS_DOMAINS.map((domain) => OPERATIONS_DOMAIN_SCOPE[domain]))

        return Object.freeze({
            asOf,
            horizonHours,
            profileId,
            workspaceId: scope.workspaceId,
            domains: Object.freeze(domains),
            items: Object.freeze(items),
            total: items.length,
            totalOverdue: items.filter((item) => item.overdue).length,
            covers: OPERATIONS_DOMAINS,
            doesNotCover: UNCOVERED_DOMAINS,
            mixedScope: scopes.size > 1,
        })
    }

    // ---- per-domain reads -------------------------------------------------
    // Every one of these filters on profileId. That is the tenant boundary, and it is repeated in
    // each method rather than applied by a wrapper so that a reader can verify it per query instead
    // of having to trust that a wrapper was used.

    private async reservations(profileId: string, asOf: Date, until: Date): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.reservation.findMany({
            where: {
                profileId,
                OR: [
                    // Somebody asked and nobody has answered.
                    { status: "REQUESTED" },
                    // Confirmed and about to happen, or already started and not closed out.
                    { status: { in: ["HELD", "CONFIRMED"] }, startAt: { lte: until } },
                ],
            },
            // startAt is not unique - a table turns over and several parties book the same slot - so
            // id decides between rows that share one start time. See the note above MAX_ITEMS_PER_DOMAIN.
            orderBy: [{ startAt: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, status: true, startAt: true, partySize: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "reservations" as const,
                id: row.id,
                reason: row.status === "REQUESTED" ? "awaiting confirmation" : "upcoming",
                label: `Reservation for ${row.partySize}`,
                at: row.startAt,
                overdue: row.startAt.getTime() < asOf.getTime(),
            }),
        )
    }

    private async appointments(profileId: string, asOf: Date, until: Date): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.booking.findMany({
            where: {
                profileId,
                status: { in: [...APPOINTMENT_OPEN_STATUSES] },
                startTime: { lte: until },
            },
            // A clinic on the hour books many appointments at one startTime; id decides between them.
            orderBy: [{ startTime: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, status: true, startTime: true, visitorName: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "appointments" as const,
                id: row.id,
                reason: row.status === "PENDING_PAYMENT" ? "awaiting payment" : "upcoming",
                label: `Appointment with ${row.visitorName}`,
                at: row.startTime,
                overdue: row.startTime.getTime() < asOf.getTime(),
            }),
        )
    }

    private async fieldJobs(profileId: string, asOf: Date, until: Date): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.fieldJob.findMany({
            where: {
                profileId,
                status: { in: [...FIELD_JOB_OPEN_STATUSES] },
                OR: [{ scheduledStartAt: { lte: until } }, { scheduledStartAt: null }],
            },
            // scheduledStartAt asc puts NULL last, which is the intended reading: a dated visit comes
            // before an undated commitment. createdAt then separates the undated ones - but two jobs
            // created in the same transaction share a createdAt to the microsecond, so BOTH existing keys
            // can tie at once and id is what actually makes this order reproducible.
            orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, status: true, scheduledStartAt: true, reference: true, title: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "fieldJobs" as const,
                id: row.id,
                // A committed job with no visit window is its own kind of exception: nobody has been
                // told when to turn up, and it will never appear in a "today" list by date.
                //
                // THE DATED CASE REPORTS THE JOB'S OWN STATUS, AND NOW SAYS WHOSE STATUS IT IS.
                //
                // This read `${row.status.toLowerCase()} visit`, which for a job holding status SCHEDULED
                // emitted "scheduled visit". The due-work preview and its owner panel copy this string
                // verbatim, so it is owner-facing copy authored here.
                //
                // The WORD is not the defect. The status really is SCHEDULED - a human booked the window
                // and scheduledStartAt is set - so reporting it is true and it is the most useful thing
                // this item can say; suppressing it would make the surface less informative and no more
                // honest. What was missing is WHOSE claim it is. Bare "scheduled visit", in a list a
                // platform rendered, reads as the PLATFORM having scheduled something, and that is the
                // one claim nothing on this path can support: there is no timer, no queue and no
                // provider here. Naming the record as the holder of the state - "visit marked scheduled"
                // - keeps the fact and removes the reading. See THE NARROWING in
                // ./due-work-preview-types.ts, which is where that rule is written down and enforced.
                //
                // The status token is also de-underscored, because IN_PROGRESS reached an owner as
                // "in_progress visit". A raw enum in owner copy is a leak rather than a wording choice.
                reason:
                    row.scheduledStartAt === null
                        ? "committed but unscheduled"
                        : `visit marked ${row.status.toLowerCase().split("_").join(" ")}`,
                label: `${row.reference} ${row.title}`,
                at: row.scheduledStartAt,
                overdue: row.scheduledStartAt !== null && row.scheduledStartAt.getTime() < asOf.getTime(),
            }),
        )
    }

    /**
     * Inspections have no due date of their own - they are due when somebody looks at them - so this
     * reader takes no clock reading. Accepting one and ignoring it would imply a deadline comparison
     * that does not happen.
     */
    private async inspections(profileId: string): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.fieldJobInspection.findMany({
            where: {
                profileId,
                OR: [
                    { status: { in: [...INSPECTION_OPEN_STATUSES] } },
                    // Finished, marked billable, and nobody has passed it on.
                    { status: "COMPLETED", invoiceHandoffState: "READY" },
                ],
            },
            // Inspections raised together off one job share a createdAt exactly; id decides between them.
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, status: true, reference: true, invoiceHandoffState: true, createdAt: true },
        })
        return rows.map((row) => {
            const billing = row.status === "COMPLETED" && row.invoiceHandoffState === "READY"
            return Object.freeze({
                domain: "inspections" as const,
                id: row.id,
                reason: billing
                    ? "ready to hand to billing"
                    : row.status === "SUBMITTED"
                      ? "awaiting review"
                      : "open",
                label: `Inspection ${row.reference}`,
                // An inspection has no due date of its own; it is due when somebody looks at it. Saying
                // null is more honest than borrowing the job's window and calling it a deadline.
                at: null,
                overdue: false,
            })
        })
    }

    /**
     * BOUNDED IN THE DATABASE, including the reorder comparison.
     *
     * This reader used to fetch EVERY tracked row with a reorder point for the profile, with no `take`,
     * then compare the two columns in TypeScript and `.slice(0, 20)` the result. Two things were wrong
     * with that, and the second is the serious one.
     *
     * It read the whole table to show twenty rows, so its cost grew with the profile's catalogue rather
     * than with the answer.
     *
     * And `onHand` ties massively - a stockout puts an entire catalogue at 0 - so ordering by it alone
     * left the order of the tied rows undefined, and slicing an undefined order in TypeScript made the
     * SET undefined too. With more than twenty rows at the same onHand, two identical requests could
     * legitimately return twenty DIFFERENT items. That is the worst form this bug takes: not a reshuffle
     * an owner would ignore, but work appearing and disappearing between two refreshes.
     *
     * `onHand <= reorderPoint` is now a FIELD REFERENCE, so the comparison Prisma cannot express as a
     * plain value filter happens in SQL, which is what allows `take` to be correct here. Bounding the
     * query without it would have been a real regression: the twenty lowest-stock rows are not the same
     * set as the twenty lowest-stock rows that are ALSO at or below their own reorder point, so a bare
     * `take` would have silently dropped items that need reordering. The harness asserts the bounded
     * query returns exactly what a whole-table scan followed by the old TypeScript filter returns.
     *
     * `reorderPoint: { not: null }` is kept although SQL's NULL comparison already excludes those rows.
     * It states the intent that a row which opted out of a reorder point is not a candidate, and it
     * keeps that intent legible next to the tenant filter rather than resting on three-valued logic.
     *
     * Ordering is unchanged in substance: lowest stock first, so the cap drops the best-stocked
     * candidates and never a stockout. `id` only separates rows at the same onHand.
     */
    private async inventory(profileId: string): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.inventoryItem.findMany({
            where: {
                profileId,
                trackingEnabled: true,
                reorderPoint: { not: null },
                onHand: { lte: this.ctx.db.inventoryItem.fields.reorderPoint },
            },
            orderBy: [{ onHand: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, onHand: true, reserved: true, reorderPoint: true, updatedAt: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "inventory" as const,
                id: row.id,
                reason: row.onHand === 0 ? "out of stock" : "at or below reorder point",
                label: `${row.onHand} on hand, ${row.reserved} promised, reorder at ${String(row.reorderPoint)}`,
                at: null,
                overdue: false,
            }),
        )
    }

    private async fulfilments(profileId: string): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.fulfilment.findMany({
            where: { profileId, state: { in: ["DRAFT", "PACKED"] } },
            // Shipments drafted in one batch share a createdAt; id decides between them.
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, state: true, reference: true, createdAt: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "fulfilments" as const,
                id: row.id,
                reason: row.state === "DRAFT" ? "not packed" : "packed, not shipped",
                label: `Shipment ${row.reference}`,
                at: null,
                overdue: false,
            }),
        )
    }

    private async returns(profileId: string): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.returnRequest.findMany({
            where: { profileId, state: "REQUESTED" },
            // Returns raised against one order share a createdAt; id decides between them.
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, reference: true, createdAt: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "returns" as const,
                id: row.id,
                reason: "awaiting a decision",
                label: `Return ${row.reference}`,
                at: null,
                overdue: false,
            }),
        )
    }

    /**
     * WORKSPACE-SCOPED, unlike every reader above.
     *
     * CaseProject carries workspaceId rather than profileId, so this filters through the relation on
     * the workspace whose access was authorised. Scoping it by profileId instead would have been
     * wrong in a way that is easy to miss: it would have returned cases from the profile's OTHER
     * workspaces, which the caller may have no access to. The scope difference is reported in the
     * response rather than hidden - see OPERATIONS_DOMAIN_SCOPE.
     *
     * BLOCKED is included alongside overdue and upcoming because a blocked milestone is the clearest
     * "somebody must do something" state in the case domain, and it has no due date of its own to
     * bring it into a date window.
     */
    private async caseMilestones(workspaceId: string, asOf: Date, until: Date): Promise<AttentionItem[]> {
        const rows = await this.ctx.db.caseMilestone.findMany({
            where: {
                case: { workspaceId },
                OR: [
                    { status: "BLOCKED" },
                    { status: { in: ["PENDING", "IN_PROGRESS"] }, dueAt: { lte: until } },
                ],
            },
            // dueAt asc puts NULL last, so a BLOCKED milestone with no due date follows dated work -
            // unchanged. ordinal is unique only WITHIN a case, so two cases each holding an ordinal-1
            // milestone at the same dueAt tie on both keys; id is what settles them.
            orderBy: [{ dueAt: "asc" }, { ordinal: "asc" }, { id: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, title: true, status: true, dueAt: true, case: { select: { reference: true } } },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "caseMilestones" as const,
                id: row.id,
                reason: row.status === "BLOCKED" ? "blocked" : "due",
                label: `${row.case.reference} ${row.title}`,
                at: row.dueAt,
                overdue: row.dueAt !== null && row.dueAt.getTime() < asOf.getTime(),
            }),
        )
    }

    /**
     * Cohort work, CONSUMED from the cohort engine rather than decided here.
     *
     * This method deliberately contains no cohort business rule. It does not know that a SUBMITTED
     * submission is owner work, that LATE attendance is credited, that an absence on a SCHEDULED session
     * is not yet an exception, or that ELIGIBLE-not-ISSUED is outstanding issuance. Every one of those is
     * a judgement the cohort engine makes in `resolveCohortNeedsAction`, grounded in its own transition
     * tables - `submissionFlow`, `ATTENDANCE_CREDITED`, `renewalFlow`, `certificateFlow`.
     *
     * That division is the whole point, and it is why this domain was UNCOVERED until now. The previous
     * entry in `UNCOVERED_DOMAINS` said covering cohorts here "would mean encoding a judgement here that
     * the cohort engine has not itself declared". It has now declared it, so the refusal is discharged by
     * the engine speaking rather than by this view guessing. If cohort rules ever need to change, they
     * change in one place and this method keeps working.
     *
     * Only two things happen here, and both are this view's own concerns rather than the cohort engine's:
     * the per-domain cap that every other domain applies, and the shape assertion below.
     *
     * DETERMINISM IS INHERITED HERE, NOT ABSENT. Every reader above appends `id` to its `orderBy` because
     * a database will not order tied rows for you. This one does not sort at all, and must not: the cohort
     * engine's `resolveCohortNeedsAction` already returns a TOTAL order, sorting on at, then reason, then
     * the unique id, so the slice below cuts a defined sequence. Re-sorting it here would be a second
     * opinion about cohort priority - the one thing this method exists not to have - and would silently
     * override the owning engine the day its ordering changes. The harness asserts that the consumed
     * declaration still ends its sort chain on the unique id, so this inheritance cannot lapse unnoticed.
     */
    private async cohortTasks(profileId: string, asOf: Date): Promise<AttentionItem[]> {
        const declared = await resolveCohortNeedsAction(this.ctx.db, profileId, asOf)
        return declared.slice(0, MAX_ITEMS_PER_DOMAIN).map((entry) =>
            Object.freeze({
                // Taken from the engine's own constant, not restated, so a rename cannot silently
                // produce items filed under a domain this view does not declare.
                domain: COHORT_NEEDS_ACTION_DOMAIN,
                id: entry.id,
                reason: entry.reason,
                label: entry.label,
                at: entry.at,
                // Read, never recomputed. The cohort engine decides what overdue means for a renewal,
                // and a second opinion here would be a second answer to one question.
                overdue: entry.overdue,
            }),
        )
    }
}

/**
 * The two engines must agree on which tenant boundary cohort work is read on.
 *
 * Asserted at module load rather than in a harness, because a mismatch would make every cohort count in
 * this view silently wrong for any owner with more than one workspace - and it would look like a data
 * problem rather than a contract problem. Failing here makes it a contract problem.
 */
if (OPERATIONS_DOMAIN_SCOPE[COHORT_NEEDS_ACTION_DOMAIN] !== COHORT_NEEDS_ACTION_SCOPE) {
    throw new Error(
        `operations declares cohortTasks scope as ${OPERATIONS_DOMAIN_SCOPE[COHORT_NEEDS_ACTION_DOMAIN]} ` +
            `but the cohort engine declares ${COHORT_NEEDS_ACTION_SCOPE}`,
    )
}
