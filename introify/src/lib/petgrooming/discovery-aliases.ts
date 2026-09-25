/**
 * PET P1-1 - discovery aliases for the pet grooming kit.
 *
 * TRY_KITS lists try-pet-grooming, but guests hit /try-pet /try-grooming /try-pet-grooming
 * /try-dog-grooming /try-pets with no next.config redirects, so the profile catch-all
 * soft-404s "This Introify is missing".
 *
 * Fix: non-permanent redirects to the LIVE PET_GROOMING showcase (Pluto Pet Grooming, Hinoo).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Does not touch P0-1 groom copy, P1-2 imagery, or P1-3 chat weight tiers.
 * Deliberately not claimed: /try-vet (veterinary is a different vertical) and bare short roles.
 */

/** Canonical LIVE showcase slug for the pet grooming family. */
export const PET_GROOMING_SHOWCASE = {
    grooming: "pluto-grooming-hinoo",
} as const

/**
 * Marketing / try-* aliases -> destination slug.
 * Required: try-pet, try-grooming, try-pet-grooming, try-dog-grooming, try-pets.
 */
export const PET_GROOMING_DISCOVERY_ALIAS_MAP = {
    "try-pet": PET_GROOMING_SHOWCASE.grooming,
    "try-pets": PET_GROOMING_SHOWCASE.grooming,
    "try-grooming": PET_GROOMING_SHOWCASE.grooming,
    "try-pet-grooming": PET_GROOMING_SHOWCASE.grooming,
    "try-dog-grooming": PET_GROOMING_SHOWCASE.grooming,
} as const

export type PetGroomingDiscoveryAlias = keyof typeof PET_GROOMING_DISCOVERY_ALIAS_MAP

export const PET_GROOMING_DISCOVERY_ALIASES = Object.keys(
    PET_GROOMING_DISCOVERY_ALIAS_MAP,
) as PetGroomingDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const PET_GROOMING_DISCOVERY_REQUIRED_ALIASES = [
    "try-pet",
    "try-grooming",
    "try-pet-grooming",
    "try-dog-grooming",
    "try-pets",
] as const satisfies readonly PetGroomingDiscoveryAlias[]

export type PetGroomingDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function petGroomingDiscoveryRedirects(): PetGroomingDiscoveryRedirect[] {
    const rows: PetGroomingDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(PET_GROOMING_DISCOVERY_ALIAS_MAP)) {
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

export function isPetGroomingDiscoveryAlias(slug?: string | null): slug is PetGroomingDiscoveryAlias {
    return Boolean(slug && slug in PET_GROOMING_DISCOVERY_ALIAS_MAP)
}

export function petGroomingDiscoveryDestinationSlug(alias?: string | null): string | null {
    if (!alias || !isPetGroomingDiscoveryAlias(alias)) return null
    return PET_GROOMING_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's pet-grooming-discovery redirect target, or null if not an alias. */
export function petGroomingDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(PET_GROOMING_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isPetGroomingDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(PET_GROOMING_SHOWCASE) as string[]).includes(slug)
}
