/**
 * FIELD_SERVICE P1-1 - discovery aliases for plumber / electrician / field / garage kits.
 *
 * Guests hit /try-plumber /try-electrician /try-field /try-garage (and prefer
 * /try-ac-repair /try-repair; shorts /plumber /electrician /garage) with no
 * next.config redirects, so the profile catch-all soft-404s
 * "This Introify is missing". Same class as realestate-p1-2 / events-p1-2.
 *
 * Fix: non-permanent redirects to LIVE showcase (Goodwill Plumbing).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Does not touch P1-2 menu or P1-3 imagery.
 */

/** Canonical LIVE showcase slug for the field-service family. */
export const FIELD_SHOWCASE = {
    plumber: "goodwill-plumbing",
    electrician: "goodwill-plumbing",
    field: "goodwill-plumbing",
    garage: "goodwill-plumbing",
    acRepair: "goodwill-plumbing",
    repair: "goodwill-plumbing",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-plumber, try-electrician, try-field, try-garage.
 * Prefer: try-ac-repair, try-repair.
 * Nice-to-have shorts: /plumber /electrician /garage.
 * Do not ship short /field /repair /ac-repair (too generic).
 */
export const FIELD_DISCOVERY_ALIAS_MAP = {
    "try-plumber": FIELD_SHOWCASE.plumber,
    plumber: FIELD_SHOWCASE.plumber,

    "try-electrician": FIELD_SHOWCASE.electrician,
    electrician: FIELD_SHOWCASE.electrician,

    "try-field": FIELD_SHOWCASE.field,

    "try-garage": FIELD_SHOWCASE.garage,
    garage: FIELD_SHOWCASE.garage,

    "try-ac-repair": FIELD_SHOWCASE.acRepair,

    "try-repair": FIELD_SHOWCASE.repair,
} as const

export type FieldDiscoveryAlias = keyof typeof FIELD_DISCOVERY_ALIAS_MAP

export const FIELD_DISCOVERY_ALIASES = Object.keys(
    FIELD_DISCOVERY_ALIAS_MAP,
) as FieldDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const FIELD_DISCOVERY_REQUIRED_ALIASES = [
    "try-plumber",
    "try-electrician",
    "try-field",
    "try-garage",
] as const satisfies readonly FieldDiscoveryAlias[]

export type FieldDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function fieldDiscoveryRedirects(): FieldDiscoveryRedirect[] {
    const rows: FieldDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(FIELD_DISCOVERY_ALIAS_MAP)) {
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

export function isFieldDiscoveryAlias(
    slug?: string | null,
): slug is FieldDiscoveryAlias {
    return Boolean(slug && slug in FIELD_DISCOVERY_ALIAS_MAP)
}

export function fieldDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isFieldDiscoveryAlias(alias)) return null
    return FIELD_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's field-discovery redirect target, or null if not an alias. */
export function fieldDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(FIELD_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isFieldDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(FIELD_SHOWCASE) as string[]).includes(slug)
}
