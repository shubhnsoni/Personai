import type { AttentionItem, OperationsDomain, OperationsSummary } from "./engine"

export type DueWorkPlanBand = "overdue" | "upcoming" | "undated"

export type DueWorkPlanItem = Readonly<{
    position: number
    sourceIndex: number
    domain: OperationsDomain
    id: string
    label: string
    attentionReason: string
    at: Date | null
    overdue: boolean
    band: DueWorkPlanBand
    orderingReason: string
}>

export type DueWorkPlan = Readonly<{
    asOf: Date
    horizonHours: number
    profileId: string
    workspaceId: string
    covers: readonly OperationsDomain[]
    doesNotCover: Readonly<Record<string, string>>
    /**
     * Carried through from the summary, which measures it. True when the domains that actually
     * contributed to that summary were read on more than one tenant boundary; false when they share one
     * and false when there were none. `scopeNotice` is the sentence form of the same fact.
     */
    mixedScope: boolean
    /** What the boundaries of THIS proposal's own items are, in a sentence. Varies with the items. */
    scopeNotice: string
    empty: boolean
    explanation: string
    items: readonly DueWorkPlanItem[]
}>

const BAND_ORDER: readonly DueWorkPlanBand[] = Object.freeze(["overdue", "upcoming", "undated"])

const ORDERING_REASONS: Readonly<Record<DueWorkPlanBand, string>> = Object.freeze({
    overdue:
        "The supplied operations summary marked this item overdue, so it precedes work not marked overdue; source order is preserved within this group.",
    upcoming:
        "The supplied operations summary gave this non-overdue item a date, so it follows overdue work and precedes undated attention; source order is preserved within this group.",
    undated:
        "The supplied operations summary gave this attention item no date, so it follows dated work; source order is preserved within this group.",
})

function bandFor(item: AttentionItem): DueWorkPlanBand {
    if (item.overdue) return "overdue"
    return item.at === null ? "undated" : "upcoming"
}

/**
 * Turns one already-decided operations summary into a manual proposal.
 * It copies only supplied attention items and preserves each engine-owned judgement.
 */
export function planDueWork(summary: OperationsSummary): DueWorkPlan {
    const indexed = summary.items.map((item, sourceIndex) => ({ item, sourceIndex, band: bandFor(item) }))
    const ordered = BAND_ORDER.flatMap((band) => indexed.filter((entry) => entry.band === band))
    const items = ordered.map(({ item, sourceIndex, band }, index) =>
        Object.freeze({
            position: index + 1,
            sourceIndex,
            domain: item.domain,
            id: item.id,
            label: item.label,
            attentionReason: item.reason,
            at: item.at,
            overdue: item.overdue,
            band,
            orderingReason: ORDERING_REASONS[band],
        }),
    )

    const empty = items.length === 0

    // WHICH TENANT BOUNDARIES THIS PROPOSAL'S OWN ITEMS SPAN.
    //
    // The scope per domain is the SUMMARY'S declaration, read back from `summary.domains` rather than
    // re-derived here, so this function still adds no judgement of its own. What it does add is the
    // restriction to the domains that actually contributed an item.
    //
    // WHY THIS IS DERIVED HERE AT ALL, NOW THAT `mixedScope` MEANS SOMETHING. `summary.mixedScope` used
    // to be `scopes.size > 1` over the frozen OPERATIONS_DOMAIN_SCOPE map in engine.ts, which always
    // holds both "profile" and "workspace", so it was true for every workspace, every profile and every
    // dataset including an empty one. Branching the notice on it left the non-mixed arm UNREACHABLE and
    // asserted "this proposal combines attention from different tenant boundaries" to every owner,
    // including one whose items all came from profile-scoped domains, for whom it was simply false. That
    // is fixed at the producer: `deriveMixedScope` in engine.ts now measures the boundaries the
    // contributing domains were read on, so the field varies with the data and both arms are reachable.
    //
    // The notice is still computed from THIS proposal's items rather than read off the flag, for two
    // reasons that survive the fix. It needs three arms, not two - an empty proposal has no positions to
    // compare and must say that rather than pick either boundary sentence - and it must stay defensive
    // about a summary it did not produce: this function takes any `OperationsSummary`, so it cannot
    // assume the flag it was handed was derived from the items it was handed. Where the summary is
    // self-consistent the two agree by construction, which is the state a harness pins.
    //
    // A domain the summary declared no boundary for lands in the set as `undefined`. It is kept as its
    // own member rather than dropped, so an unrecognised domain can only push this toward the cautious
    // sentence and never toward a claim that one boundary covers everything.
    const declaredScope = new Map(summary.domains.map((entry) => [entry.domain, entry.scope] as const))
    const itemBoundaries = new Set(items.map((entry) => declaredScope.get(entry.domain)))
    const oneBoundary = itemBoundaries.size === 1 && !itemBoundaries.has(undefined)

    return Object.freeze({
        asOf: summary.asOf,
        horizonHours: summary.horizonHours,
        profileId: summary.profileId,
        workspaceId: summary.workspaceId,
        covers: Object.freeze([...summary.covers]),
        doesNotCover: Object.freeze({ ...summary.doesNotCover }),
        // Carried through unchanged. The summary MEASURED it from the domains that contributed to it, so
        // it now reports whether this proposal's own figures span more than one tenant boundary;
        // `scopeNotice` is the sentence form of the same fact, computed from the items for the reasons
        // above.
        mixedScope: summary.mixedScope,
        scopeNotice: empty
            ? "This proposal has no items, so there are no positions to compare across tenant boundaries."
            : oneBoundary
              ? "Every item in this proposal was read on one tenant boundary, so comparing their positions compares one population."
              : "This proposal does not show its items all coming from one tenant boundary: positions that span different tenant boundaries compare more than one population.",
        empty,
        explanation: empty
            ? "No attention items were present in the supplied operations summary, so this proposal is empty."
            : `${items.length} supplied attention item${items.length === 1 ? "" : "s"} ordered by overdue state, then date presence, while preserving source order within each group.`,
        items: Object.freeze(items),
    })
}
