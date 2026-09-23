// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    CROSS_ROLE_SHOP_IMAGE_MARKERS,
    isCrossRoleShopProductImage,
    resolveShopProductImage,
    usesStrictShopProductImagery,
} from "@/lib/shop-product-imagery"
import { RAGHUVANSHI_STORES, FIRAYALAL_NXT, MK_JEWELLERS } from "@/lib/demo-shops/shop"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const FOOD = "/uploads/try-dal.jpg"
const NAAN = "/uploads/try-naan.jpg"
const LAMP = "/uploads/try-lamp.jpg"
const MIRA = "/uploads/try-mira.jpg"
const TOTE = "/uploads/try-tote.jpg"
const HONEST_GROCERY = "/uploads/shop/kirana/toor-dal.jpg"
const HONEST_GOLD = "/uploads/shop/jewelry/bangle-22k.jpg"

describe("P0-1 role-aware shop product imagery", () => {
    it("marks food AR, cafe, home/decor, and people stock as cross-role", () => {
        expect(isCrossRoleShopProductImage(FOOD)).toBe(true)
        expect(isCrossRoleShopProductImage(NAAN)).toBe(true)
        expect(isCrossRoleShopProductImage(LAMP)).toBe(true)
        expect(isCrossRoleShopProductImage(MIRA)).toBe(true)
        expect(isCrossRoleShopProductImage(TOTE)).toBe(true)
        expect(isCrossRoleShopProductImage("/uploads/skydine-cafe/plates.jpg")).toBe(true)
        expect(isCrossRoleShopProductImage(HONEST_GROCERY)).toBe(false)
        expect(isCrossRoleShopProductImage(null)).toBe(false)
        expect(CROSS_ROLE_SHOP_IMAGE_MARKERS.length).toBeGreaterThanOrEqual(10)
    })

    it("applies strict imagery to KIRANA / BOUTIQUE / jewellery, never to restaurant/cafe/bakery", () => {
        expect(usesStrictShopProductImagery("KIRANA")).toBe(true)
        expect(usesStrictShopProductImagery("BOUTIQUE")).toBe(true)
        expect(usesStrictShopProductImagery("JEWELRY_RETAIL")).toBe(true)
        expect(usesStrictShopProductImagery("JEWELRY_WHOLESALE")).toBe(true)
        expect(usesStrictShopProductImagery("SHOP")).toBe(true)
        expect(usesStrictShopProductImagery("RESTAURANT")).toBe(false)
        expect(usesStrictShopProductImagery("CAFE")).toBe(false)
        expect(usesStrictShopProductImagery("BAKERY")).toBe(false)
        expect(usesStrictShopProductImagery("SWEETS")).toBe(false)
    })

    it("returns null (neutral placeholder) when a shop role would show cross-role stock", () => {
        expect(resolveShopProductImage({ role: "KIRANA", thumbnailUrl: FOOD })).toBeNull()
        expect(
            resolveShopProductImage({ role: "BOUTIQUE", thumbnailUrl: MIRA, galleryUrls: [LAMP, TOTE] }),
        ).toBeNull()
        expect(resolveShopProductImage({ role: "JEWELRY_RETAIL", thumbnailUrl: LAMP })).toBeNull()
        expect(resolveShopProductImage({ role: "KIRANA", thumbnailUrl: HONEST_GROCERY })).toBe(HONEST_GROCERY)
        expect(resolveShopProductImage({ role: "JEWELRY_RETAIL", thumbnailUrl: HONEST_GOLD })).toBe(HONEST_GOLD)
    })

    it("does not strip food thumbnails for restaurant/cafe/bakery surfaces", () => {
        expect(resolveShopProductImage({ role: "RESTAURANT", thumbnailUrl: FOOD })).toBe(FOOD)
        expect(resolveShopProductImage({ role: "CAFE", thumbnailUrl: NAAN })).toBe(NAAN)
        expect(resolveShopProductImage({ role: "BAKERY", thumbnailUrl: FOOD })).toBe(FOOD)
        expect(resolveShopProductImage({ role: "SWEETS", thumbnailUrl: FOOD })).toBe(FOOD)
    })

    it("Raghuvanshi / Firayalal / MK demo products ship without cross-role thumbnailUrls", () => {
        for (const shop of [RAGHUVANSHI_STORES, FIRAYALAL_NXT, MK_JEWELLERS]) {
            expect(shop.products?.length).toBeGreaterThanOrEqual(8)
            for (const product of shop.products || []) {
                const url = product.thumbnailUrl || null
                expect(isCrossRoleShopProductImage(url)).toBe(false)
                if (url) {
                    expect(resolveShopProductImage({ role: shop.flavor, thumbnailUrl: url })).toBe(url)
                } else {
                    expect(resolveShopProductImage({ role: shop.flavor, thumbnailUrl: url })).toBeNull()
                }
            }
        }
        expect(RAGHUVANSHI_STORES.slug).toBe("raghuvanshi-stores")
        expect(FIRAYALAL_NXT.slug).toBe("firayalal-nxt")
        expect(MK_JEWELLERS.slug).toBe("mk-jewellers")
    })

    it("force-refreshes the three LIVE shop fixtures so cleared thumbs reseed", () => {
        for (const slug of ["raghuvanshi-stores", "firayalal-nxt", "mk-jewellers"] as const) {
            expect(FORCE_REFRESH_SLUGS.has(slug)).toBe(true)
            expect(shouldSkipPopulated({ slug, products: [{}, {}], services: [] }, 10, 0, false)).toBe(false)
        }
    })
})
