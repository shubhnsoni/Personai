// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    isCrossRoleShopProductImage,
    resolveShopProductImage,
    usesStrictShopProductImagery,
} from "@/lib/shop-product-imagery"
import { AURA_FITNESS, FITNESS_ADDICTION, FIT24, NATRAJ_YOGA } from "@/lib/demo-shops/book"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const BLU_COFFEE = "/uploads/blu-cafe/cup-coffee.jpg"
const BLU_MUFFIN = "/uploads/blu-cafe/muffin.jpg"
const MUG = "/uploads/try-mug.jpg"
const PACK = "/uploads/try-packaging.jpg"
const WHEY = "/uploads/demo/whey.jpg"
const CREATINE = "/uploads/demo/creatine.jpg"
const FLOOR = "/uploads/demo/gym-floor.jpg"

describe("gym P1-2 menu product imagery", () => {
    it("treats GYM/YOGA as strict product imagery (salon kit alias)", () => {
        expect(usesStrictShopProductImagery("GYM")).toBe(true)
        expect(usesStrictShopProductImagery("YOGA")).toBe(true)
        expect(usesStrictShopProductImagery("SALON_SPA")).toBe(true)
        expect(usesStrictShopProductImagery("RESTAURANT")).toBe(false)
    })

    it("nulls blu-cafe coffee/muffin and cafe/home-decor thumbs for gym roles", () => {
        expect(isCrossRoleShopProductImage(BLU_COFFEE)).toBe(true)
        expect(isCrossRoleShopProductImage(BLU_MUFFIN)).toBe(true)
        expect(resolveShopProductImage({ role: "GYM", thumbnailUrl: BLU_COFFEE })).toBeNull()
        expect(resolveShopProductImage({ role: "GYM", thumbnailUrl: BLU_MUFFIN })).toBeNull()
        expect(resolveShopProductImage({ role: "GYM", thumbnailUrl: MUG })).toBeNull()
        expect(resolveShopProductImage({ role: "GYM", thumbnailUrl: PACK })).toBeNull()
        // Honest gym tubs/floor are not cross-role markers; seeds omit recycled uses instead.
        expect(isCrossRoleShopProductImage(WHEY)).toBe(false)
        expect(isCrossRoleShopProductImage(CREATINE)).toBe(false)
        expect(isCrossRoleShopProductImage(FLOOR)).toBe(false)
    })

    it("Fitness Addiction + Aura + Fit24 retail seeds ship without thumbnailUrls", () => {
        expect(FITNESS_ADDICTION.slug).toBe("fitness-addiction-doranda")
        expect(AURA_FITNESS.slug).toBe("aura-fitness-ranchi")
        expect(FIT24.slug).toBe("fit24-ranchi")
        for (const shop of [FITNESS_ADDICTION, AURA_FITNESS, FIT24]) {
            expect(shop.products?.length).toBeGreaterThanOrEqual(6)
            for (const product of shop.products || []) {
                const url = product.thumbnailUrl || null
                expect(url, `${shop.slug} ${product.title}`).toBeFalsy()
                expect(
                    resolveShopProductImage({ role: shop.flavor, thumbnailUrl: url }),
                ).toBeNull()
            }
        }
        const faTitles = (FITNESS_ADDICTION.products || []).map((p) => p.title)
        expect(faTitles).toEqual(
            expect.arrayContaining([
                "Whey protein 1kg",
                "Shaker 700ml",
                "Energy bar box",
                "Lifting gloves",
            ]),
        )
        const auraTitles = (AURA_FITNESS.products || []).map((p) => p.title)
        expect(auraTitles).toEqual(
            expect.arrayContaining([
                "Pre-workout 250g",
                "Shaker 700ml",
                "Lifting straps",
                "Gym towel",
            ]),
        )
    })

    it("force-refreshes faddict + aura + fit24 so cleared thumbs reseed on bootstrap", () => {
        for (const slug of [
            "fitness-addiction-doranda",
            "aura-fitness-ranchi",
            "fit24-ranchi",
        ] as const) {
            expect(FORCE_REFRESH_SLUGS.has(slug)).toBe(true)
            expect(shouldSkipPopulated({ slug, products: [{}, {}], services: [] }, 10, 0, false)).toBe(false)
        }
    })

    it("Natraj yoga gear seed still present (regression: catalog non-empty)", () => {
        expect(NATRAJ_YOGA.slug).toBe("natraj-yoga-kutchery")
        expect(NATRAJ_YOGA.products?.length).toBeGreaterThanOrEqual(5)
        const titles = (NATRAJ_YOGA.products || []).map((p) => p.title)
        expect(titles).toEqual(expect.arrayContaining(["Yoga mat", "Yoga block", "Yoga strap"]))
    })
})
