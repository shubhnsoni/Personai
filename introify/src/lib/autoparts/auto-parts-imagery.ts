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
