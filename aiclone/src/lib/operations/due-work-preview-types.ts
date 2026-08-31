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
 *
 * ---------------------------------------------------------------------------------------------------
 * THE NARROWING, AND WHY A FLAT WORD BAN WAS THE WRONG SHAPE FOR ITEM TEXT
 *
 * An audit found this surface emitting "scheduled" after all, from engine-authored item text that the
 * API and the panel copy verbatim: a FieldJob whose status is SCHEDULED produced the attention reason
 * "scheduled visit", and the cohort classifier labelled a membership "Renewal is scheduled for ...".
 *
 * Banning the word outright would have been the wrong repair, because two different claims were being
 * lumped together and only one of them is false:
 *
 *   (a) A REPORT OF A RECORD'S OWN PERSISTED STATE. A FieldJob really does hold status SCHEDULED,
 *       because a human booked a visit window and `scheduledStartAt` is set. A CohortMembership really
 *       does hold renewalState SCHEDULED, because somebody called `scheduleRenewal` with a due date.
 *       Reporting that is TRUE, and it is the most useful thing the item can say. Refusing to say it
 *       would make this surface LESS informative and no more honest - it would hide a fact an owner
 *       needs in order to decide what to do.
 *
 *   (b) THIS PLATFORM CLAIMING IT SCHEDULED, SENT OR RAN SOMETHING. That is the false claim the
 *       contract exists to prevent. Nothing on this path acts: no timer, no queue, no provider, no
 *       delivery. "3 reminders scheduled" is (b), and it is what makes an owner stop checking.
 *
 * The two are told apart by ATTRIBUTION, not by vocabulary. A state word carried by a phrase that names
 * the RECORD as the holder of the state - "visit marked scheduled", "renewal recorded as scheduled" - is
 * (a): it says a record says so. The same word standing on its own, with no holder named, reads as this
 * surface's own claim and is (b). `STATE_ATTRIBUTION_MARKERS` and `classifyPreviewProse` below are the
 * enforceable form of this paragraph, so the rule and its enforcement are one artefact rather than two
 * that can drift.
 *
 * WHERE EACH RULE APPLIES, because they are deliberately not the same strength:
 *
 *   THIS SURFACE'S OWN PROSE - `explanation`, `scopeNotice`, `doesNotCover` - keeps the FLAT ban. Not
 *   one occurrence of a forbidden word, attributed or not. This prose reports no record's state; it
 *   describes what the preview IS, so it has nothing legitimate to attribute and no reason to reach for
 *   any of these words. Narrowing it would open a hole for exactly the copy the contract was written
 *   against.
 *
 *   ENGINE-OWNED ITEM TEXT - `label` and `attentionReason` - is held to the NARROWED rule: no
 *   PLATFORM CLAIM, and attributed state reports are permitted. This is the channel the audit found,
 *   and it was previously unchecked in both directions - reported on stdout by the API harness and
 *   subtracted from the panel harness's scan, so nothing failed when it said "scheduled visit".
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
    /**
     * True when the figures in THIS plan do not all share one tenant boundary.
     *
     * A measurement, not a property of the coverage list: engine.ts derives it from the boundaries the
     * domains that actually contributed were read on, so it is false when this plan's whole answer sits
     * on one boundary, false when the plan is empty, and true only when the total really does combine a
     * profile-wide figure with a workspace-wide one. It varies with your records.
     *
     * It was previously derived from the frozen OPERATIONS_DOMAIN_SCOPE map and was therefore true for
     * every workspace and every dataset. What that value said - that this view's DECLARED coverage spans
     * two boundaries - is reported per domain by the operations summary instead.
     */
    mixedScope: boolean
    /**
     * What the items in THIS plan span, in a sentence. Derived from the boundaries the plan's own items
     * were read on, and unlike `mixedScope` it distinguishes an empty plan - which spans nothing - from
     * one whose items share a boundary.
     */
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
 *
 * THREE, and this one is the audit's finding rather than the harness's: it does not apply UNCHANGED to
 * engine-owned ITEM TEXT either. `label` and `attentionReason` report a record's own state, and a record
 * whose status is SCHEDULED has to be reportable as such. Item text is therefore held to
 * `classifyPreviewProse` below, which forbids the platform-claim reading and permits the attributed
 * state report. See THE NARROWING at the top of this file for why those are different claims.
 */
export const FORBIDDEN_PREVIEW_WORDS: readonly string[] = Object.freeze([
    "scheduled",
    "sent",
    "executed",
    "queued",
    "dispatched",
    "processing",
    "running",
    "automatic",
    "will",
])

/**
 * Phrases that attribute a state to the RECORD holding it, rather than to this platform.
 *
 * Each one names a record as the source of what follows it: something was MARKED, or is RECORDED AS, or
 * is the record's STATUS. A forbidden word carried by one of these is a report about a row; the same
 * word with no holder named is this surface claiming to have done something. That is the whole of the
 * (a)/(b) distinction, in a form a scan can apply.
 *
 * Hyphens and underscores count as separators as well as spaces, because a kebab reason token
 * ("renewal-marked-scheduled") is a real emitted form here and attributes state exactly as the prose
 * form does.
 */
export const STATE_ATTRIBUTION_MARKERS: readonly string[] = Object.freeze([
    "marked",
    "marked as",
    "recorded",
    "recorded as",
    "status",
])

/** How much text before a forbidden word is examined for an attribution marker. */
const ATTRIBUTION_WINDOW = 28

export type PreviewProseClaim = Readonly<{
    /** The forbidden word this occurrence used. */
    word: string
    /**
     * `attributed-state` is case (a): a record's own state, with the record named as its holder.
     * `platform-claim` is case (b): the same word with nothing named, which reads as this surface
     * asserting it acted. Only (b) is a contract breach.
     */
    kind: "attributed-state" | "platform-claim"
    /** The window that was judged, so a failure names the sentence rather than only the word. */
    excerpt: string
}>

/**
 * Classifies every forbidden-word OCCURRENCE in one string as (a) or (b).
 *
 * Per occurrence rather than per word, deliberately: one label can legitimately report a record's state
 * and illegitimately claim delivery in the same sentence, and a per-word answer would let the honest
 * half excuse the dishonest half.
 *
 * This function is the contract. A harness that re-implemented the judgement would be a second opinion
 * about what the rule means, and the two would drift the first time the rule was refined - the same
 * reason this whole file is a type file rather than a design document.
 */
export function classifyPreviewProse(text: string): readonly PreviewProseClaim[] {
    const claims: PreviewProseClaim[] = []
    for (const word of FORBIDDEN_PREVIEW_WORDS) {
        const occurrences = new RegExp(`\\b${word}\\b`, "giu")
        for (let hit = occurrences.exec(text); hit !== null; hit = occurrences.exec(text)) {
            const before = text.slice(Math.max(0, hit.index - ATTRIBUTION_WINDOW), hit.index)
            const attributed = STATE_ATTRIBUTION_MARKERS.some((marker) =>
                new RegExp(`\\b${marker}\\b[\\s:_-]*$`, "iu").test(before),
            )
            claims.push({
                word: hit[0].toLowerCase(),
                kind: attributed ? "attributed-state" : "platform-claim",
                excerpt: `${before}${hit[0]}`.trim(),
            })
        }
    }
    return Object.freeze(claims)
}

/**
 * The (b) occurrences only - the ones this surface may never emit anywhere, in its own prose or in text
 * it copies from an engine. Empty is the only acceptable answer for owner-facing item text.
 */
export function platformClaimsIn(text: string): readonly PreviewProseClaim[] {
    return Object.freeze(classifyPreviewProse(text).filter((claim) => claim.kind === "platform-claim"))
}

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
    "Nothing runs on its own. There is no timer, interval, cron or background worker behind this surface - it produced this plan because somebody asked for it, and it produces another only when somebody asks again.",
    "The ordering is a proposal. Overdue work precedes dated work precedes undated work, and every item carries the reason for its position, but nothing here knows your priorities.",
    "Coverage is inherited from the operations view and is not everything. Read covers and doesNotCover before treating the total as a total.",
    "Where covered domains do not share one tenant boundary, comparing positions across them compares two different populations. mixedScope reports whether the domains that actually contributed to THIS plan span more than one boundary, and scopeNotice says the same thing in a sentence; the boundary each domain is read on is declared per domain by the operations summary.",
])

/** Serialises a pure plan into the boundary shape. Dates become ISO strings; nothing is recomputed. */
export function toDueWorkPreview(plan: DueWorkPlan): DueWorkPreview {
    return Object.freeze({
        asOf: plan.asOf.toISOString(),
        horizonHours: plan.horizonHours,
        workspaceId: plan.workspaceId,
        covers: Object.freeze([...plan.covers]),
        doesNotCover: Object.freeze({ ...plan.doesNotCover }),
        // Copied, not recomputed. The plan carries the summary's measurement and this boundary does not
        // get a second opinion about it.
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
