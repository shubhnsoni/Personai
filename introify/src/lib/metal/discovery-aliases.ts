/**
 * JEWELRY_RETAIL P0-1 - discovery aliases for jewellery / jewelry / gold kits.
 *
 * Guests hit /try-jewellery and got a soft marketing redirect to /try-shop
 * (generic SHOP / decor showcase - wrong vertical). /try-jewelry and sibling try-*
 * paths soft-404ed. Same class as recruit-p1-1 / field-p1-1.
 *
 * Fix: non-permanent redirects to LIVE showcase (MK Jewellers).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Leaves /try-shop alone (SHOP / decor showcase).
 * Does not claim try-jewelry-retail / try-gold-wholesale (TRY_KITS create slugs).
 */

/** Canonical LIVE showcase slug for the jewellery-retail family. */
export const JEWELRY_SHOWCASE = {
    jewellery: "mk-jewellers",
    jewelry: "mk-jewellers",
    gold: "mk-jewellers",
    jeweller: "mk-jewellers",
    jeweler: "mk-jewellers",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-jewellery, try-jewelry.
 * Prefer: try-gold, try-jeweller, try-jeweler.
 * Nice-to-have shorts: /jewellery /jewelry /jeweller.
 * Do not ship short /gold (too generic).
 * Do not ship try-jewelry-retail / try-gold-wholesale (TRY_KITS create slugs).
 * Do not claim try-shop (SHOP / decor showcase owns that).
 */
export const JEWELRY_DISCOVERY_ALIAS_MAP = {
    "try-jewellery": JEWELRY_SHOWCASE.jewellery,
    jewellery: JEWELRY_SHOWCASE.jewellery,

    "try-jewelry": JEWELRY_SHOWCASE.jewelry,
    jewelry: JEWELRY_SHOWCASE.jewelry,

    "try-gold": JEWELRY_SHOWCASE.gold,

    "try-jeweller": JEWELRY_SHOWCASE.jeweller,
    jeweller: JEWELRY_SHOWCASE.jeweller,

    "try-jeweler": JEWELRY_SHOWCASE.jeweler,
} as const

export type JewelryDiscoveryAlias = keyof typeof JEWELRY_DISCOVERY_ALIAS_MAP

export const JEWELRY_DISCOVERY_ALIASES = Object.keys(
    JEWELRY_DISCOVERY_ALIAS_MAP,
) as JewelryDiscoveryAlias[]

/** Minimum acceptance set from the jewelry-p0-1 ticket. */
export const JEWELRY_DISCOVERY_REQUIRED_ALIASES = [
    "try-jewellery",
    "try-jewelry",
] as const satisfies readonly JewelryDiscoveryAlias[]

export type JewelryDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function jewelryDiscoveryRedirects(): JewelryDiscoveryRedirect[] {
    const rows: JewelryDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(JEWELRY_DISCOVERY_ALIAS_MAP)) {
        const destination = `/${destSlug}`
        rows.push({ source: `/${alias}`, destination, permanent: false })
        rows.push({
            source: `/${alias}/:path*`,
            destination: `${destination}/:path*`,
            permanent: false,
        })
    }
    return rows
}

export function isJewelryDiscoveryAlias(
    slug?: string | null,
): slug is JewelryDiscoveryAlias {
    return Boolean(slug && slug in JEWELRY_DISCOVERY_ALIAS_MAP)
}

export function jewelryDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isJewelryDiscoveryAlias(alias)) return null
    return JEWELRY_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's jewelry-discovery redirect target, or null if not an alias. */
export function jewelryDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(JEWELRY_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isJewelryDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(JEWELRY_SHOWCASE) as string[]).includes(slug)
}
