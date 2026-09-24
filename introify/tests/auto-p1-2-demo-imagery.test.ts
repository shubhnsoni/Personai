// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    AUTO_PARTS_LEAKED_DEMO_IMAGE_MARKERS,
    PARAS_AUTO_PRODUCT_IMAGES,
    PARAS_HONEST_IMAGE_URL,
    PARAS_HONEST_LOGO_URL,
    PARAS_LEAKED_IMAGE_URL,
    PARAS_LEAKED_LOGO_URL,
    parasImageryBackfillPatch,
    isAutoPartsHonestFixtureUrl,
    isLeakedAutoPartsDemoImage,
} from "@/lib/autoparts/auto-parts-imagery"
import { PARAS_AUTO, MK_JEWELLERS } from "@/lib/demo-shops/shop"
import { NITA_RECRUITERS, SHAKTI_PROPERTY, NEXT_LEVEL_EVENTS } from "@/lib/demo-shops/studio"
import { GOODWILL_PLUMBING } from "@/lib/demo-shops/field"
import { AURA_FITNESS } from "@/lib/demo-shops/book"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const root = process.cwd()

const LEAKED = [
    "/uploads/try-storefront.jpg",
    "/uploads/try-brand.jpg",
    "/uploads/img-try-storefront.jpg",
] as const

function collectUrls(shop: {
    imageUrl?: string
    shopLogoUrl?: string
}): string[] {
    const out: string[] = []
    if (shop.imageUrl) out.push(shop.imageUrl)
    if (shop.shopLogoUrl) out.push(shop.shopLogoUrl)
    return out
}

describe("AUTO P1-2 - Paras fixture URLs are parts-counter-honest", () => {
    it("PARAS_AUTO uses paras-auto desk + mark (no try-storefront/try-brand)", () => {
        expect(PARAS_AUTO.slug).toBe("paras-auto")
        expect(PARAS_AUTO.flavor).toBe("AUTO_PARTS")
        expect(PARAS_AUTO.imageUrl).toBe(PARAS_HONEST_IMAGE_URL)
        expect(PARAS_AUTO.shopLogoUrl).toBe(PARAS_HONEST_LOGO_URL)
        for (const url of collectUrls(PARAS_AUTO)) {
            expect(url).not.toMatch(/try-storefront|try-brand|img-try-storefront|img-try-brand|restaurant|diner/i)
            expect(isLeakedAutoPartsDemoImage(url)).toBe(false)
            expect(isAutoPartsHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("shipped paras-auto About/header assets exist on disk", () => {
        expect(existsSync(join(root, "public/uploads/paras-auto/desk.jpg"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/paras-auto/mark.png"))).toBe(true)
    })

    it("leaves auto-p0-2 catalogue SKU thumbs untouched", () => {
        for (const product of PARAS_AUTO.products || []) {
            expect(product.thumbnailUrl).toBe(
                PARAS_AUTO_PRODUCT_IMAGES[product.sku as keyof typeof PARAS_AUTO_PRODUCT_IMAGES],
            )
            expect(product.thumbnailUrl).toMatch(/^\/uploads\/paras-auto\/.+\.jpg$/)
            expect(product.thumbnailUrl).not.toMatch(/desk\.jpg|mark\.png/)
        }
    })
})

describe("AUTO P1-2 - leakage detect + backfill helper", () => {
    it("flags try-storefront / try-brand and known bad LIVE paths", () => {
        expect(AUTO_PARTS_LEAKED_DEMO_IMAGE_MARKERS).toEqual(
            expect.arrayContaining([
                "try-storefront",
                "try-store",
                "try-brand",
                "img-try-storefront",
                "img-try-brand",
                "restaurant",
                "diner",
            ]),
        )
        for (const url of LEAKED) {
            expect(isLeakedAutoPartsDemoImage(url)).toBe(true)
        }
        expect(isLeakedAutoPartsDemoImage(PARAS_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedAutoPartsDemoImage(PARAS_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedAutoPartsDemoImage("/uploads/restaurant-diner.jpg")).toBe(true)
        expect(isLeakedAutoPartsDemoImage(PARAS_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedAutoPartsDemoImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedAutoPartsDemoImage(null)).toBe(false)
        expect(isLeakedAutoPartsDemoImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            parasImageryBackfillPatch({
                imageUrl: PARAS_LEAKED_IMAGE_URL,
                shopLogoUrl: PARAS_LEAKED_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: PARAS_HONEST_IMAGE_URL,
            shopLogoUrl: PARAS_HONEST_LOGO_URL,
        })

        expect(
            parasImageryBackfillPatch({
                imageUrl: PARAS_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
            }),
        ).toEqual({ imageUrl: PARAS_HONEST_IMAGE_URL })

        expect(
            parasImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            parasImageryBackfillPatch({
                imageUrl: PARAS_HONEST_IMAGE_URL,
                shopLogoUrl: PARAS_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        expect(parasImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("AUTO P1-2 - seed wiring + prior roles untouched", () => {
    it("force-refreshes paras-auto so honest heroes reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("paras-auto")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "paras-auto", products: [{}, {}], services: [] }, 10, 0, false),
        ).toBe(false)
    })

    it("Aura / Goodwill / Shakti / NLE / Nita / MK keep their own assets (no Paras bleed)", () => {
        expect(AURA_FITNESS.imageUrl).toMatch(/aura-fitness|floor/i)
        expect(AURA_FITNESS.imageUrl).not.toMatch(/paras-auto/i)
        expect(GOODWILL_PLUMBING.imageUrl).toBe("/uploads/goodwill-plumbing/van.jpg")
        expect(GOODWILL_PLUMBING.imageUrl).not.toMatch(/paras-auto/i)
        expect(SHAKTI_PROPERTY.imageUrl).toBe("/uploads/shakti-property/desk.jpg")
        expect(SHAKTI_PROPERTY.imageUrl).not.toMatch(/paras-auto/i)
        expect(NEXT_LEVEL_EVENTS.imageUrl).toBe("/uploads/events-studio/hall.jpg")
        expect(NEXT_LEVEL_EVENTS.imageUrl).not.toMatch(/paras-auto/i)
        expect(NITA_RECRUITERS.imageUrl).toBe("/uploads/nita-recruiters/desk.jpg")
        expect(NITA_RECRUITERS.imageUrl).not.toMatch(/paras-auto/i)
        expect(MK_JEWELLERS.imageUrl).toBe("/uploads/mk-jewellers/desk.jpg")
        expect(MK_JEWELLERS.imageUrl).not.toMatch(/paras-auto/i)
        expect(collectUrls(MK_JEWELLERS).join(" ")).not.toMatch(/paras-auto\/desk|paras-auto\/mark/)
    })
})
