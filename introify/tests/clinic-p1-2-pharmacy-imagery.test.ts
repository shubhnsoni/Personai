// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    isCrossRoleShopProductImage,
    resolveShopProductImage,
    usesStrictShopProductImagery,
} from "@/lib/shop-product-imagery"
import { SANJIVANI_MEDICO } from "@/lib/demo-shops/shop"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const BRAND = "/uploads/try-brand.jpg"
const MUG = "/uploads/try-mug.jpg"
const LASSI = "/uploads/try-lassi.jpg"
const LAMP = "/uploads/try-lamp.jpg"
const BLU_COFFEE = "/uploads/blu-cafe/cup-coffee.jpg"
const HONEST = "/uploads/pharmacy/paracetamol-strip.jpg"

describe("clinic P1-2 pharmacy menu medicine imagery (sanjivani)", () => {
    it("treats PHARMACY as strict product imagery", () => {
        expect(usesStrictShopProductImagery("PHARMACY")).toBe(true)
        expect(usesStrictShopProductImagery("KIRANA")).toBe(true)
        expect(usesStrictShopProductImagery("RESTAURANT")).toBe(false)
        expect(usesStrictShopProductImagery("CAFE")).toBe(false)
    })

    it("nulls cafe/desk/smoothie stock thumbs for pharmacy roles", () => {
        expect(isCrossRoleShopProductImage(BRAND)).toBe(true)
        expect(isCrossRoleShopProductImage(MUG)).toBe(true)
        expect(isCrossRoleShopProductImage(LASSI)).toBe(true)
        expect(isCrossRoleShopProductImage(LAMP)).toBe(true)
        expect(isCrossRoleShopProductImage(BLU_COFFEE)).toBe(true)
        expect(resolveShopProductImage({ role: "PHARMACY", thumbnailUrl: BRAND })).toBeNull()
        expect(resolveShopProductImage({ role: "PHARMACY", thumbnailUrl: MUG })).toBeNull()
        expect(resolveShopProductImage({ role: "PHARMACY", thumbnailUrl: LASSI })).toBeNull()
        expect(resolveShopProductImage({ role: "PHARMACY", thumbnailUrl: LAMP })).toBeNull()
        expect(resolveShopProductImage({ role: "PHARMACY", thumbnailUrl: BLU_COFFEE })).toBeNull()
        expect(resolveShopProductImage({ role: "PHARMACY", thumbnailUrl: HONEST })).toBe(HONEST)
    })

    it("Sanjivani MEDICINES seeds ship without thumbnailUrls", () => {
        expect(SANJIVANI_MEDICO.slug).toBe("sanjivani-medico")
        expect(SANJIVANI_MEDICO.flavor).toBe("PHARMACY")
        expect(SANJIVANI_MEDICO.products?.length).toBeGreaterThanOrEqual(10)
        for (const product of SANJIVANI_MEDICO.products || []) {
            const url = product.thumbnailUrl || null
            expect(url, `sanjivani-medico ${product.title}`).toBeFalsy()
            expect(isCrossRoleShopProductImage(url)).toBe(false)
            expect(
                resolveShopProductImage({ role: SANJIVANI_MEDICO.flavor, thumbnailUrl: url }),
            ).toBeNull()
        }
        const titles = (SANJIVANI_MEDICO.products || []).map((p) => p.title)
        expect(titles).toEqual(
            expect.arrayContaining([
                "Paracetamol 650",
                "Amoxicillin 500",
                "Azithromycin 500",
                "ORS lemon 21g",
                "Cough syrup 100ml",
                "Povidone iodine 15g",
                "Metformin 500",
            ]),
        )
    })

    it("force-refreshes sanjivani-medico so cleared thumbs reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("sanjivani-medico")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "sanjivani-medico", products: [{}, {}], services: [] }, 10, 0, false),
        ).toBe(false)
    })
})
