/**
 * REAL_ESTATE_BROKERAGE P1-2 - discovery aliases for real-estate / realtor kits.
 *
 * TRY_KITS lists try-real-estate but guests hit /try-real-estate /try-realtor
 * /try-property (and short /realtor /property /broker /realestate) with no
 * next.config redirects, so the profile catch-all soft-404s
 * "This Introify is missing". Same class as events-p1-2 / gym try-* aliases.
 *
 * Fix: non-permanent redirects to LIVE showcase (Shakti Property Lalpur).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Does not touch P1-3 menu or P1-4 imagery.
 */

/** Canonical LIVE showcase slug for the real-estate family. */
export const REALESTATE_SHOWCASE = {
    brokerage: "shakti-property-lalpur",
    realtor: "shakti-property-lalpur",
    property: "shakti-property-lalpur",
    broker: "shakti-property-lalpur",
    homes: "shakti-property-lalpur",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-real-estate, try-realtor, try-property.
 * Prefer: try-broker, try-homes.
 * Nice-to-have shorts: /realtor /property /broker /realestate.
 */
export const REALESTATE_DISCOVERY_ALIAS_MAP = {
    "try-real-estate": REALESTATE_SHOWCASE.brokerage,
    realestate: REALESTATE_SHOWCASE.brokerage,

    "try-realtor": REALESTATE_SHOWCASE.realtor,
    realtor: REALESTATE_SHOWCASE.realtor,

    "try-property": REALESTATE_SHOWCASE.property,
    property: REALESTATE_SHOWCASE.property,

    "try-broker": REALESTATE_SHOWCASE.broker,
    broker: REALESTATE_SHOWCASE.broker,

    "try-homes": REALESTATE_SHOWCASE.homes,
} as const

export type RealestateDiscoveryAlias = keyof typeof REALESTATE_DISCOVERY_ALIAS_MAP

export const REALESTATE_DISCOVERY_ALIASES = Object.keys(
    REALESTATE_DISCOVERY_ALIAS_MAP,
) as RealestateDiscoveryAlias[]

/** Minimum acceptance set from the P1-2 ticket. */
export const REALESTATE_DISCOVERY_REQUIRED_ALIASES = [
    "try-real-estate",
    "try-realtor",
    "try-property",
] as const satisfies readonly RealestateDiscoveryAlias[]

export type RealestateDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function realestateDiscoveryRedirects(): RealestateDiscoveryRedirect[] {
    const rows: RealestateDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(REALESTATE_DISCOVERY_ALIAS_MAP)) {
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

export function isRealestateDiscoveryAlias(
    slug?: string | null,
): slug is RealestateDiscoveryAlias {
    return Boolean(slug && slug in REALESTATE_DISCOVERY_ALIAS_MAP)
}

export function realestateDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isRealestateDiscoveryAlias(alias)) return null
    return REALESTATE_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's realestate-discovery redirect target, or null if not an alias. */
export function realestateDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(REALESTATE_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isRealestateDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(REALESTATE_SHOWCASE) as string[]).includes(slug)
}
