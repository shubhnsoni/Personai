// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    RECRUIT_LEAKED_IMAGE_MARKERS,
    NITA_HONEST_IMAGE_URL,
    NITA_HONEST_LOGO_URL,
    NITA_LEAKED_IMAGE_URL,
    NITA_LEAKED_LOGO_URL,
    recruitImageryBackfillPatch,
    isRecruitHonestFixtureUrl,
    isLeakedRecruitFixtureImage,
} from "@/lib/recruitment/recruit-imagery"
import { NITA_RECRUITERS, SHAKTI_PROPERTY, NEXT_LEVEL_EVENTS, STUDIO_SHOPS } from "@/lib/demo-shops/studio"
import { GOODWILL_PLUMBING } from "@/lib/demo-shops/field"
import { AURA_FITNESS } from "@/lib/demo-shops/book"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

const root = process.cwd()

const LEAKED = ["/uploads/try-samir.jpg", "/uploads/try-brand.jpg", "/uploads/img-try-samir.jpg"] as const

function collectUrls(shop: {
    imageUrl?: string
    shopLogoUrl?: string
}): string[] {
    const out: string[] = []
    if (shop.imageUrl) out.push(shop.imageUrl)
    if (shop.shopLogoUrl) out.push(shop.shopLogoUrl)
    return out
}

describe("RECRUIT P1-3 - Nita fixture URLs are recruiter-honest", () => {
    it("NITA_RECRUITERS uses nita-recruiters desk + mark (no try-samir/try-brand)", () => {
        expect(NITA_RECRUITERS.slug).toBe("nita-recruiters-ashok-nagar")
        expect(NITA_RECRUITERS.flavor).toBe("RECRUITMENT_AGENCY")
        expect(NITA_RECRUITERS.imageUrl).toBe(NITA_HONEST_IMAGE_URL)
        expect(NITA_RECRUITERS.shopLogoUrl).toBe(NITA_HONEST_LOGO_URL)
        for (const url of collectUrls(NITA_RECRUITERS)) {
            expect(url).not.toMatch(/try-samir|try-brand|img-try-samir|img-try-brand/i)
            expect(isLeakedRecruitFixtureImage(url)).toBe(false)
            expect(isRecruitHonestFixtureUrl(url)).toBe(true)
        }
    })

    it("shipped nita-recruiters assets exist on disk", () => {
        expect(existsSync(join(root, "public/uploads/nita-recruiters/desk.jpg"))).toBe(true)
        expect(existsSync(join(root, "public/uploads/nita-recruiters/mark.png"))).toBe(true)
    })
})

describe("RECRUIT P1-3 - leakage detect + backfill helper", () => {
    it("flags try-samir / try-brand and known bad LIVE paths", () => {
        expect(RECRUIT_LEAKED_IMAGE_MARKERS).toEqual(
            expect.arrayContaining(["try-samir", "try-brand", "img-try-samir", "img-try-brand"]),
        )
        for (const url of LEAKED) {
            expect(isLeakedRecruitFixtureImage(url)).toBe(true)
        }
        expect(isLeakedRecruitFixtureImage(NITA_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedRecruitFixtureImage(NITA_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedRecruitFixtureImage(NITA_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedRecruitFixtureImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedRecruitFixtureImage(null)).toBe(false)
        expect(isLeakedRecruitFixtureImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            recruitImageryBackfillPatch({
                imageUrl: NITA_LEAKED_IMAGE_URL,
                shopLogoUrl: NITA_LEAKED_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: NITA_HONEST_IMAGE_URL,
            shopLogoUrl: NITA_HONEST_LOGO_URL,
        })

        expect(
            recruitImageryBackfillPatch({
                imageUrl: NITA_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
            }),
        ).toEqual({ imageUrl: NITA_HONEST_IMAGE_URL })

        expect(
            recruitImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            recruitImageryBackfillPatch({
                imageUrl: NITA_HONEST_IMAGE_URL,
                shopLogoUrl: NITA_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        expect(recruitImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("RECRUIT P1-3 - seed wiring + prior roles untouched", () => {
    it("force-refreshes Nita so honest heroes reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("nita-recruiters-ashok-nagar")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "nita-recruiters-ashok-nagar", products: [], services: [{}, {}] }, 0, 2, false),
        ).toBe(false)
    })

    it("Aura / Goodwill / Shakti / NLE keep their own assets (no Nita bleed)", () => {
        expect(AURA_FITNESS.imageUrl).toMatch(/aura-fitness|floor/i)
        expect(AURA_FITNESS.imageUrl).not.toMatch(/nita-recruiters|try-samir|try-brand/i)
        expect(GOODWILL_PLUMBING.imageUrl).toBe("/uploads/goodwill-plumbing/van.jpg")
        expect(GOODWILL_PLUMBING.imageUrl).not.toMatch(/nita-recruiters/i)
        expect(SHAKTI_PROPERTY.imageUrl).toBe("/uploads/shakti-property/desk.jpg")
        expect(SHAKTI_PROPERTY.imageUrl).not.toMatch(/nita-recruiters/i)
        expect(NEXT_LEVEL_EVENTS.imageUrl).toBe("/uploads/events-studio/hall.jpg")
        expect(NEXT_LEVEL_EVENTS.imageUrl).not.toMatch(/nita-recruiters/i)
        const others = STUDIO_SHOPS.filter((shop) => shop.slug !== "nita-recruiters-ashok-nagar")
        expect(others.length).toBeGreaterThan(0)
        // Other kits may still use shared try-samir/try-brand where role-fit.
        const anyShared = others.some((shop) =>
            collectUrls(shop).some((url) => /try-(samir|brand)/i.test(url)),
        )
        expect(anyShared).toBe(true)
    })
})
