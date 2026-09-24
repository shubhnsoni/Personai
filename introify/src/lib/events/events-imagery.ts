/**
 * EVENTS / PHOTO P1-4 — cross-role imagery honesty for NLE + Let's Click fixtures.
 *
 * Demo seeds previously reused try-leela (creator lifestyle), try-workshop
 * (meeting), try-film (noir cyberpunk), and try-anika (brand desk) as About /
 * Events / project heroes. Guests then saw creator/lifestyle chrome on wedding
 * studio and wedding-photo kits.
 *
 * Policy: prefer events/photo-kit assets under /uploads/events-studio/ and
 * /uploads/lets-click/. Only backfill when the live profile still carries a
 * known leakage path — never wipe a custom owner upload that is not a listed
 * marker.
 */

/** Paths / markers that must never appear as NLE / LC hero or logo. */
export const EVENTS_LEAKED_IMAGE_MARKERS = [
    "try-leela",
    "try-film",
    "try-anika",
    "try-workshop",
] as const

/** Events-honest Next Level Events showcase assets. */
export const NLE_HONEST_IMAGE_URL = "/uploads/events-studio/hall.jpg"
export const NLE_HONEST_LOGO_URL = "/uploads/events-studio/mark.png"

/** Photo-honest Let's Click showcase assets. */
export const LC_HONEST_IMAGE_URL = "/uploads/lets-click/shoot.jpg"
export const LC_HONEST_LOGO_URL = "/uploads/lets-click/mark.png"

/** Known bad fixture paths still on LIVE NLE / LC before P1-4. */
export const NLE_LEAKED_IMAGE_URL = "/uploads/try-workshop.jpg"
export const NLE_LEAKED_LOGO_URL = "/uploads/try-leela.jpg"
export const LC_LEAKED_IMAGE_URL = "/uploads/try-film.jpg"
export const LC_LEAKED_LOGO_URL = "/uploads/try-anika.jpg"

export function isLeakedEventsFixtureImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return EVENTS_LEAKED_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

export type EventsImageryBackfill = {
    imageUrl?: string
    shopLogoUrl?: string
}

/**
 * Pure: replace only known creator/lifestyle/cyberpunk/brand-desk leakage
 * paths with events/photo-honest URLs. Custom owner uploads that are not
 * listed markers are left alone. Empty fields are left alone.
 */
export function eventsImageryBackfillPatch(input: {
    imageUrl?: string | null
    shopLogoUrl?: string | null
    honestImageUrl?: string
    honestLogoUrl?: string
}): EventsImageryBackfill | null {
    const honestImage = input.honestImageUrl || NLE_HONEST_IMAGE_URL
    const honestLogo = input.honestLogoUrl || NLE_HONEST_LOGO_URL
    const patch: EventsImageryBackfill = {}

    if (isLeakedEventsFixtureImage(input.imageUrl)) {
        patch.imageUrl = honestImage
    }
    if (isLeakedEventsFixtureImage(input.shopLogoUrl)) {
        patch.shopLogoUrl = honestLogo
    }

    return Object.keys(patch).length ? patch : null
}

export function isEventsHonestFixtureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (isLeakedEventsFixtureImage(trimmed)) return false
    return (
        trimmed === NLE_HONEST_IMAGE_URL ||
        trimmed === NLE_HONEST_LOGO_URL ||
        trimmed === LC_HONEST_IMAGE_URL ||
        trimmed === LC_HONEST_LOGO_URL ||
        trimmed.startsWith("/uploads/events-studio/") ||
        trimmed.startsWith("/uploads/lets-click/")
    )
}
