// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    EVENTS_LEAKED_IMAGE_MARKERS,
    NLE_HONEST_IMAGE_URL,
    NLE_HONEST_LOGO_URL,
    LC_HONEST_IMAGE_URL,
    LC_HONEST_LOGO_URL,
    NLE_LEAKED_IMAGE_URL,
    NLE_LEAKED_LOGO_URL,
    LC_LEAKED_IMAGE_URL,
    LC_LEAKED_LOGO_URL,
    eventsImageryBackfillPatch,
    isEventsHonestFixtureUrl,
    isLeakedEventsFixtureImage,
} from "@/lib/events/events-imagery"
import { NEXT_LEVEL_EVENTS, LETS_CLICK, STUDIO_SHOPS } from "@/lib/demo-shops/studio"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const root = process.cwd()

const LEAKED = [
    "/uploads/try-leela.jpg",
    "/uploads/try-film.jpg",
    "/uploads/try-anika.jpg",
    "/uploads/try-workshop.jpg",
] as const

function collectUrls(shop: {
    imageUrl?: string
    shopLogoUrl?: string
    events?: Array<{ thumbnailUrl?: string }>
    projects?: Array<{ imageUrl?: string }>
}): string[] {
    const out: string[] = []
    if (shop.imageUrl) out.push(shop.imageUrl)
    if (shop.shopLogoUrl) out.push(shop.shopLogoUrl)
    for (const event of shop.events || []) {
        if (event.thumbnailUrl) out.push(event.thumbnailUrl)
    }
    for (const project of shop.projects || []) {
        if (project.imageUrl) out.push(project.imageUrl)
    }
    return out
}

describe("EVENTS P1-4 — NLE / LC fixture URLs are events/photo-honest", () => {
    it("NEXT_LEVEL_EVENTS uses events-studio hall + mark (no leela/workshop/film)", () => {
        expect(NEXT_LEVEL_EVENTS.slug).toBe("next-level-events-kanke")
        expect(NEXT_LEVEL_EVENTS.flavor).toBe("EVENTS_STUDIO")
        expect(NEXT_LEVEL_EVENTS.imageUrl).toBe(NLE_HONEST_IMAGE_URL)
        expect(NEXT_LEVEL_EVENTS.shopLogoUrl).toBe(NLE_HONEST_LOGO_URL)
        for (const url of collectUrls(NEXT_LEVEL_EVENTS)) {
            expect(url).not.toMatch(/try-leela|try-workshop|try-film|try-anika/i)
            expect(isLeakedEventsFixtureImage(url)).toBe(false)
            expect(isEventsHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("LETS_CLICK uses lets-click shoot + mark (no film/anika)", () => {
        expect(LETS_CLICK.slug).toBe("lets-click-ratu-road")
        expect(LETS_CLICK.flavor).toBe("PHOTOGRAPHER")
        expect(LETS_CLICK.imageUrl).toBe(LC_HONEST_IMAGE_URL)
        expect(LETS_CLICK.shopLogoUrl).toBe(LC_HONEST_LOGO_URL)
        for (const url of collectUrls(LETS_CLICK)) {
            expect(url).not.toMatch(/try-leela|try-workshop|try-film|try-anika/i)
            expect(isLeakedEventsFixtureImage(url)).toBe(false)
            expect(isEventsHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("shipped events-studio / lets-click assets exist on disk", () => {
        expect(existsSync(join(root, "public/uploads/events-studio/hall.jpg"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/events-studio/mark.png"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/lets-click/shoot.jpg"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/lets-click/mark.png"))).toBe(true)
    })
})

describe("EVENTS P1-4 — leakage detect + backfill helper", () => {
    it("flags try-leela / try-film / try-anika / try-workshop and known bad LIVE paths", () => {
        expect(EVENTS_LEAKED_IMAGE_MARKERS).toEqual(
            expect.arrayContaining(["try-leela", "try-film", "try-anika", "try-workshop"]),
        )
        for (const url of LEAKED) {
            expect(isLeakedEventsFixtureImage(url)).toBe(true)
        }
        expect(isLeakedEventsFixtureImage(NLE_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedEventsFixtureImage(NLE_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedEventsFixtureImage(LC_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedEventsFixtureImage(LC_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedEventsFixtureImage(NLE_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedEventsFixtureImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedEventsFixtureImage(null)).toBe(false)
        expect(isLeakedEventsFixtureImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            eventsImageryBackfillPatch({
                imageUrl: NLE_LEAKED_IMAGE_URL,
                shopLogoUrl: NLE_LEAKED_LOGO_URL,
                honestImageUrl: NLE_HONEST_IMAGE_URL,
                honestLogoUrl: NLE_HONEST_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: NLE_HONEST_IMAGE_URL,
            shopLogoUrl: NLE_HONEST_LOGO_URL,
        })

        expect(
            eventsImageryBackfillPatch({
                imageUrl: LC_LEAKED_IMAGE_URL,
                shopLogoUrl: LC_LEAKED_LOGO_URL,
                honestImageUrl: LC_HONEST_IMAGE_URL,
                honestLogoUrl: LC_HONEST_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: LC_HONEST_IMAGE_URL,
            shopLogoUrl: LC_HONEST_LOGO_URL,
        })

        expect(
            eventsImageryBackfillPatch({
                imageUrl: NLE_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
                honestImageUrl: NLE_HONEST_IMAGE_URL,
                honestLogoUrl: NLE_HONEST_LOGO_URL,
            }),
        ).toEqual({ imageUrl: NLE_HONEST_IMAGE_URL })

        expect(
            eventsImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            eventsImageryBackfillPatch({
                imageUrl: NLE_HONEST_IMAGE_URL,
                shopLogoUrl: NLE_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        expect(eventsImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("EVENTS P1-4 — seed wiring + other studio kits untouched", () => {
    it("force-refreshes NLE + LC so honest heroes reseed on bootstrap", () => {
        for (const slug of ["next-level-events-kanke", "lets-click-ratu-road"] as const) {
            expect(FORCE_REFRESH_SLUGS.has(slug)).toBe(true)
            expect(
                shouldSkipPopulated({ slug, products: [], services: [{}, {}] }, 0, 2, false),
            ).toBe(false)
        }
    })

    it("other STUDIO_SHOPS may still use shared try-* assets (do not blanket-ban)", () => {
        const others = STUDIO_SHOPS.filter(
            (shop) => shop.slug !== "next-level-events-kanke" && shop.slug !== "lets-click-ratu-road",
        )
        expect(others.length).toBeGreaterThan(0)
        // Regression: Argora / Swaroop / Tagore may legitimately keep film/workshop/presets.
        const anyShared = others.some((shop) =>
            collectUrls(shop).some((url) => /try-(film|workshop|presets|packaging)/i.test(url)),
        )
        expect(anyShared).toBe(true)
    })
})
