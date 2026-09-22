/** Pure filter helpers for guest restaurant/cafe menus (P1-8). */

export type MenuFilterItem = {
    title: string
    diet?: string | null
    sold?: number | null
    compareAtCents?: number | null
    priceCents?: number | null
    rating?: number | null
}

export type MenuFilterState = {
    q: string
    veg: boolean
    nonveg: boolean
    best: boolean
    rated: boolean
}

export function menuFiltersActive(f: MenuFilterState): boolean {
    return Boolean(f.q.trim() || f.veg || f.nonveg || f.best || f.rated)
}

export function filterMenuItems<T extends MenuFilterItem>(list: T[], f: MenuFilterState): T[] {
    return list.filter((p) => {
        if (f.q.trim() && !p.title.toLowerCase().includes(f.q.trim().toLowerCase())) return false
        if (f.veg && p.diet !== "VEG" && p.diet !== "VEGAN") return false
        if (f.nonveg && p.diet !== "NONVEG" && p.diet !== "EGG") return false
        if (f.best && !(p.sold || 0) && !(p.compareAtCents && p.compareAtCents > (p.priceCents || 0))) return false
        if (f.rated && (p.rating || 5) < 4) return false
        return true
    })
}

/** Veg and Non-Veg are mutually exclusive toggles. */
export function nextDietFilter(
    which: "veg" | "nonveg",
    current: { veg: boolean; nonveg: boolean },
): { veg: boolean; nonveg: boolean } {
    if (which === "veg") {
        const veg = !current.veg
        return { veg, nonveg: veg ? false : current.nonveg }
    }
    const nonveg = !current.nonveg
    return { veg: nonveg ? false : current.veg, nonveg }
}

export function emptyMenuCopy(f: MenuFilterState): { title: string; detail: string } {
    if (f.q.trim()) {
        return {
            title: "No dishes match",
            detail: `Nothing matched “${f.q.trim()}”. Clear search or try another name.`,
        }
    }
    if (f.veg && f.nonveg) {
        return {
            title: "No dishes match",
            detail: "Veg and Non-Veg can’t both be on. Pick one, or clear filters.",
        }
    }
    if (f.best && !f.veg && !f.nonveg && !f.rated) {
        return {
            title: "No bestsellers yet",
            detail: "This menu has no bestsellers marked. Clear the filter to see every dish.",
        }
    }
    return {
        title: "No dishes match",
        detail: "Nothing matches these filters. Clear them to see the full menu.",
    }
}
