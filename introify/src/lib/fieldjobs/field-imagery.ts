/**
 * FIELD P1-3 - cross-role imagery honesty for plumber / electrician / AC /
 * garage / field-crew fixtures.
 *
 * Demo seeds previously reused try-storefront (diner), try-arjun (chef),
 * try-atlas (photographer), try-packaging (flatlay), try-lamp (lifestyle),
 * try-workshop (meeting), plus cafe/skydine interiors as About / header /
 * story / product thumbs. Guests then saw chef/creator/cafe chrome on
 * Ranchi field-service kits.
 *
 * Policy: prefer role-fit assets under /uploads/goodwill-plumbing/,
 * /uploads/jharkhand-field/, /uploads/vicky-electrical/,
 * /uploads/cooling-world/, /uploads/bhola-garage/. Only backfill when the
 * live profile still carries a known leakage path - never wipe a custom
 * owner upload that is not a listed marker.
 */

/** Paths / markers that must never appear as field-fixture hero / logo / story. */
export const FIELD_LEAKED_IMAGE_MARKERS = [
    "try-storefront",
    "try-arjun",
    "try-atlas",
    "try-packaging",
    "try-lamp",
    "try-workshop",
    "try-kabir",
    "try-samir",
    "try-rohan",
    "skydine-cafe",
    "blu-cafe",
] as const

/** Plumber-honest Goodwill showcase assets. */
export const GOODWILL_HONEST_IMAGE_URL = "/uploads/goodwill-plumbing/van.jpg"
export const GOODWILL_HONEST_LOGO_URL = "/uploads/goodwill-plumbing/mark.png"

/** Field-crew-honest Jharkhand showcase assets. */
export const JHARKHAND_HONEST_IMAGE_URL = "/uploads/jharkhand-field/van.jpg"
export const JHARKHAND_HONEST_LOGO_URL = "/uploads/jharkhand-field/mark.png"

/** Electrician-honest Vicky showcase assets. */
export const VICKY_HONEST_IMAGE_URL = "/uploads/vicky-electrical/board.jpg"
export const VICKY_HONEST_LOGO_URL = "/uploads/vicky-electrical/mark.png"

/** AC-honest Cooling World showcase assets. */
export const COOLING_HONEST_IMAGE_URL = "/uploads/cooling-world/outdoor.jpg"
export const COOLING_HONEST_LOGO_URL = "/uploads/cooling-world/mark.png"
export const COOLING_HONEST_SPARE_URL = "/uploads/cooling-world/spare.jpg"

/** Garage-honest Bhola showcase assets. */
export const BHOLA_HONEST_IMAGE_URL = "/uploads/bhola-garage/bay.jpg"
export const BHOLA_HONEST_LOGO_URL = "/uploads/bhola-garage/mark.png"
export const BHOLA_HONEST_SPARE_URL = "/uploads/bhola-garage/spare.jpg"

/** Known bad fixture paths still on LIVE field kits before P1-3. */
export const GOODWILL_LEAKED_IMAGE_URL = "/uploads/try-storefront.jpg"
export const GOODWILL_LEAKED_LOGO_URL = "/uploads/try-arjun.jpg"
export const BHOLA_LEAKED_LOGO_URL = "/uploads/try-atlas.jpg"
export const VICKY_LEAKED_IMAGE_URL = "/uploads/try-lamp.jpg"
export const JHARKHAND_LEAKED_IMAGE_URL = "/uploads/try-workshop.jpg"
export const FIELD_LEAKED_PACKAGING_URL = "/uploads/try-packaging.jpg"

export function isLeakedFieldFixtureImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return FIELD_LEAKED_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

export type FieldImageryBackfill = {
    imageUrl?: string
    shopLogoUrl?: string
}

/**
 * Pure: replace only known chef/diner/creator/cafe leakage paths with
 * field-honest URLs. Custom owner uploads that are not listed markers are
 * left alone. Empty fields are left alone.
 */
export function fieldImageryBackfillPatch(input: {
    imageUrl?: string | null
    shopLogoUrl?: string | null
    honestImageUrl?: string
    honestLogoUrl?: string
}): FieldImageryBackfill | null {
    const honestImage = input.honestImageUrl || GOODWILL_HONEST_IMAGE_URL
    const honestLogo = input.honestLogoUrl || GOODWILL_HONEST_LOGO_URL
    const patch: FieldImageryBackfill = {}

    if (isLeakedFieldFixtureImage(input.imageUrl)) {
        patch.imageUrl = honestImage
    }
    if (isLeakedFieldFixtureImage(input.shopLogoUrl)) {
        patch.shopLogoUrl = honestLogo
    }

    return Object.keys(patch).length ? patch : null
}

const HONEST_PREFIXES = [
    "/uploads/goodwill-plumbing/",
    "/uploads/jharkhand-field/",
    "/uploads/vicky-electrical/",
    "/uploads/cooling-world/",
    "/uploads/bhola-garage/",
] as const

export function isFieldHonestFixtureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (isLeakedFieldFixtureImage(trimmed)) return false
    return HONEST_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
}
