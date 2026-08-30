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
    mixedScope: boolean
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
    return Object.freeze({
        asOf: summary.asOf,
        horizonHours: summary.horizonHours,
        profileId: summary.profileId,
        workspaceId: summary.workspaceId,
        covers: Object.freeze([...summary.covers]),
        doesNotCover: Object.freeze({ ...summary.doesNotCover }),
        mixedScope: summary.mixedScope,
        // THE NON-MIXED BRANCH BELOW IS CURRENTLY UNREACHABLE, AND IS KEPT DELIBERATELY.
        //
        // `summary.mixedScope` is computed in engine.ts over the frozen OPERATIONS_DOMAIN_SCOPE map, which
        // always contains both "profile" and "workspace" - caseMilestones is the workspace-scoped one - so
        // `scopes.size > 1` is true for every workspace and every dataset. The only producer of a real
        // OperationsSummary therefore never sets it false, and nothing in the running application can take
        // the second arm. Do not read a passing test of the first arm as evidence that this ternary was
        // exercised both ways; only a hand-built summary does that.
        //
        // Kept, rather than collapsed to the single mixed sentence, for two reasons. This function's input
        // is the OperationsSummary TYPE, not the one engine that happens to build it today, and that type
        // permits mixedScope false: a coverage list that lost its last workspace-scoped domain, or a second
        // producer, takes this arm immediately, and it should say something accurate when it does rather
        // than assert a mixture that is not there. And collapsing it would turn the first sentence into
        // unconditional prose, which would then read as a measured fact about the caller's data instead of
        // what it actually is - a branch on a static property of the declared coverage list.
        scopeNotice: summary.mixedScope
            ? "This proposal combines attention from different tenant boundaries; cross-domain positions do not imply a shared population."
            : "The supplied summary reports one tenant boundary across its covered domains.",
        empty,
        explanation: empty
            ? "No attention items were present in the supplied operations summary, so this proposal is empty."
            : `${items.length} supplied attention item${items.length === 1 ? "" : "s"} ordered by overdue state, then date presence, while preserving source order within each group.`,
        items: Object.freeze(items),
    })
}
