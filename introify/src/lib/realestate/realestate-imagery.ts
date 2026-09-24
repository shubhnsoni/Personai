/**
 * REAL_ESTATE P1-4 - cross-role imagery honesty for Shakti Property fixture.
 *
 * Demo seed previously reused try-atlas (photographer studio) and try-brand
 * (stationery flatlay + Grok mark) as About / header / project heroes. Guests
 * then saw creator/brand-kit chrome on a Lalpur brokerage page.
 *
 * Policy: prefer brokerage assets under /uploads/shakti-property/. Only
 * backfill when the live profile still carries a known leakage path - never
 * wipe a custom owner upload that is not a listed marker.
 */

/** Paths / markers that must never appear as Shakti hero or logo. */
export const REALESTATE_LEAKED_IMAGE_MARKERS = [
    "try-atlas",
    "try-brand",
] as const

/** Brokerage-honest Shakti showcase assets. */
export const SHAKTI_HONEST_IMAGE_URL = "/uploads/shakti-property/desk.jpg"
export const SHAKTI_HONEST_LOGO_URL = "/uploads/shakti-property/mark.png"

/** Known bad fixture paths still on LIVE Shakti before P1-4. */
export const SHAKTI_LEAKED_IMAGE_URL = "/uploads/try-atlas.jpg"
export const SHAKTI_LEAKED_LOGO_URL = "/uploads/try-brand.jpg"

export function isLeakedRealestateFixtureImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return REALESTATE_LEAKED_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

export type RealestateImageryBackfill = {
    imageUrl?: string
    shopLogoUrl?: string
}

/**
 * Pure: replace only known creator-studio / brand-flatlay leakage paths with
 * brokerage-honest URLs. Custom owner uploads that are not listed markers are
 * left alone. Empty fields are left alone.
 */
export function realestateImageryBackfillPatch(input: {
    imageUrl?: string | null
    shopLogoUrl?: string | null
    honestImageUrl?: string
    honestLogoUrl?: string
}): RealestateImageryBackfill | null {
    const honestImage = input.honestImageUrl || SHAKTI_HONEST_IMAGE_URL
    const honestLogo = input.honestLogoUrl || SHAKTI_HONEST_LOGO_URL
    const patch: RealestateImageryBackfill = {}

    if (isLeakedRealestateFixtureImage(input.imageUrl)) {
        patch.imageUrl = honestImage
    }
    if (isLeakedRealestateFixtureImage(input.shopLogoUrl)) {
        patch.shopLogoUrl = honestLogo
    }

    return Object.keys(patch).length ? patch : null
}

export function isRealestateHonestFixtureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (isLeakedRealestateFixtureImage(trimmed)) return false
    return (
        trimmed === SHAKTI_HONEST_IMAGE_URL ||
        trimmed === SHAKTI_HONEST_LOGO_URL ||
        trimmed.startsWith("/uploads/shakti-property/")
    )
}
