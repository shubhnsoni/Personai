// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    REALESTATE_LEAKED_IMAGE_MARKERS,
    SHAKTI_HONEST_IMAGE_URL,
    SHAKTI_HONEST_LOGO_URL,
    SHAKTI_LEAKED_IMAGE_URL,
    SHAKTI_LEAKED_LOGO_URL,
    realestateImageryBackfillPatch,
    isRealestateHonestFixtureUrl,
    isLeakedRealestateFixtureImage,
} from "@/lib/realestate/realestate-imagery"
import { SHAKTI_PROPERTY, TAGORE_HILL_PRESS, NEXT_LEVEL_EVENTS, LETS_CLICK, STUDIO_SHOPS } from "@/lib/demo-shops/studio"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const root = process.cwd()

const LEAKED = ["/uploads/try-atlas.jpg", "/uploads/try-brand.jpg"] as const

function collectUrls(shop: {
    imageUrl?: string
    shopLogoUrl?: string
    projects?: Array<{ imageUrl?: string }>
}): string[] {
    const out: string[] = []
    if (shop.imageUrl) out.push(shop.imageUrl)
    if (shop.shopLogoUrl) out.push(shop.shopLogoUrl)
    for (const project of shop.projects || []) {
        if (project.imageUrl) out.push(project.imageUrl)
    }
    return out
}

describe("REAL_ESTATE P1-4 - Shakti fixture URLs are brokerage-honest", () => {
    it("SHAKTI_PROPERTY uses shakti-property desk + mark (no try-atlas/try-brand)", () => {
        expect(SHAKTI_PROPERTY.slug).toBe("shakti-property-lalpur")
        expect(SHAKTI_PROPERTY.flavor).toBe("REAL_ESTATE_BROKERAGE")
        expect(SHAKTI_PROPERTY.imageUrl).toBe(SHAKTI_HONEST_IMAGE_URL)
        expect(SHAKTI_PROPERTY.shopLogoUrl).toBe(SHAKTI_HONEST_LOGO_URL)
        for (const url of collectUrls(SHAKTI_PROPERTY)) {
            expect(url).not.toMatch(/try-atlas|try-brand/i)
            expect(isLeakedRealestateFixtureImage(url)).toBe(false)
            expect(isRealestateHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("shipped shakti-property assets exist on disk", () => {
        expect(existsSync(join(root, "public/uploads/shakti-property/desk.jpg"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/shakti-property/mark.png"))).toBe(true)
    })
})

describe("REAL_ESTATE P1-4 - leakage detect + backfill helper", () => {
    it("flags try-atlas / try-brand and known bad LIVE paths", () => {
        expect(REALESTATE_LEAKED_IMAGE_MARKERS).toEqual(
            expect.arrayContaining(["try-atlas", "try-brand"]),
        )
        for (const url of LEAKED) {
            expect(isLeakedRealestateFixtureImage(url)).toBe(true)
        }
        expect(isLeakedRealestateFixtureImage(SHAKTI_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedRealestateFixtureImage(SHAKTI_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedRealestateFixtureImage(SHAKTI_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedRealestateFixtureImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedRealestateFixtureImage(null)).toBe(false)
        expect(isLeakedRealestateFixtureImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            realestateImageryBackfillPatch({
                imageUrl: SHAKTI_LEAKED_IMAGE_URL,
                shopLogoUrl: SHAKTI_LEAKED_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: SHAKTI_HONEST_IMAGE_URL,
            shopLogoUrl: SHAKTI_HONEST_LOGO_URL,
        })

        expect(
            realestateImageryBackfillPatch({
                imageUrl: SHAKTI_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
            }),
        ).toEqual({ imageUrl: SHAKTI_HONEST_IMAGE_URL })

        expect(
            realestateImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            realestateImageryBackfillPatch({
                imageUrl: SHAKTI_HONEST_IMAGE_URL,
                shopLogoUrl: SHAKTI_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        expect(realestateImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("REAL_ESTATE P1-4 - seed wiring + other kits untouched", () => {
    it("force-refreshes Shakti so honest heroes reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("shakti-property-lalpur")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "shakti-property-lalpur", products: [], services: [{}, {}] }, 0, 2, false),
        ).toBe(false)
    })

    it("creator Tagore / events NLE / LC keep their own assets (no Shakti bleed)", () => {
        expect(TAGORE_HILL_PRESS.imageUrl).not.toMatch(/shakti-property/i)
        expect(TAGORE_HILL_PRESS.shopLogoUrl).not.toMatch(/shakti-property/i)
        expect(NEXT_LEVEL_EVENTS.imageUrl).toBe("/uploads/events-studio/hall.jpg")
        expect(LETS_CLICK.imageUrl).toBe("/uploads/lets-click/shoot.jpg")
        const others = STUDIO_SHOPS.filter((shop) => shop.slug !== "shakti-property-lalpur")
        expect(others.length).toBeGreaterThan(0)
        // Other kits may still use shared try-atlas/try-brand where role-fit.
        const anyShared = others.some((shop) =>
            collectUrls(shop).some((url) => /try-(atlas|brand)/i.test(url)),
        )
        expect(anyShared).toBe(true)
    })
})