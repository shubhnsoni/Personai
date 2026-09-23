/**
 * EVENTS / PHOTOGRAPHER P1-2 - discovery aliases for events studio + photo kits.
 *
 * TRY_KITS lists try-events-studio / try-photographer but guests hit /try-events
 * /try-studio /try-photo (and short /events /photo /photographer) with no
 * next.config redirects, so the profile catch-all soft-404s
 * "This Introify is missing". /try-photographer already redirects (CREATOR P1-1).
 *
 * Fix: non-permanent redirects to LIVE showcases (Next Level Events / Let's Click).
 * Pure map + redirect table - no ensure-on-visit (targets already public).
 * Does not touch P1-3 menu or P1-4 imagery.
 */

/** Canonical LIVE showcase slugs for the events–photo family. */
export const EVENTS_SHOWCASE = {
    events: "next-level-events-kanke",
    studio: "next-level-events-kanke",
    photo: "lets-click-ratu-road",
    photographer: "lets-click-ratu-road",
} as const

/**
 * Marketing / try-* / short-role aliases -> destination slug.
 * Required: try-events, try-studio, try-photo.
 * Prefer: try-event, try-photographer (regress), short /events /photo /photographer.
 * Do not ship short /studio (too generic; may collide with other product paths).
 */
export const EVENTS_DISCOVERY_ALIAS_MAP = {
    "try-events": EVENTS_SHOWCASE.events,
    "try-event": EVENTS_SHOWCASE.events,
    events: EVENTS_SHOWCASE.events,

    "try-studio": EVENTS_SHOWCASE.studio,

    "try-photo": EVENTS_SHOWCASE.photo,
    photo: EVENTS_SHOWCASE.photo,

    "try-photographer": EVENTS_SHOWCASE.photographer,
    photographer: EVENTS_SHOWCASE.photographer,
} as const

export type EventsDiscoveryAlias = keyof typeof EVENTS_DISCOVERY_ALIAS_MAP

export const EVENTS_DISCOVERY_ALIASES = Object.keys(
    EVENTS_DISCOVERY_ALIAS_MAP,
) as EventsDiscoveryAlias[]

/** Minimum acceptance set from the P1-2 ticket. */
export const EVENTS_DISCOVERY_REQUIRED_ALIASES = [
    "try-events",
    "try-studio",
    "try-photo",
] as const satisfies readonly EventsDiscoveryAlias[]

export type EventsDiscoveryRedirect = {
    source: string
    destination: string
    permanent: false
}

/** Pure: Next.js redirect rows (exact + nested `/:path*`) for every alias. */
export function eventsDiscoveryRedirects(): EventsDiscoveryRedirect[] {
    const rows: EventsDiscoveryRedirect[] = []
    for (const [alias, destSlug] of Object.entries(EVENTS_DISCOVERY_ALIAS_MAP)) {
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

/**
 * Aliases that are new in EVENTS P1-2 (not already shipped under CREATOR P1-1).
 * Use when appending next.config rows so try-photographer is not duplicated.
 */
export const EVENTS_DISCOVERY_NEW_ALIASES = [
    "try-events",
    "try-event",
    "events",
    "try-studio",
    "try-photo",
    "photo",
    "photographer",
] as const satisfies readonly EventsDiscoveryAlias[]

export function eventsDiscoveryNewRedirects(): EventsDiscoveryRedirect[] {
    const allow = new Set<string>(EVENTS_DISCOVERY_NEW_ALIASES)
    return eventsDiscoveryRedirects().filter((row) => {
        const alias = row.source.replace(/^\//, "").replace(/\/:path\*$/, "")
        return allow.has(alias)
    })
}

export function isEventsDiscoveryAlias(slug?: string | null): slug is EventsDiscoveryAlias {
    return Boolean(slug && slug in EVENTS_DISCOVERY_ALIAS_MAP)
}

export function eventsDiscoveryDestinationSlug(
    alias?: string | null,
): string | null {
    if (!alias || !isEventsDiscoveryAlias(alias)) return null
    return EVENTS_DISCOVERY_ALIAS_MAP[alias]
}

/** Resolve a path's events-discovery redirect target, or null if not an alias. */
export function eventsDiscoveryDestinationForPath(pathname: string): string | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    for (const [alias, destSlug] of Object.entries(EVENTS_DISCOVERY_ALIAS_MAP)) {
        if (path === `/${alias}`) return `/${destSlug}`
        const prefix = `/${alias}/`
        if (path.startsWith(prefix)) {
            return `/${destSlug}/${path.slice(prefix.length)}`
        }
    }
    return null
}

/** True when the slug is a destination showcase (not an alias). */
export function isEventsDiscoveryShowcaseSlug(slug?: string | null): boolean {
    if (!slug) return false
    return (Object.values(EVENTS_SHOWCASE) as string[]).includes(slug)
}
