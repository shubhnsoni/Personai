/**
 * CREATOR P1-1 — discovery aliases for creator / coach / consultant / pro kits.
 *
 * TRY_KITS lists try-creator / try-coach / try-consultant / … but those slugs were
 * never seeded and had no next.config redirects, so guests hit the profile catch-all
 * → soft-404 “This Introify is missing”. Food/shop/hotel already redirect or ensure.
 *
 * Fix: non-permanent redirects to LIVE role showcases (Tagore / Riley / Leela / …).
 * Pure map + redirect table — no ensure-on-visit (targets already public).
 */

/** Canonical LIVE showcase slugs for the creator–pro family. */
export const CREATOR_SHOWCASE = {
    creator: "tagore-hill-press",
    coach: "leela-path-lalpur",
    consultant: "demo",
    designer: "maya",
    developer: "kadru-lab",
    editor: "swaroop-production-doranda",
    photographer: "lets-click-ratu-road",
    ca: "singh-raushan-doranda",
} as const

/**
 * Marketing / try-* / short-role aliases → destination slug.
 * Required: try-creator, try-consultant, try-coach.
 * Prefer: try-professional, try-arjun, short /creator /coach /consultant /professional,
 * plus designer/editor/photographer/developer/ca tries (same cheap map).
 */
export const CREATOR_DISCOVERY_ALIAS_MAP = {
    "try-creator": CREATOR_SHOWCASE.creator,
    creator: CREATOR_SHOWCASE.creator,
    "try-arjun": CREATOR_SHOWCASE.creator,

    "try-coach": CREATOR_SHOWCASE.coach,
    coach: CREATOR_SHOWCASE.coach,

    "try-consultant": CREATOR_SHOWCASE.consultant,
    consultant: CREATOR_SHOWCASE.consultant,
    "try-professional": CREATOR_SHOWCASE.consultant,
    professional: CREATOR_SHOWCASE.consultant,

    "try-designer": CREATOR_SHOWCASE.designer,
    "try-developer": CREATOR_SHOWCASE.developer,
    "try-editor": CREATOR_SHOWCASE.editor,
    "try-photographer": CREATOR_SHOWCASE.photographer,
    "try-ca": CREATOR_SHOWCASE.ca,
} as const

export type CreatorDiscoveryAlias = keyof typeof CREATOR_DISCOVERY_ALIAS_MAP

export const CREATOR_DISCOVERY_ALIASES = Object.keys(
    CREATOR_DISCOVERY_ALIAS_MAP,
) as CreatorDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const CREATOR_DISCOVERY_REQUIRED_ALIASES = [
    "try-creator",
    "try-consultant",
    "try-coach",
] as const satisfies readonly CreatorDiscoveryAlias[]

export type CreatorDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function creatorDiscoveryRedirects(): CreatorDiscoveryRedirect[] {
    const rows: CreatorDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(CREATOR_DISCOVERY_ALIAS_MAP)) {
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

export function isCreatorDiscoveryAlias(slug?: string | null): slug is CreatorDiscoveryAlias {
    return Boolean(slug && slug in CREATOR_DISCOVERY_ALIAS_MAP)
}

export function creatorDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isCreatorDiscoveryAlias(alias)) return null
    return CREATOR_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's creator-discovery redirect target, or null if not an alias. */
export function creatorDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(CREATOR_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isCreatorDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(CREATOR_SHOWCASE) as string[]).includes(slug)
}
