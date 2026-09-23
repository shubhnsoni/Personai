/**
 * SALON P1-1 - discovery aliases for salon / spa / barber kits.
 *
 * TRY_KITS lists try-salon-spa / try-barber but guests hit /try-salon /try-spa
 * /try-barber (and short /salon /spa /barber) with no next.config redirects,
 * so the profile catch-all soft-404s "This Introify is missing".
 *
 * Fix: non-permanent redirects to LIVE showcases (H Square / Prince).
 * Pure map + redirect table - no ensure-on-visit (targets already public).
 * Does not touch P0-1 book INR or P0-2 mobile Book CTA.
 */

/** Canonical LIVE showcase slugs for the salon-spa-barber family. */
export const SALON_SHOWCASE = {
    salon: "h-square-salon-harmu",
    spa: "h-square-salon-harmu",
    barber: "prince-barber-lalpur",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-salon, try-barber, try-spa.
 * Prefer: short /salon /spa /barber.
 */
export const SALON_DISCOVERY_ALIAS_MAP = {
    "try-salon": SALON_SHOWCASE.salon,
    salon: SALON_SHOWCASE.salon,

    "try-spa": SALON_SHOWCASE.spa,
    spa: SALON_SHOWCASE.spa,

    "try-barber": SALON_SHOWCASE.barber,
    barber: SALON_SHOWCASE.barber,
} as const

export type SalonDiscoveryAlias = keyof typeof SALON_DISCOVERY_ALIAS_MAP

export const SALON_DISCOVERY_ALIASES = Object.keys(
    SALON_DISCOVERY_ALIAS_MAP,
) as SalonDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const SALON_DISCOVERY_REQUIRED_ALIASES = [
    "try-salon",
    "try-barber",
    "try-spa",
] as const satisfies readonly SalonDiscoveryAlias[]

export type SalonDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function salonDiscoveryRedirects(): SalonDiscoveryRedirect[] {
    const rows: SalonDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(SALON_DISCOVERY_ALIAS_MAP)) {
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

export function isSalonDiscoveryAlias(slug?: string | null): slug is SalonDiscoveryAlias {
    return Boolean(slug && slug in SALON_DISCOVERY_ALIAS_MAP)
}

export function salonDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isSalonDiscoveryAlias(alias)) return null
    return SALON_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's salon-discovery redirect target, or null if not an alias. */
export function salonDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(SALON_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isSalonDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(SALON_SHOWCASE) as string[]).includes(slug)
}