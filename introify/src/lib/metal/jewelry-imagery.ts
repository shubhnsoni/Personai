/**
 * JEWELRY P1-2 — catalogue product photography for MK Jewellers (TAKE_ORDERS).
 *
 * Shop P0-1 cleared cross-role cafe/home/people thumbs on jewellery SKUs, so
 * LIVE /menu cards fell through to navy PHYSICAL Package placeholders and PDP
 * showed an empty soft gradient. Guests then saw empty retail chrome on
 * mangalsutra / bangle / coin tickets that already carry honest weight + ₹.
 *
 * Policy: primary MK catalogue SKUs point at jewellery-class assets under
 * /uploads/mk-jewellers/ (velvet-tray gold/silver illustrations — not
 * creator/brand/chef bleed). Cross-role try-* markers stay banned via
 * resolveShopProductImage. FORCE_REFRESH already includes mk-jewellers so
 * Hostinger bootstrap reseeds thumbs.
 */

export const MK_JEWELLERY_UPLOAD_PREFIX = "/uploads/mk-jewellers/" as const

/** Honest MK catalogue product thumbs (SKU → public URL). */
export const MK_JEWELLERY_PRODUCT_IMAGES = {
    "MK-BAN-10": `${MK_JEWELLERY_UPLOAD_PREFIX}bangle.jpg`,
    "MK-CH-19": `${MK_JEWELLERY_UPLOAD_PREFIX}chain.jpg`,
    "MK-ST-4": `${MK_JEWELLERY_UPLOAD_PREFIX}studs.jpg`,
    "MK-RG-6": `${MK_JEWELLERY_UPLOAD_PREFIX}ring.jpg`,
    "MK-MS-11": `${MK_JEWELLERY_UPLOAD_PREFIX}mangalsutra.jpg`,
    "MK-PD-5": `${MK_JEWELLERY_UPLOAD_PREFIX}pendant.jpg`,
    "MK-KD-17": `${MK_JEWELLERY_UPLOAD_PREFIX}kada.jpg`,
    "MK-COIN-8": `${MK_JEWELLERY_UPLOAD_PREFIX}coin.jpg`,
    "MK-DIA-3": `${MK_JEWELLERY_UPLOAD_PREFIX}diamond-ring.jpg`,
    "MK-SL-PAY-28": `${MK_JEWELLERY_UPLOAD_PREFIX}payal.jpg`,
} as const

export type MkJewellerySku = keyof typeof MK_JEWELLERY_PRODUCT_IMAGES

export const MK_JEWELLERY_IMAGE_FILES = [
    "bangle.jpg",
    "chain.jpg",
    "studs.jpg",
    "ring.jpg",
    "mangalsutra.jpg",
    "pendant.jpg",
    "kada.jpg",
    "coin.jpg",
    "diamond-ring.jpg",
    "payal.jpg",
] as const

/** Markers that must never appear as MK catalogue product art. */
export const JEWELRY_LEAKED_PRODUCT_IMAGE_MARKERS = [
    "try-mira",
    "try-brand",
    "try-lamp",
    "try-vase",
    "try-tote",
    "try-mug",
    "try-dal",
    "try-naan",
    "try-arjun",
    "try-samir",
    "blu-cafe",
    "skydine-cafe",
    "skydine-dishes",
] as const

export function mkJewelleryProductImage(sku: string): string | null {
    const url = MK_JEWELLERY_PRODUCT_IMAGES[sku as MkJewellerySku]
    return url || null
}

export function isMkJewelleryProductImage(url: string | null | undefined): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed) return false
    return trimmed.startsWith(MK_JEWELLERY_UPLOAD_PREFIX) && trimmed.endsWith(".jpg")
}

export function isLeakedJewelryProductImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return JEWELRY_LEAKED_PRODUCT_IMAGE_MARKERS.some((marker) => lower.includes(marker))
}
