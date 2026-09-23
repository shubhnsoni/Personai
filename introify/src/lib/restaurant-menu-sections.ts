/** Guest menu highlight rails — Order Again only from real prior orders (P1-2). */

const PRIOR_KEY = (slug: string) => `pl-ordered-items-${slug}`
const MAX_PRIOR = 24

export type SectionItem = {
    id: string
    sold?: number | null
}

export type HighlightSection<T extends SectionItem = SectionItem> = {
    id: "again" | "popular"
    label: "Order Again" | "Popular"
    items: T[]
}

/** True guest history item ids for this shop slug (browser localStorage). */
export function readPriorOrderItemIds(slug: string): string[] {
    if (typeof localStorage === "undefined") return []
    try {
        const raw = localStorage.getItem(PRIOR_KEY(slug))
        if (!raw) return []
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return []
        return uniqueStrings(parsed).slice(0, MAX_PRIOR)
    } catch {
        return []
    }
}

/** Persist product ids from a placed guest order so Order Again can be truthful later. */
export function writePriorOrderItemIds(slug: string, itemIds: readonly string[]) {
    if (typeof localStorage === "undefined") return
    const incoming = uniqueStrings(itemIds as unknown[])
    if (!incoming.length) return
    const merged = uniqueStrings([...incoming, ...readPriorOrderItemIds(slug)]).slice(0, MAX_PRIOR)
    try {
        localStorage.setItem(PRIOR_KEY(slug), JSON.stringify(merged))
    } catch {
        /* ignore quota / private mode */
    }
}

/**
 * Highlight rail for the top of the guest menu.
 * - Real prior item ids that still exist on this menu → "Order Again"
 * - Else items with sold/downloadCount > 0 → "Popular" (bestsellers, not history)
 * - Else omit the section — never invent a history-looking rail from the first N SKUs
 */
export function guestHistoryOrPopularSection<T extends SectionItem>(
    items: T[],
    priorItemIds: readonly string[] = [],
    limit = 8,
): HighlightSection<T> | null {
    const prior = new Set(uniqueStrings(priorItemIds as unknown[]))
    if (prior.size > 0) {
        const again = items.filter((p) => prior.has(p.id)).slice(0, limit)
        if (again.length > 0) {
            return { id: "again", label: "Order Again", items: again }
        }
    }
    const popular = items.filter((p) => (p.sold || 0) > 0).slice(0, limit)
    if (popular.length > 0) {
        return { id: "popular", label: "Popular", items: popular }
    }
    return null
}

function uniqueStrings(values: unknown[]): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const value of values) {
        if (typeof value !== "string") continue
        const id = value.trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        out.push(id)
    }
    return out
}
