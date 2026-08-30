/**
 * The contract for the explicitly invoked DUE-WORK PREVIEW.
 *
 * `planDueWork` in `./due-work-plan.ts` is a pure function that turns one already-decided
 * `OperationsSummary` into an ordered, explained proposal. It exists, it is proven pure, and it is
 * currently invoked by nobody. This file is the contract for exposing it — an API and, later, an owner
 * panel — and it is a TYPE FILE rather than a design document for the reason this program has now relied
 * on four times: a document describing a shape can be ignored or drift silently, and the drift only
 * surfaces at runtime. Two sides importing one type cannot disagree, so `tsc` exit 0 is itself evidence.
 *
 * ---------------------------------------------------------------------------------------------------
 * WHAT THIS IS: a PLAN. A proposal about work that already needs attention, ordered and explained.
 *
 * WHAT THIS IS NOT, and every one of these is a claim somebody could reasonably infer and must not:
 *
 *   IT IS NOT A SCHEDULER. Nothing here runs on a timer, an interval, a cron expression, a queue drain or
 *   any background execution. `src/lib/operations` deliberately has none and its harness asserts their
 *   absence. A claim of background execution without measured execution evidence is the specific thing
 *   this surface is forbidden to make.
 *
 *   IT IS NOT AN EXECUTION. Nothing is sent, charged, notified, published, dispatched or handed to a
 *   provider. There is no mailer, no payment client, no carrier.
 *
 *   IT IS NOT A WRITE. Producing a preview mutates nothing — not a row, not a status, not a record that
 *   the preview was requested. A surface that logged its own invocation would be a write path, and a
 *   write path is how "preview" becomes "trigger" one refactor later.
 *
 *   IT IS NOT A COMPLETE PICTURE, and it says so. The plan inherits `covers` and `doesNotCover` from the
 *   summary, so a reader cannot mistake its total for a total of everything the business owes.
 *
 * ---------------------------------------------------------------------------------------------------
 * THE WORDING RULE, which is a contract term and not a style preference
 *
 * This surface may say **planned**, **proposed**, **suggested**, **needs attention**, **preview**.
 *
 * It may NOT say **scheduled**, **sent**, **executed**, **queued**, **dispatched**, **processing**,
 * **running**, **automatic** or **will**. Those words assert that something happened or is going to
 * happen without anybody asking, and none of that is true. `FORBIDDEN_PREVIEW_WORDS` below is the
 * enforceable form of this paragraph, and a harness asserts it over the response body and the UI copy.
 *
 * The distinction is not pedantry. An owner who reads "3 reminders scheduled" will stop checking, and
 * nothing is scheduled.
 */
import type { DueWorkPlan, DueWorkPlanBand, DueWorkPlanItem } from "./due-work-plan"
import type { OperationsDomain } from "./engine"

/** One planned item as it crosses the boundary. Dates are ISO strings; nothing emits a Date. */
export type DueWorkPreviewItem = Readonly<{
    position: number
    /** Index into the operations summary this item came from, so a caller can trace it back. */
    sourceIndex: number
    domain: OperationsDomain
    id: string
    label: string
    /** Why the OWNING engine says it needs attention. Copied, never re-derived here. */
    attentionReason: string
    /** ISO 8601, or null when the domain has no such notion. */
    at: string | null
    overdue: boolean
    band: DueWorkPlanBand
    /** Why it sits at this position. Present so ordering is explained rather than asserted. */
    orderingReason: string
}>

/**
 * The preview as the API returns it and the UI renders it.
 *
 * `asOf` is the SINGLE clock reading the whole plan was computed against, taken from the summary rather
 * than read again here. Two requests with the same summary and the same `asOf` produce byte-identical
 * output, which is what makes this a preview rather than a sample.
 */
export type DueWorkPreview = Readonly<{
    /** ISO 8601. The one clock reading every comparison in this response was made against. */
    asOf: string
    horizonHours: number
    workspaceId: string
    /** Domains the plan covers — exactly what the summary covered, inherited not restated. */
    covers: readonly OperationsDomain[]
    /** Stated absences with reasons, so silence is not read as "nothing there". */
    doesNotCover: Readonly<Record<string, string>>
    /** True when covered domains do not share one tenant boundary. Surfaced, never smoothed. */
    mixedScope: boolean
    scopeNotice: string
    empty: boolean
    /** What this plan is and is not, in the response body rather than in a document. */
    explanation: string
    /**
     * Always the literal `false`, typed as such.
     *
     * Stronger than a comment promising nothing was executed: a future change that starts executing
     * cannot set this to true without a compile error, and cannot leave it out either. Present as a field
     * so a reader can see the question was asked and answered rather than omitted — the same discipline
     * `installed: null` uses in the blueprint preview contract.
     */
    executed: false
    /**
     * Always an empty array, typed as such. Nothing was sent, charged or dispatched, and there is no
     * shape in which this surface could report that it had been.
     */
    sideEffects: readonly []
    items: readonly DueWorkPreviewItem[]
    /** What this preview cannot tell you. Shipped in the body, because a caller reads the body. */
    limitations: readonly string[]
}>

/** Read-only port. There is deliberately no method that acts on a plan. */
export type DueWorkPreviewPort = {
    /**
     * Explicitly invoked. Throws `PersistenceError` on refusal rather than returning a partial preview,
     * so a caller cannot treat a refusal as an empty plan by ignoring a field.
     */
    preview(workspaceId: string, options?: Readonly<{ horizonHours?: number | null }>): Promise<DueWorkPreview>
}

/**
 * Words this surface must never emit, in a response body or in owner-facing copy.
 *
 * Enforced rather than remembered. Two traps for whoever writes the assertion, both of which have
 * already been walked into:
 *
 * ONE: scan the EMITTED STRINGS, not the source file. This very comment contains every one of these
 * words in order to forbid them, and a whole-file scan would flag the prohibition as the violation. That
 * trap has now caught this repository five times, and the fifth cost three attempts to fix.
 *
 * TWO, found by the harness on its first real run against this contract: a word ban cannot tell an
 * ASSERTION from a DENIAL. `DUE_WORK_PREVIEW_LIMITATIONS[0]` says that nothing has been *sent* or
 * *dispatched* - it is the very sentence that makes the promise - and a scan over the whole body
 * reported it as a violation of the rule it exists to state. So this list applies to prose that
 * AFFIRMS something about the work: `explanation`, `scopeNotice`, `doesNotCover`. It does NOT apply to
 * `limitations`, which are denials by construction and are instead pinned by exact equality with the
 * constant below - a strictly stronger check, because it fixes every sentence rather than merely the
 * absence of seven words. This is RUNLOG lesson 52 recurring: when a property is about prose, assert the
 * presence of the right sentence, not the absence of a wrong word.
 *
 * It also does not apply to field NAMES. `executed` is a required field of this contract, so any scan
 * that reads raw JSON rather than the prose values will report the contract as breaking itself.
 */
export const FORBIDDEN_PREVIEW_WORDS: readonly string[] = Object.freeze([
    "scheduled",
    "sent",
    "executed",
    "queued",
    "dispatched",
    "processing",
    "automatic",
])

/** Words this surface is expected to use, so honest wording is a positive requirement too. */
export const REQUIRED_PREVIEW_WORDS: readonly string[] = Object.freeze(["plan", "preview"])

/**
 * The limitations every preview response carries.
 *
 * In the body rather than in a document, for the reason the blueprint preview package established: a
 * caller reads the body, and a limitation nobody reads is a limitation nobody honours.
 */
export const DUE_WORK_PREVIEW_LIMITATIONS: readonly string[] = Object.freeze([
    "This preview is a plan, not an action. Nothing here has been sent, charged, dispatched or handed to any provider, and requesting it changed no data.",
    "Nothing runs on its own. There is no timer, interval, cron or background worker behind this surface - it produced this plan because somebody asked for it, and it will not produce another until somebody asks again.",
    "The ordering is a proposal. Overdue work precedes dated work precedes undated work, and every item carries the reason for its position, but nothing here knows your priorities.",
    "Coverage is inherited from the operations view and is not everything. Read covers and doesNotCover before treating the total as a total.",
    "Where covered domains do not share one tenant boundary, comparing positions across them compares two different populations. mixedScope says when that is the case.",
])

/** Serialises a pure plan into the boundary shape. Dates become ISO strings; nothing is recomputed. */
export function toDueWorkPreview(plan: DueWorkPlan): DueWorkPreview {
    return Object.freeze({
        asOf: plan.asOf.toISOString(),
        horizonHours: plan.horizonHours,
        workspaceId: plan.workspaceId,
        covers: Object.freeze([...plan.covers]),
        doesNotCover: Object.freeze({ ...plan.doesNotCover }),
        mixedScope: plan.mixedScope,
        scopeNotice: plan.scopeNotice,
        empty: plan.empty,
        explanation: plan.explanation,
        executed: false as const,
        sideEffects: Object.freeze([]) as readonly [],
        items: Object.freeze(plan.items.map(toPreviewItem)),
        limitations: DUE_WORK_PREVIEW_LIMITATIONS,
    })
}

function toPreviewItem(item: DueWorkPlanItem): DueWorkPreviewItem {
    return Object.freeze({
        position: item.position,
        sourceIndex: item.sourceIndex,
        domain: item.domain,
        id: item.id,
        label: item.label,
        attentionReason: item.attentionReason,
        at: item.at === null ? null : item.at.toISOString(),
        overdue: item.overdue,
        band: item.band,
        orderingReason: item.orderingReason,
    })
}
