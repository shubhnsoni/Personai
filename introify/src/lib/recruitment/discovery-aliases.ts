/**
 * RECRUITMENT_AGENCY P1-1 - discovery aliases for recruit / HR / jobs kits.
 *
 * Guests hit /try-recruit /try-recruitment /try-recruiter /try-hr /try-jobs
 * /try-hiring (and prefer /try-staffing /try-talent; shorts /recruiter
 * /recruitment /hr /staffing /talent) with no next.config redirects, so the
 * profile catch-all soft-404s "This Introify is missing". Same class as
 * field-p1-1 / realestate-p1-2.
 *
 * Fix: non-permanent redirects to LIVE showcase (Nita Recruiters Ashok Nagar).
 * Pure map + redirect table - no ensure-on-visit (target already public).
 * Does not touch P1-2 menu, P1-3 imagery, or P1-4 chat→/book.
 * Does not claim try-agency (that slug belongs to the separate AGENCY kit).
 */

/** Canonical LIVE showcase slug for the recruitment-agency family. */
export const RECRUIT_SHOWCASE = {
    recruit: "nita-recruiters-ashok-nagar",
    recruitment: "nita-recruiters-ashok-nagar",
    recruiter: "nita-recruiters-ashok-nagar",
    hr: "nita-recruiters-ashok-nagar",
    jobs: "nita-recruiters-ashok-nagar",
    hiring: "nita-recruiters-ashok-nagar",
    staffing: "nita-recruiters-ashok-nagar",
    talent: "nita-recruiters-ashok-nagar",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-recruit, try-recruitment, try-recruiter, try-hr, try-jobs, try-hiring.
 * Prefer: try-staffing, try-talent.
 * Nice-to-have shorts: /recruiter /recruitment /hr /staffing /talent.
 * Do not ship short /jobs /hiring /agency (too generic / kit conflict).
 * Do not ship try-agency (AGENCY kit owns that slug).
 */
export const RECRUIT_DISCOVERY_ALIAS_MAP = {
    "try-recruit": RECRUIT_SHOWCASE.recruit,
    "try-recruitment": RECRUIT_SHOWCASE.recruitment,
    recruitment: RECRUIT_SHOWCASE.recruitment,

    "try-recruiter": RECRUIT_SHOWCASE.recruiter,
    recruiter: RECRUIT_SHOWCASE.recruiter,

    "try-hr": RECRUIT_SHOWCASE.hr,
    hr: RECRUIT_SHOWCASE.hr,

    "try-jobs": RECRUIT_SHOWCASE.jobs,

    "try-hiring": RECRUIT_SHOWCASE.hiring,

    "try-staffing": RECRUIT_SHOWCASE.staffing,
    staffing: RECRUIT_SHOWCASE.staffing,

    "try-talent": RECRUIT_SHOWCASE.talent,
    talent: RECRUIT_SHOWCASE.talent,
} as const

export type RecruitDiscoveryAlias = keyof typeof RECRUIT_DISCOVERY_ALIAS_MAP

export const RECRUIT_DISCOVERY_ALIASES = Object.keys(
    RECRUIT_DISCOVERY_ALIAS_MAP,
) as RecruitDiscoveryAlias[]

/** Minimum acceptance set from the P1-1 ticket. */
export const RECRUIT_DISCOVERY_REQUIRED_ALIASES = [
    "try-recruit",
    "try-recruitment",
    "try-recruiter",
    "try-hr",
    "try-jobs",
    "try-hiring",
] as const satisfies readonly RecruitDiscoveryAlias[]

export type RecruitDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function recruitDiscoveryRedirects(): RecruitDiscoveryRedirect[] {
    const rows: RecruitDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(RECRUIT_DISCOVERY_ALIAS_MAP)) {
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

export function isRecruitDiscoveryAlias(
    slug?: string | null,
): slug is RecruitDiscoveryAlias {
    return Boolean(slug && slug in RECRUIT_DISCOVERY_ALIAS_MAP)
}

export function recruitDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isRecruitDiscoveryAlias(alias)) return null
    return RECRUIT_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's recruit-discovery redirect target, or null if not an alias. */
export function recruitDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(RECRUIT_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isRecruitDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(RECRUIT_SHOWCASE) as string[]).includes(slug)
}
