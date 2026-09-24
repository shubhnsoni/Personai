// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    FIELD_LEAKED_IMAGE_MARKERS,
    GOODWILL_HONEST_IMAGE_URL,
    GOODWILL_HONEST_LOGO_URL,
    JHARKHAND_HONEST_IMAGE_URL,
    JHARKHAND_HONEST_LOGO_URL,
    VICKY_HONEST_IMAGE_URL,
    VICKY_HONEST_LOGO_URL,
    COOLING_HONEST_IMAGE_URL,
    COOLING_HONEST_LOGO_URL,
    COOLING_HONEST_SPARE_URL,
    BHOLA_HONEST_IMAGE_URL,
    BHOLA_HONEST_LOGO_URL,
    BHOLA_HONEST_SPARE_URL,
    GOODWILL_LEAKED_IMAGE_URL,
    GOODWILL_LEAKED_LOGO_URL,
    BHOLA_LEAKED_LOGO_URL,
    VICKY_LEAKED_IMAGE_URL,
    JHARKHAND_LEAKED_IMAGE_URL,
    FIELD_LEAKED_PACKAGING_URL,
    fieldImageryBackfillPatch,
    isFieldHonestFixtureUrl,
    isLeakedFieldFixtureImage,
} from "@/lib/fieldjobs/field-imagery"
import {
    GOODWILL_PLUMBING,
    JHARKHAND_FIELD_CREW,
    VICKY_ELECTRICAL,
    COOLING_WORLD,
    BHOLA_GARAGE,
    FIELD_SHOPS,
} from "@/lib/demo-shops/field"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"
import { SHAKTI_PROPERTY, NEXT_LEVEL_EVENTS } from "@/lib/demo-shops/studio"

const root = process.cwd()

const LEAK_RE =
    /try-storefront|try-arjun|try-atlas|try-packaging|try-lamp|try-workshop|try-kabir|try-samir|try-rohan|skydine-cafe|blu-cafe/i

function collectUrls(shop: {
    imageUrl?: string
    shopLogoUrl?: string
    story?: Array<{ url?: string }>
    products?: Array<{ thumbnailUrl?: string }>
}): string[] {
    const out: string[] = []
    if (shop.imageUrl) out.push(shop.imageUrl)
    if (shop.shopLogoUrl) out.push(shop.shopLogoUrl)
    for (const frame of shop.story || []) {
        if (frame.url) out.push(frame.url)
    }
    for (const product of shop.products || []) {
        if (product.thumbnailUrl) out.push(product.thumbnailUrl)
    }
    return out
}

describe("FIELD P1-3 - Goodwill / siblings fixture URLs are field-honest", () => {
    it("GOODWILL_PLUMBING uses goodwill-plumbing van + mark (no storefront/arjun)", () => {
        expect(GOODWILL_PLUMBING.slug).toBe("goodwill-plumbing")
        expect(GOODWILL_PLUMBING.flavor).toBe("PLUMBER")
        expect(GOODWILL_PLUMBING.imageUrl).toBe(GOODWILL_HONEST_IMAGE_URL)
        expect(GOODWILL_PLUMBING.shopLogoUrl).toBe(GOODWILL_HONEST_LOGO_URL)
        for (const url of collectUrls(GOODWILL_PLUMBING)) {
            expect(url).not.toMatch(LEAK_RE)
            expect(isLeakedFieldFixtureImage(url)).toBe(false)
            expect(isFieldHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("JH / Vicky / Cooling / Bhola use role-fit assets (no creator/cafe bleed)", () => {
        expect(JHARKHAND_FIELD_CREW.imageUrl).toBe(JHARKHAND_HONEST_IMAGE_URL)
        expect(JHARKHAND_FIELD_CREW.shopLogoUrl).toBe(JHARKHAND_HONEST_LOGO_URL)
        expect(VICKY_ELECTRICAL.imageUrl).toBe(VICKY_HONEST_IMAGE_URL)
        expect(VICKY_ELECTRICAL.shopLogoUrl).toBe(VICKY_HONEST_LOGO_URL)
        expect(COOLING_WORLD.imageUrl).toBe(COOLING_HONEST_IMAGE_URL)
        expect(COOLING_WORLD.shopLogoUrl).toBe(COOLING_HONEST_LOGO_URL)
        expect(BHOLA_GARAGE.imageUrl).toBe(BHOLA_HONEST_IMAGE_URL)
        expect(BHOLA_GARAGE.shopLogoUrl).toBe(BHOLA_HONEST_LOGO_URL)

        for (const shop of FIELD_SHOPS) {
            for (const url of collectUrls(shop)) {
                expect(url).not.toMatch(LEAK_RE)
                expect(isLeakedFieldFixtureImage(url)).toBe(false)
                expect(isFieldHonestFixtureUrl(url)).toBe(true)
            }
        }

        for (const product of COOLING_WORLD.products || []) {
            expect(product.thumbnailUrl).toBe(COOLING_HONEST_SPARE_URL)
        }
        for (const product of BHOLA_GARAGE.products || []) {
            expect(product.thumbnailUrl).toBe(BHOLA_HONEST_SPARE_URL)
        }
    })

    it("shipped field assets exist on disk", () => {
        const paths = [
            "public/uploads/goodwill-plumbing/van.jpg",
            "public/uploads/goodwill-plumbing/mark.png",
            "public/uploads/jharkhand-field/van.jpg",
            "public/uploads/jharkhand-field/mark.png",
            "public/uploads/vicky-electrical/board.jpg",
            "public/uploads/vicky-electrical/mark.png",
            "public/uploads/cooling-world/outdoor.jpg",
            "public/uploads/cooling-world/mark.png",
            "public/uploads/cooling-world/spare.jpg",
            "public/uploads/bhola-garage/bay.jpg",
            "public/uploads/bhola-garage/mark.png",
            "public/uploads/bhola-garage/spare.jpg",
        ]
        for (const rel of paths) {
            expect(existsSync(join(root, rel))).toBe(true)
        }
    })
})

describe("FIELD P1-3 - leakage detect + backfill helper", () => {
    it("flags storefront/arjun/atlas/lamp/workshop/packaging and cafe bleed", () => {
        expect(FIELD_LEAKED_IMAGE_MARKERS).toEqual(
            expect.arrayContaining([
                "try-storefront",
                "try-arjun",
                "try-atlas",
                "try-packaging",
                "try-lamp",
                "try-workshop",
            ]),
        )
        for (const url of [
            GOODWILL_LEAKED_IMAGE_URL,
            GOODWILL_LEAKED_LOGO_URL,
            BHOLA_LEAKED_LOGO_URL,
            VICKY_LEAKED_IMAGE_URL,
            JHARKHAND_LEAKED_IMAGE_URL,
            FIELD_LEAKED_PACKAGING_URL,
            "/uploads/skydine-cafe/counter.jpg",
            "/uploads/blu-cafe/cafe.jpg",
        ]) {
            expect(isLeakedFieldFixtureImage(url)).toBe(true)
        }
        expect(isLeakedFieldFixtureImage(GOODWILL_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedFieldFixtureImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedFieldFixtureImage(null)).toBe(false)
        expect(isLeakedFieldFixtureImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            fieldImageryBackfillPatch({
                imageUrl: GOODWILL_LEAKED_IMAGE_URL,
                shopLogoUrl: GOODWILL_LEAKED_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: GOODWILL_HONEST_IMAGE_URL,
            shopLogoUrl: GOODWILL_HONEST_LOGO_URL,
        })

        expect(
            fieldImageryBackfillPatch({
                imageUrl: GOODWILL_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
                honestImageUrl: BHOLA_HONEST_IMAGE_URL,
                honestLogoUrl: BHOLA_HONEST_LOGO_URL,
            }),
        ).toEqual({ imageUrl: BHOLA_HONEST_IMAGE_URL })

        expect(
            fieldImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            fieldImageryBackfillPatch({
                imageUrl: GOODWILL_HONEST_IMAGE_URL,
                shopLogoUrl: GOODWILL_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        expect(fieldImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("FIELD P1-3 - seed wiring + other kits untouched", () => {
    it("force-refreshes all five field fixtures so honest heroes reseed", () => {
        for (const slug of [
            "goodwill-plumbing",
            "jharkhand-plumbing-electrical",
            "vicky-electrical",
            "cooling-world-ranchi",
            "bhola-service-centre",
        ]) {
            expect(FORCE_REFRESH_SLUGS.has(slug)).toBe(true)
            expect(shouldSkipPopulated({ slug, products: [], services: [{}, {}] }, 0, 2, false)).toBe(false)
        }
    })

    it("Shakti / NLE keep their own assets (no field bleed; shared try-* may remain elsewhere)", () => {
        expect(SHAKTI_PROPERTY.imageUrl).toBe("/uploads/shakti-property/desk.jpg")
        expect(SHAKTI_PROPERTY.imageUrl).not.toMatch(/goodwill-plumbing|bhola-garage|cooling-world/i)
        expect(NEXT_LEVEL_EVENTS.imageUrl).toBe("/uploads/events-studio/hall.jpg")
        expect(NEXT_LEVEL_EVENTS.imageUrl).not.toMatch(/goodwill-plumbing|jharkhand-field/i)
    })
})
