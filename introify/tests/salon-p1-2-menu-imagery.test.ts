// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    isCrossRoleShopProductImage,
    resolveShopProductImage,
    usesStrictShopProductImagery,
} from "@/lib/shop-product-imagery"
import { H_SQUARE_SALON, PRINCE_BARBER } from "@/lib/demo-shops/book"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const MUG = "/uploads/try-mug.jpg"
const LAMP = "/uploads/try-lamp.jpg"
const VASE = "/uploads/try-vase.jpg"
const PACK = "/uploads/try-packaging.jpg"
const CREATINE = "/uploads/demo/creatine.jpg"
const HONEST = "/uploads/salon/hair-oil.jpg"

describe("salon P1-2 menu product imagery", () => {
    it("treats salon/spa/barber kit as strict product imagery", () => {
        expect(usesStrictShopProductImagery("SALON_SPA")).toBe(true)
        expect(usesStrictShopProductImagery("BARBER")).toBe(true)
        expect(usesStrictShopProductImagery("GYM")).toBe(true)
        expect(usesStrictShopProductImagery("YOGA")).toBe(true)
        expect(usesStrictShopProductImagery("PET_GROOMING")).toBe(true)
        expect(usesStrictShopProductImagery("RESTAURANT")).toBe(false)
        expect(usesStrictShopProductImagery("CAFE")).toBe(false)
    })

    it("nulls mug/lamp/vase/gift-box thumbs for salon and barber roles", () => {
        expect(resolveShopProductImage({ role: "SALON_SPA", thumbnailUrl: MUG })).toBeNull()
        expect(resolveShopProductImage({ role: "SALON_SPA", thumbnailUrl: LAMP })).toBeNull()
        expect(resolveShopProductImage({ role: "SALON_SPA", thumbnailUrl: VASE })).toBeNull()
        expect(resolveShopProductImage({ role: "SALON_SPA", thumbnailUrl: PACK })).toBeNull()
        expect(resolveShopProductImage({ role: "BARBER", thumbnailUrl: MUG })).toBeNull()
        expect(resolveShopProductImage({ role: "BARBER", thumbnailUrl: PACK })).toBeNull()
        expect(resolveShopProductImage({ role: "SALON_SPA", thumbnailUrl: HONEST })).toBe(HONEST)
        // Gym tub is not a shared cross-role marker (gym SKUs may use it honestly);
        // salon seeds omit it instead of remapping to another wrong stock asset.
        expect(isCrossRoleShopProductImage(CREATINE)).toBe(false)
    })

    it("H Square + Prince retail seeds ship without cross-role thumbnailUrls", () => {
        expect(H_SQUARE_SALON.slug).toBe("h-square-salon-harmu")
        expect(PRINCE_BARBER.slug).toBe("prince-barber-lalpur")
        expect(H_SQUARE_SALON.products?.length).toBeGreaterThanOrEqual(6)
        expect(PRINCE_BARBER.products?.length).toBeGreaterThanOrEqual(5)
        for (const shop of [H_SQUARE_SALON, PRINCE_BARBER]) {
            for (const product of shop.products || []) {
                const url = product.thumbnailUrl || null
                expect(url, `${shop.slug} ${product.title}`).toBeFalsy()
                expect(isCrossRoleShopProductImage(url)).toBe(false)
                expect(
                    resolveShopProductImage({ role: shop.flavor, thumbnailUrl: url }),
                ).toBeNull()
            }
        }
        const titles = (H_SQUARE_SALON.products || []).map((p) => p.title)
        expect(titles).toEqual(
            expect.arrayContaining([
                "Hair oil 100ml",
                "Shampoo 200ml",
                "Conditioner 200ml",
                "Hair serum 50ml",
                "Face pack 50g",
                "Nail colour",
            ]),
        )
    })

    it("force-refreshes H Square + Prince so cleared thumbs reseed on bootstrap", () => {
        for (const slug of ["h-square-salon-harmu", "prince-barber-lalpur"] as const) {
            expect(FORCE_REFRESH_SLUGS.has(slug)).toBe(true)
            expect(shouldSkipPopulated({ slug, products: [{}, {}], services: [] }, 10, 0, false)).toBe(false)
        }
    })
})