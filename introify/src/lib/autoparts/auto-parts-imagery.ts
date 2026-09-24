/**
 * AUTO P0-2 - catalogue product photography for Paras Auto (TAKE_ORDERS).
 *
 * Demo PARAS_AUTO seeds previously reused try-lamp / try-mug / try-tote /
 * try-storefront / try-brand / try-lassi lifestyle thumbs. Guests then saw
 * cafe home-decor chrome on brake pads, filters, and batteries.
 *
 * Policy: primary Paras catalogue SKUs point at auto-parts assets under
 * /uploads/paras-auto/ (simple spare-part illustrations — not cafe/home/
 * brand bleed). Cross-role try-* markers stay banned via resolveShopProductImage.
 * FORCE_REFRESH includes paras-auto so Hostinger bootstrap reseeds thumbs.
 */

export const PARAS_AUTO_UPLOAD_PREFIX = "/uploads/paras-auto/" as const

/** Honest Paras catalogue product thumbs (SKU → public URL). */
export const PARAS_AUTO_PRODUCT_IMAGES = {
    "PA-BP-SWIFT": `${PARAS_AUTO_UPLOAD_PREFIX}brake-pad.jpg`,
    "PA-OF-I20": `${PARAS_AUTO_UPLOAD_PREFIX}oil-filter.jpg`,
    "PA-BAT-ALTO": `${PARAS_AUTO_UPLOAD_PREFIX}battery.jpg`,
    "PA-AF-NEXON": `${PARAS_AUTO_UPLOAD_PREFIX}air-filter.jpg`,
    "PA-WP-CITY": `${PARAS_AUTO_UPLOAD_PREFIX}wiper.jpg`,
    "PA-CP-BOLERO": `${PARAS_AUTO_UPLOAD_PREFIX}clutch.jpg`,
    "PA-SP-SWIFT": `${PARAS_AUTO_UPLOAD_PREFIX}spark-plugs.jpg`,
    "PA-RH-I20": `${PARAS_AUTO_UPLOAD_PREFIX}radiator-hose.jpg`,
    "PA-BD-NEXON": `${PARAS_AUTO_UPLOAD_PREFIX}brake-disc.jpg`,
    "PA-CF-CITY": `${PARAS_AUTO_UPLOAD_PREFIX}cabin-filter.jpg`,
} as const

export type ParasAutoSku = keyof typeof PARAS_AUTO_PRODUCT_IMAGES

export const PARAS_AUTO_IMAGE_FILES = [
    "brake-pad.jpg",
    "oil-filter.jpg",
    "battery.jpg",
    "air-filter.jpg",
    "wiper.jpg",
    "clutch.jpg",
    "spark-plugs.jpg",
    "radiator-hose.jpg",
    "brake-disc.jpg",
    "cabin-filter.jpg",
] as const

/** Markers that must never appear as Paras catalogue product art. */
export const AUTO_PARTS_LEAKED_PRODUCT_IMAGE_MARKERS = [
    "try-lamp",
    "try-mug",
    "try-tote",
    "try-storefront",
    "try-store",
    "try-brand",
    "try-lassi",
    "try-mira",
    "try-vase",
    "try-dal",
    "try-naan",
    "try-arjun",
    "try-samir",
    "blu-cafe",
    "skydine-cafe",
    "skydine-dishes",
] as const

export function parasAutoProductImage(sku: string): string | null {
    const url = PARAS_AUTO_PRODUCT_IMAGES[sku as ParasAutoSku]
    return url || null
}

export function isParasAutoProductImage(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    return trimmed.startsWith(PARAS_AUTO_UPLOAD_PREFIX) && trimmed.endsWith(".jpg")
}

export function isLeakedAutoPartsProductImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return AUTO_PARTS_LEAKED_PRODUCT_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

/**
 * AUTO P1-2 - About / header / print mark honesty for Paras Auto.
 *
 * Demo seed previously reused try-storefront (restaurant diner + Grok watermark)
 * and try-brand (stationery flatlay + Grok watermark) as About / header / print
 * heroes. Guests then saw cafe / brand-kit chrome on a Doranda parts counter.
 *
 * Policy: prefer parts-counter assets under /uploads/paras-auto/. Only backfill
 * when the live profile still carries a known leakage path - never wipe a custom
 * owner upload that is not a listed marker. Catalogue SKU thumbs from auto-p0-2
 * stay untouched.
 */

/** Paths / markers that must never appear as Paras About hero or logo. */
export const AUTO_PARTS_LEAKED_DEMO_IMAGE_MARKERS = [
    "try-storefront",
    "try-store",
    "try-brand",
    "img-try-storefront",
    "img-try-store",
    "img-try-brand",
    "restaurant",
    "diner",
] as const

/** Auto-parts-honest Paras showcase assets. */
export const PARAS_HONEST_IMAGE_URL = "/uploads/paras-auto/desk.jpg"
export const PARAS_HONEST_LOGO_URL = "/uploads/paras-auto/mark.png"

/** Known bad fixture paths still on LIVE Paras before P1-2. */
export const PARAS_LEAKED_IMAGE_URL = "/uploads/try-storefront.jpg"
export const PARAS_LEAKED_LOGO_URL = "/uploads/try-brand.jpg"

export function isLeakedAutoPartsDemoImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return AUTO_PARTS_LEAKED_DEMO_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}

export type ParasImageryBackfill = {
    imageUrl?: string
    shopLogoUrl?: string
}

/**
 * Pure: replace only known diner / brand-flatlay leakage paths with
 * parts-counter-honest URLs. Custom owner uploads that are not listed markers
 * are left alone. Empty fields are left alone.
 */
export function parasImageryBackfillPatch(input: {
    imageUrl?: string | null
    shopLogoUrl?: string | null
    honestImageUrl?: string
    honestLogoUrl?: string
}): ParasImageryBackfill | null {
    const honestImage = input.honestImageUrl || PARAS_HONEST_IMAGE_URL
    const honestLogo = input.honestLogoUrl || PARAS_HONEST_LOGO_URL
    const patch: ParasImageryBackfill = {}

    if (isLeakedAutoPartsDemoImage(input.imageUrl)) {
        patch.imageUrl = honestImage
    }
    if (isLeakedAutoPartsDemoImage(input.shopLogoUrl)) {
        patch.shopLogoUrl = honestLogo
    }

    return Object.keys(patch).length ? patch : null
}

export function isAutoPartsHonestFixtureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    if (isLeakedAutoPartsDemoImage(trimmed)) return false
    return (
        trimmed === PARAS_HONEST_IMAGE_URL ||
        trimmed === PARAS_HONEST_LOGO_URL ||
        trimmed.startsWith(PARAS_AUTO_UPLOAD_PREFIX)
    )
}
