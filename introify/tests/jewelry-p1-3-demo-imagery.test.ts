// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    JEWELRY_LEAKED_DEMO_IMAGE_MARKERS,
    MK_HONEST_IMAGE_URL,
    MK_HONEST_LOGO_URL,
    MK_LEAKED_IMAGE_URL,
    MK_LEAKED_LOGO_URL,
    jewelryImageryBackfillPatch,
    isJewelryHonestFixtureUrl,
    isLeakedJewelryDemoImage,
    MK_JEWELLERY_PRODUCT_IMAGES,
} from "@/lib/metal/jewelry-imagery"
import { MK_JEWELLERS, SHRI_RADHE_JEWELLERS } from "@/lib/demo-shops/shop"
import { NITA_RECRUITERS, SHAKTI_PROPERTY, NEXT_LEVEL_EVENTS } from "@/lib/demo-shops/studio"
import { GOODWILL_PLUMBING } from "@/lib/demo-shops/field"
import { AURA_FITNESS } from "@/lib/demo-shops/book"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const root = process.cwd()

const LEAKED = ["/uploads/try-mira.jpg", "/uploads/try-brand.jpg", "/uploads/img-try-mira.jpg"] as const

function collectUrls(shop: {
    imageUrl?: string
    shopLogoUrl?: string
}): string[] {
    const out: string[] = []
    if (shop.imageUrl) out.push(shop.imageUrl)
    if (shop.shopLogoUrl) out.push(shop.shopLogoUrl)
    return out
}

describe("JEWELRY P1-3 - MK fixture URLs are jewellery-honest", () => {
    it("MK_JEWELLERS uses mk-jewellers desk + mark (no try-mira/try-brand)", () => {
        expect(MK_JEWELLERS.slug).toBe("mk-jewellers")
        expect(MK_JEWELLERS.flavor).toBe("JEWELRY_RETAIL")
        expect(MK_JEWELLERS.imageUrl).toBe(MK_HONEST_IMAGE_URL)
        expect(MK_JEWELLERS.shopLogoUrl).toBe(MK_HONEST_LOGO_URL)
        for (const url of collectUrls(MK_JEWELLERS)) {
            expect(url).not.toMatch(/try-mira|try-brand|img-try-mira|img-try-brand/i)
            expect(isLeakedJewelryDemoImage(url)).toBe(false)
            expect(isJewelryHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("shipped mk-jewellers About/header assets exist on disk", () => {
        expect(existsSync(join(root, "public/uploads/mk-jewellers/desk.jpg"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/mk-jewellers/mark.png"))).toBe(true)
    })

    it("leaves jewelry-p1-2 catalogue SKU thumbs untouched", () => {
        for (const product of MK_JEWELLERS.products || []) {
            expect(product.thumbnailUrl).toBe(MK_JEWELLERY_PRODUCT_IMAGES[product.sku as keyof typeof MK_JEWELLERY_PRODUCT_IMAGES])
            expect(product.thumbnailUrl).toMatch(/^\/uploads\/mk-jewellers\/.+\.jpg$/)
            expect(product.thumbnailUrl).not.toMatch(/desk\.jpg|mark\.png/)
        }
    })
})

describe("JEWELRY P1-3 - leakage detect + backfill helper", () => {
    it("flags try-mira / try-brand and known bad LIVE paths", () => {
        expect(JEWELRY_LEAKED_DEMO_IMAGE_MARKERS).toEqual(
            expect.arrayContaining(["try-mira", "try-brand", "img-try-mira", "img-try-brand"]),
        )
        for (const url of LEAKED) {
            expect(isLeakedJewelryDemoImage(url)).toBe(true)
        }
        expect(isLeakedJewelryDemoImage(MK_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedJewelryDemoImage(MK_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedJewelryDemoImage(MK_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedJewelryDemoImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedJewelryDemoImage(null)).toBe(false)
        expect(isLeakedJewelryDemoImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            jewelryImageryBackfillPatch({
                imageUrl: MK_LEAKED_IMAGE_URL,
                shopLogoUrl: MK_LEAKED_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: MK_HONEST_IMAGE_URL,
            shopLogoUrl: MK_HONEST_LOGO_URL,
        })

        expect(
            jewelryImageryBackfillPatch({
                imageUrl: MK_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
            }),
        ).toEqual({ imageUrl: MK_HONEST_IMAGE_URL })

        expect(
            jewelryImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            jewelryImageryBackfillPatch({
                imageUrl: MK_HONEST_IMAGE_URL,
                shopLogoUrl: MK_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        expect(jewelryImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("JEWELRY P1-3 - seed wiring + prior roles untouched", () => {
    it("force-refreshes mk-jewellers so honest heroes reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("mk-jewellers")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "mk-jewellers", products: [{}, {}], services: [] }, 10, 0, false),
        ).toBe(false)
    })

    it("Aura / Goodwill / Shakti / NLE / Nita keep their own assets (no MK bleed)", () => {
        expect(AURA_FITNESS.imageUrl).toMatch(/aura-fitness|floor/i)
        expect(AURA_FITNESS.imageUrl).not.toMatch(/mk-jewellers/i)
        expect(GOODWILL_PLUMBING.imageUrl).toBe("/uploads/goodwill-plumbing/van.jpg")
        expect(GOODWILL_PLUMBING.imageUrl).not.toMatch(/mk-jewellers/i)
        expect(SHAKTI_PROPERTY.imageUrl).toBe("/uploads/shakti-property/desk.jpg")
        expect(SHAKTI_PROPERTY.imageUrl).not.toMatch(/mk-jewellers/i)
        expect(NEXT_LEVEL_EVENTS.imageUrl).toBe("/uploads/events-studio/hall.jpg")
        expect(NEXT_LEVEL_EVENTS.imageUrl).not.toMatch(/mk-jewellers/i)
        expect(NITA_RECRUITERS.imageUrl).toBe("/uploads/nita-recruiters/desk.jpg")
        expect(NITA_RECRUITERS.imageUrl).not.toMatch(/mk-jewellers/i)
        // Wholesale jewellery fixture left alone (not pottery About bleed on primary).
        expect(SHRI_RADHE_JEWELLERS.slug).toBe("shri-radhe-jewellers")
        expect(collectUrls(SHRI_RADHE_JEWELLERS).join(" ")).not.toMatch(/mk-jewellers\/desk|mk-jewellers\/mark/)
    })
})
