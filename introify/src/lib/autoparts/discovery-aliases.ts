/**
 * AUTO_PARTS P0-1 - discovery aliases for auto-parts / parts / spares kits.
 *
 * Guests hit /try-auto-parts and sibling try-* / short paths and soft-404ed, or
 * risked wrong-vertical marketing to /try-shop (SHOP / Armonia décor). Same
 * class as jewelry-p0-1 / recruit-p1-1 / field-p1-1.
 *
 * Fix: non-permanent redirects to LIVE showcase (Paras Auto).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Leaves /try-shop alone (SHOP / décor showcase).
 */

/** Canonical LIVE showcase slug for the auto-parts family. */
export const AUTOPARTS_SHOWCASE = {
    "auto-parts": "paras-auto",
    autoparts: "paras-auto",
    parts: "paras-auto",
    auto: "paras-auto",
    "spare-parts": "paras-auto",
    spares: "paras-auto",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-auto-parts.
 * Prefer: try-autoparts, try-parts.
 * Role Loop soft-404s: try-auto, try-spare-parts, try-spares.
 * Nice-to-have shorts: /auto-parts /parts.
 * Do not claim try-shop (SHOP / décor showcase owns that).
 */
export const AUTOPARTS_DISCOVERY_ALIAS_MAP = {
    "try-auto-parts": AUTOPARTS_SHOWCASE["auto-parts"],
    "auto-parts": AUTOPARTS_SHOWCASE["auto-parts"],

    "try-autoparts": AUTOPARTS_SHOWCASE.autoparts,

    "try-parts": AUTOPARTS_SHOWCASE.parts,
    parts: AUTOPARTS_SHOWCASE.parts,

    "try-auto": AUTOPARTS_SHOWCASE.auto,

    "try-spare-parts": AUTOPARTS_SHOWCASE["spare-parts"],

    "try-spares": AUTOPARTS_SHOWCASE.spares,
} as const

export type AutopartsDiscoveryAlias = keyof typeof AUTOPARTS_DISCOVERY_ALIAS_MAP

export const AUTOPARTS_DISCOVERY_ALIASES = Object.keys(
    AUTOPARTS_DISCOVERY_ALIAS_MAP,
) as AutopartsDiscoveryAlias[]

/** Minimum acceptance set from the auto-p0-1 ticket. */
export const AUTOPARTS_DISCOVERY_REQUIRED_ALIASES = [
    "try-auto-parts",
] as const satisfies readonly AutopartsDiscoveryAlias[]

export type AutopartsDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function autopartsDiscoveryRedirects(): AutopartsDiscoveryRedirect[] {
    const rows: AutopartsDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(AUTOPARTS_DISCOVERY_ALIAS_MAP)) {
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

export function isAutopartsDiscoveryAlias(
    slug?: string | null,
): slug is AutopartsDiscoveryAlias {
    return Boolean(slug && slug in AUTOPARTS_DISCOVERY_ALIAS_MAP)
}

export function autopartsDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isAutopartsDiscoveryAlias(alias)) return null
    return AUTOPARTS_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's autoparts-discovery redirect target, or null if not an alias. */
export function autopartsDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(AUTOPARTS_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isAutopartsDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(AUTOPARTS_SHOWCASE) as string[]).includes(slug)
}
