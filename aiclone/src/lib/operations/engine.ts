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
] as const
export type OperationsDomain = (typeof OPERATIONS_DOMAINS)[number]

/**
 * Domains an owner might reasonably expect here and which are deliberately absent, with the reason.
 * Listed rather than omitted, because an unexplained gap reads as an oversight and gets "fixed"
 * badly by the next person.
 */
export const UNCOVERED_DOMAINS: Readonly<Record<string, string>> = Object.freeze({
    caseMilestones:
        "CaseMilestone is scoped through CaseProject rather than carrying profileId, so including it " +
        "means a join this read-only view has no other reason to make. Deferred rather than guessed at.",
    cohortTasks:
        "Cohort task and renewal state is spread across several models whose 'needs action' condition " +
        "is not a single field. Including it would mean encoding a judgement here that the cohort " +
        "engine has not itself declared.",
    durableTasks:
        "The shared TaskJob queue has its own surface and its own notion of overdue. Restating it here " +
        "would create a second answer to the same question.",
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
}>

export type OperationsSummary = Readonly<{
    /** The single clock reading every comparison in this response was made against. */
    asOf: Date
    /** Horizon used for "upcoming", in hours. */
    horizonHours: number
    profileId: string
    domains: readonly DomainSummary[]
    items: readonly AttentionItem[]
    total: number
    totalOverdue: number
    /** Declared coverage, so a caller can tell what this number is a total OF. */
    covers: readonly OperationsDomain[]
    /** Stated absences, so a caller does not read silence as "nothing there". */
    doesNotCover: Readonly<Record<string, string>>
}>

const DEFAULT_HORIZON_HOURS = 24
const MAX_HORIZON_HOURS = 24 * 14
const MAX_ITEMS_PER_DOMAIN = 20

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
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")

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
        ])

        const items = groups.flat()
        const domains: DomainSummary[] = OPERATIONS_DOMAINS.map((domain) => {
            const mine = items.filter((item) => item.domain === domain)
            return Object.freeze({
                domain,
                count: mine.length,
                overdue: mine.filter((item) => item.overdue).length,
            })
        })

        return Object.freeze({
            asOf,
            horizonHours,
            profileId,
            domains: Object.freeze(domains),
            items: Object.freeze(items),
            total: items.length,
            totalOverdue: items.filter((item) => item.overdue).length,
            covers: OPERATIONS_DOMAINS,
            doesNotCover: UNCOVERED_DOMAINS,
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
            orderBy: { startAt: "asc" },
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
            orderBy: { startTime: "asc" },
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
            orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "asc" }],
            take: MAX_ITEMS_PER_DOMAIN,
            select: { id: true, status: true, scheduledStartAt: true, reference: true, title: true },
        })
        return rows.map((row) =>
            Object.freeze({
                domain: "fieldJobs" as const,
                id: row.id,
                // A committed job with no visit window is its own kind of exception: nobody has been
                // told when to turn up, and it will never appear in a "today" list by date.
                reason: row.scheduledStartAt === null ? "committed but unscheduled" : `${row.status.toLowerCase()} visit`,
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
            orderBy: { createdAt: "asc" },
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

    private async inventory(profileId: string): Promise<AttentionItem[]> {
        // Prisma cannot compare two columns in a `where`, so the reorder comparison is done in
        // TypeScript over the tracked rows that have a reorder point at all. The filter below still
        // does the tenant scoping and excludes rows that opted out of stock control.
        const rows = await this.ctx.db.inventoryItem.findMany({
            where: { profileId, trackingEnabled: true, reorderPoint: { not: null } },
            orderBy: { onHand: "asc" },
            select: { id: true, onHand: true, reserved: true, reorderPoint: true, updatedAt: true },
        })
        return rows
            .filter((row) => row.reorderPoint !== null && row.onHand <= row.reorderPoint)
            .slice(0, MAX_ITEMS_PER_DOMAIN)
            .map((row) =>
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
            orderBy: { createdAt: "asc" },
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
            orderBy: { createdAt: "asc" },
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
}
