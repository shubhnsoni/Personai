/**
 * GYM P1-1 - discovery aliases for gym / yoga / fitness kits.
 *
 * TRY_KITS lists try-gym / try-yoga but guests hit /try-gym /try-yoga /try-fitness
 * (and short /gym /yoga) with no next.config redirects, so the profile catch-all
 * soft-404s "This Introify is missing".
 *
 * Fix: non-permanent redirects to LIVE showcases (Aura / Natraj).
 * Pure map + redirect table - no ensure-on-visit (targets already public).
 * Does not touch P0-1 session/class copy or P1-2 menu imagery.
 */

/** Canonical LIVE showcase slugs for the gym–yoga family. */
export const GYM_SHOWCASE = {
    gym: "aura-fitness-ranchi",
    fitness: "aura-fitness-ranchi",
    yoga: "natraj-yoga-kutchery",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-gym, try-yoga, try-fitness.
 * Prefer: short /gym /yoga.
 */
export const GYM_DISCOVERY_ALIAS_MAP = {
    "try-gym": GYM_SHOWCASE.gym,
    gym: GYM_SHOWCASE.gym,

    "try-fitness": GYM_SHOWCASE.fitness,

    "try-yoga": GYM_SHOWCASE.yoga,
    yoga: GYM_SHOWCASE.yoga,
} as const

export type GymDiscoveryAlias = keyof typeof GYM_DISCOVERY_ALIAS_MAP

export const GYM_DISCOVERY_ALIASES = Object.keys(
    GYM_DISCOVERY_ALIAS_MAP,
) as GymDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const GYM_DISCOVERY_REQUIRED_ALIASES = [
    "try-gym",
    "try-yoga",
    "try-fitness",
] as const satisfies readonly GymDiscoveryAlias[]

export type GymDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function gymDiscoveryRedirects(): GymDiscoveryRedirect[] {
    const rows: GymDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(GYM_DISCOVERY_ALIAS_MAP)) {
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

export function isGymDiscoveryAlias(slug?: string | null): slug is GymDiscoveryAlias {
    return Boolean(slug && slug in GYM_DISCOVERY_ALIAS_MAP)
}

export function gymDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isGymDiscoveryAlias(alias)) return null
    return GYM_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's gym-discovery redirect target, or null if not an alias. */
export function gymDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(GYM_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isGymDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(GYM_SHOWCASE) as string[]).includes(slug)
}
