export type PdpDisplay = {
    showMore: boolean
    showRelated: boolean
    showBestsellers: boolean
}

export const DEFAULT_PDP_DISPLAY: PdpDisplay = {
    showMore: false,
    showRelated: false,
    showBestsellers: false,
}

function asBag(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
    if (Array.isArray(raw)) return { variants: raw }
    return {}
}

function asFlag(raw: unknown): boolean {
    return raw === true
}

export function parsePdpDisplay(variantsJson?: string | null): PdpDisplay {
    if (!variantsJson?.trim()) return { ...DEFAULT_PDP_DISPLAY }
    try {
        const bag = asBag(JSON.parse(variantsJson) as unknown)
        const pdp = asBag(bag.pdp)
        return {
            showMore: asFlag(pdp.showMore),
            showRelated: asFlag(pdp.showRelated),
            showBestsellers: asFlag(pdp.showBestsellers),
        }
    } catch {
        return { ...DEFAULT_PDP_DISPLAY }
    }
}

export function writePdpDisplay(existing: string | null | undefined, display: PdpDisplay | null): string | null {
    let o: Record<string, unknown> = {}
    try {
        o = asBag(JSON.parse(existing || "{}") as unknown)
    } catch {
        o = {}
    }
    const next: PdpDisplay = {
        showMore: Boolean(display?.showMore),
        showRelated: Boolean(display?.showRelated),
        showBestsellers: Boolean(display?.showBestsellers),
    }
    if (!next.showMore && !next.showRelated && !next.showBestsellers) delete o.pdp
    else o.pdp = next
    const keys = Object.keys(o)
    if (keys.length === 0) return null
    if (keys.length === 1 && keys[0] === "variants" && Array.isArray(o.variants)) {
        return JSON.stringify(o.variants)
    }
    return JSON.stringify(o)
}

/** Extra shots only — never the cover, never a stock lifestyle fallback. */
export function extraDetailPhotos(photos: string[]): string[] {
    const seen = new Set<string>()
    const extras: string[] = []
    for (const src of photos.slice(1)) {
        if (!src || seen.has(src) || src === photos[0]) continue
        seen.add(src)
        extras.push(src)
    }
    return extras
}
