/**
 * RECRUIT P1-3 - cross-role imagery honesty for Nita Recruiters fixture.
 *
 * Demo seed previously reused try-brand (stationery flatlay + Grok mark) and
 * try-samir (creator/product-sketch + Grok watermark) as About / header /
 * print heroes. Guests then saw creator/brand-kit chrome on an Ashok Nagar
 * hiring desk.
 *
 * Policy: prefer recruiter assets under /uploads/nita-recruiters/. Only
 * backfill when the live profile still carries a known leakage path - never
 * wipe a custom owner upload that is not a listed marker.
 */

/** Paths / markers that must never appear as Nita hero or logo. */
export const RECRUIT_LEAKED_IMAGE_MARKERS = [
    "try-samir",
    "try-brand",
    "img-try-samir",
    "img-try-brand",
] as const

/** Recruiter-honest Nita showcase assets. */
export const NITA_HONEST_IMAGE_URL = "/uploads/nita-recruiters/desk.jpg"
export const NITA_HONEST_LOGO_URL = "/uploads/nita-recruiters/mark.png"

/** Known bad fixture paths still on LIVE Nita before P1-3. */
export const NITA_LEAKED_IMAGE_URL = "/uploads/try-brand.jpg"
export const NITA_LEAKED_LOGO_URL = "/uploads/try-samir.jpg"

export function isLeakedRecruitFixtureImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return RECRUIT_LEAKED_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

export type RecruitImageryBackfill = {
    imageUrl?: string
    shopLogoUrl?: string
}

/**
 * Pure: replace only known creator-sketch / brand-flatlay leakage paths with
 * recruiter-honest URLs. Custom owner uploads that are not listed markers are
 * left alone. Empty fields are left alone.
 */
export function recruitImageryBackfillPatch(input: {
    imageUrl?: string | null
    shopLogoUrl?: string | null
    honestImageUrl?: string
    honestLogoUrl?: string
}): RecruitImageryBackfill | null {
    const honestImage = input.honestImageUrl || NITA_HONEST_IMAGE_URL
    const honestLogo = input.honestLogoUrl || NITA_HONEST_LOGO_URL
    const patch: RecruitImageryBackfill = {}

    if (isLeakedRecruitFixtureImage(input.imageUrl)) {
        patch.imageUrl = honestImage
    }
    if (isLeakedRecruitFixtureImage(input.shopLogoUrl)) {
        patch.shopLogoUrl = honestLogo
    }

    return Object.keys(patch).length ? patch : null
}

export function isRecruitHonestFixtureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (isLeakedRecruitFixtureImage(trimmed)) return false
    return (
        trimmed === NITA_HONEST_IMAGE_URL ||
        trimmed === NITA_HONEST_LOGO_URL ||
        trimmed.startsWith("/uploads/nita-recruiters/")
    )
}
