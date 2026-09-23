import { isRestaurant } from "@/lib/menu"
import { resolveKitRole } from "@/lib/role-alias"
import { isJewelryKit } from "@/lib/metal/math"

/**
 * P0-1 / salon P1-2 - Role-aware shop + salon/barber product imagery.
 *
 * Demo SHOP/grocery/textile/jewellery seeds previously reused cafe AR dishes,
 * lifestyle home decor, and people stills as product thumbnails. Guests then
 * saw dal cards with plated meals, sarees with pottery, and gold with lamps.
 *
 * Policy: for strict shop roles, only keep a thumbnail when it is not a known
 * cross-role stock asset. Otherwise return null so ShopCover renders the
 * explicit neutral type placeholder (no invented product photo).
 */

/** Filename/path markers for food AR, cafe, home/decor, gift packaging, and people stock. */
export const CROSS_ROLE_SHOP_IMAGE_MARKERS = [
    "/uploads/try-dal.jpg",
    "/uploads/try-naan.jpg",
    "/uploads/try-butter.jpg",
    "/uploads/try-lassi.jpg",
    "/uploads/try-mira.jpg",
    "/uploads/try-arjun.jpg",
    "/uploads/try-lamp.jpg",
    "/uploads/try-vase.jpg",
    "/uploads/try-tote.jpg",
    "/uploads/try-mug.jpg",
    "/uploads/try-brand.jpg",
    "/uploads/try-packaging.jpg",
    "/uploads/skydine-cafe/",
    "/uploads/skydine-dishes/",
    "/uploads/skydine-ar/",
    "themealdb.com",
    "loremflickr.com/",
] as const

/** Flavors / role templates that must never fall through to food/home/people stock. */
export const STRICT_SHOP_IMAGE_ROLES = new Set([
    "SHOP",
    "KIRANA",
    "BOUTIQUE",
    "OPTICS",
    "FLORIST",
    "PRINT_SHOP",
    "JEWELRY_RETAIL",
    "JEWELRY_WHOLESALE",
])

export function isCrossRoleShopProductImage(url: string | null | undefined): boolean {
    if (!url) return false
    const lower = url.trim().toLowerCase()
    if (!lower) return false
    return CROSS_ROLE_SHOP_IMAGE_MARKERS.some((marker) => lower.includes(marker.toLowerCase()))
}

export function usesStrictShopProductImagery(roleOrFlavor?: string | null): boolean {
    if (!roleOrFlavor) return false
    if (isRestaurant(roleOrFlavor)) return false
    if (STRICT_SHOP_IMAGE_ROLES.has(roleOrFlavor)) return true
    if (isJewelryKit(roleOrFlavor)) return true
    const kit = resolveKitRole(roleOrFlavor)
    // Salon/spa/barber (and gym/yoga/pet-grooming aliases) retail on /menu must not
    // show cafe home-decor / gift-box / gym-tub stock as product art.
    if (kit === "SALON_SPA" || roleOrFlavor === "SALON_SPA") return true
    return kit === "SHOP"
}

/**
 * Resolve a catalog/detail thumbnail for a shop-role surface.
 * Returns the URL unchanged for restaurants and other non-strict roles.
 * Returns null (neutral placeholder) when a strict shop role would otherwise
 * show a known cross-role food/home/people asset.
 */
export function resolveShopProductImage(input: {
    role?: string | null
    flavor?: string | null
    thumbnailUrl?: string | null
    galleryUrls?: string | null | string[]
}): string | null {
    const role = input.role || input.flavor || null
    const candidates: string[] = []
    const thumb = typeof input.thumbnailUrl === "string" ? input.thumbnailUrl.trim() : ""
    if (thumb) candidates.push(thumb)
    if (Array.isArray(input.galleryUrls)) {
        for (const g of input.galleryUrls) {
            const u = typeof g === "string" ? g.trim() : ""
            if (u) candidates.push(u)
        }
    } else if (typeof input.galleryUrls === "string" && input.galleryUrls.trim()) {
        try {
            const parsed = JSON.parse(input.galleryUrls) as unknown
            if (Array.isArray(parsed)) {
                for (const g of parsed) {
                    if (typeof g === "string" && g.trim()) candidates.push(g.trim())
                }
            }
        } catch {
            /* plain URL or comma list */
            for (const part of input.galleryUrls.split(/[\n,]/)) {
                const u = part.trim()
                if (u) candidates.push(u)
            }
        }
    }

    if (!usesStrictShopProductImagery(role)) {
        return candidates[0] || null
    }

    for (const url of candidates) {
        if (!isCrossRoleShopProductImage(url)) return url
    }
    return null
}
