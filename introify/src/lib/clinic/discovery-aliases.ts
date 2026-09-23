/**
 * CLINIC P1-1 - discovery aliases for clinic / dental / doctor kits.
 *
 * TRY_KITS lists try-clinic but guests hit /try-clinic /try-dental /try-doctor
 * (and short /clinic /dental /doctor) with no next.config redirects, so the
 * profile catch-all soft-404s "This Introify is missing".
 *
 * Fix: non-permanent redirects to LIVE showcase (JK Sharma Harmu).
 * No dedicated dental fixture in demo-shops — try-dental / dental soft-promise
 * to the same JK chamber (BACKLOG P1-1 optional).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Does not touch P0-1 appointment copy or P1-2/P1-3 pharmacy tickets.
 */

/** Canonical LIVE showcase slug for the clinic-dental-doctor family. */
export const CLINIC_SHOWCASE = {
    clinic: "jk-sharma-clinic-harmu",
    dental: "jk-sharma-clinic-harmu",
    doctor: "jk-sharma-clinic-harmu",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-clinic, try-doctor.
 * Optional (shipped same JK — no dedicated dental fixture): try-dental.
 * Prefer: short /clinic /dental /doctor.
 */
export const CLINIC_DISCOVERY_ALIAS_MAP = {
    "try-clinic": CLINIC_SHOWCASE.clinic,
    clinic: CLINIC_SHOWCASE.clinic,

    "try-dental": CLINIC_SHOWCASE.dental,
    dental: CLINIC_SHOWCASE.dental,

    "try-doctor": CLINIC_SHOWCASE.doctor,
    doctor: CLINIC_SHOWCASE.doctor,
} as const

export type ClinicDiscoveryAlias = keyof typeof CLINIC_DISCOVERY_ALIAS_MAP

export const CLINIC_DISCOVERY_ALIASES = Object.keys(
    CLINIC_DISCOVERY_ALIAS_MAP,
) as ClinicDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const CLINIC_DISCOVERY_REQUIRED_ALIASES = [
    "try-clinic",
    "try-doctor",
    "try-dental",
] as const satisfies readonly ClinicDiscoveryAlias[]

export type ClinicDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function clinicDiscoveryRedirects(): ClinicDiscoveryRedirect[] {
    const rows: ClinicDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(CLINIC_DISCOVERY_ALIAS_MAP)) {
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

export function isClinicDiscoveryAlias(slug?: string | null): slug is ClinicDiscoveryAlias {
    return Boolean(slug && slug in CLINIC_DISCOVERY_ALIAS_MAP)
}

export function clinicDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isClinicDiscoveryAlias(alias)) return null
    return CLINIC_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's clinic-discovery redirect target, or null if not an alias. */
export function clinicDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(CLINIC_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isClinicDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(CLINIC_SHOWCASE) as string[]).includes(slug)
}