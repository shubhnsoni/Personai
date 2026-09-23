/**
 * HOTEL P1-5 — cross-role imagery honesty for Haven / stay fixtures.
 *
 * Demo stay seeds previously reused SkyDine cafe interiors and try-arjun
 * creator stills as hotel hero/logo. Guests then saw cafe/creator chrome on
 * HOTEL home, /menu header, and profile RSC fields.
 *
 * Policy: prefer stay-kit assets under /uploads/haven-hinoo/. Only backfill
 * when the live profile still carries a known leakage path — never wipe a
 * custom owner upload that is not skydine / try-arjun stock.
 */

/** Paths / markers that must never appear as Haven hotel hero or logo. */
export const HOTEL_LEAKED_IMAGE_MARKERS = [
    "skydine",
    "try-arjun",
] as const

/** Hotel-honest Haven showcase assets (shipped under public/uploads/haven-hinoo/). */
export const HAVEN_HONEST_IMAGE_URL = "/uploads/haven-hinoo/lobby.jpg"
export const HAVEN_HONEST_LOGO_URL = "/uploads/haven-hinoo/logo.png"

/** Known bad fixture paths still on LIVE Haven / try-hotel before P1-5. */
export const HAVEN_LEAKED_IMAGE_URL = "/uploads/skydine-cafe/interior.jpg"
export const HAVEN_LEAKED_LOGO_URL = "/uploads/try-arjun.jpg"

export function isLeakedHotelFixtureImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return HOTEL_LEAKED_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

export type HotelImageryBackfill = {
    imageUrl?: string
    shopLogoUrl?: string
}

/**
 * Pure: replace only known cafe/creator leakage paths with hotel-honest URLs.
 * Custom owner uploads that are not skydine / try-arjun are left alone.
 * Empty fields are left alone (create path sets honest URLs explicitly).
 */
export function hotelImageryBackfillPatch(input: {
    imageUrl?: string | null
    shopLogoUrl?: string | null
    honestImageUrl?: string
    honestLogoUrl?: string
}): HotelImageryBackfill | null {
    const honestImage = input.honestImageUrl || HAVEN_HONEST_IMAGE_URL
    const honestLogo = input.honestLogoUrl || HAVEN_HONEST_LOGO_URL
    const patch: HotelImageryBackfill = {}

    if (isLeakedHotelFixtureImage(input.imageUrl)) {
        patch.imageUrl = honestImage
    }
    if (isLeakedHotelFixtureImage(input.shopLogoUrl)) {
        patch.shopLogoUrl = honestLogo
    }

    return Object.keys(patch).length ? patch : null
}

export function isHotelHonestFixtureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (isLeakedHotelFixtureImage(trimmed)) return false
    return (
        trimmed === HAVEN_HONEST_IMAGE_URL ||
        trimmed === HAVEN_HONEST_LOGO_URL ||
        trimmed.startsWith("/uploads/haven-hinoo/") ||
        trimmed.startsWith("/uploads/demo/haven-")
    )
}
