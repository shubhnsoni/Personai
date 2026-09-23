import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import {
    HAVEN_HONEST_IMAGE_URL,
    HAVEN_HONEST_LOGO_URL,
    HAVEN_LEAKED_IMAGE_URL,
    HAVEN_LEAKED_LOGO_URL,
    hotelImageryBackfillPatch,
    isHotelHonestFixtureUrl,
    isLeakedHotelFixtureImage,
} from "@/lib/hotels/hotel-imagery"
import { TRY_HOTEL } from "@/lib/hotels/try-hotel-seed"
import { HAVEN_HOTEL, LALPUR_APARTMENTS, SAL_RESORT, STAY_SHOPS } from "@/lib/demo-shops/stay"

const root = process.cwd()

describe("HOTEL P1-5 — Haven fixture URLs are hotel-honest", () => {
    it("HAVEN_HOTEL / TRY_HOTEL use haven-hinoo lobby + logo (no skydine / try-arjun)", () => {
        expect(HAVEN_HOTEL.imageUrl).toBe(HAVEN_HONEST_IMAGE_URL)
        expect(HAVEN_HOTEL.shopLogoUrl).toBe(HAVEN_HONEST_LOGO_URL)
        expect(TRY_HOTEL.imageUrl).toBe(HAVEN_HONEST_IMAGE_URL)
        expect(TRY_HOTEL.shopLogoUrl).toBe(HAVEN_HONEST_LOGO_URL)
        expect(HAVEN_HOTEL.imageUrl).not.toMatch(/skydine|try-arjun/i)
        expect(HAVEN_HOTEL.shopLogoUrl).not.toMatch(/skydine|try-arjun/i)
        expect(isHotelHonestFixtureUrl(HAVEN_HOTEL.imageUrl)).toBe(true)
        expect(isHotelHonestFixtureUrl(HAVEN_HOTEL.shopLogoUrl)).toBe(true)
    })

    it("Lalpur / Sal stay kits no longer point at cafe/creator stock", () => {
        expect(LALPUR_APARTMENTS.imageUrl).toBe(HAVEN_HONEST_IMAGE_URL)
        expect(LALPUR_APARTMENTS.shopLogoUrl).toBe(HAVEN_HONEST_LOGO_URL)
        expect(SAL_RESORT.imageUrl).toBe(HAVEN_HONEST_IMAGE_URL)
        expect(SAL_RESORT.shopLogoUrl).toBe(HAVEN_HONEST_LOGO_URL)
        for (const shop of STAY_SHOPS) {
            expect(shop.imageUrl || "").not.toMatch(/skydine|try-arjun/i)
            expect(shop.shopLogoUrl || "").not.toMatch(/skydine|try-arjun/i)
        }
    })

    it("shipped haven-hinoo assets exist on disk", () => {
        const lobby = join(root, "public/uploads/haven-hinoo/lobby.jpg")
        const logo = join(root, "public/uploads/haven-hinoo/logo.png")
        expect(existsSync(lobby)).toBe(true)
        expect(existsSync(logo)).toBe(true)
    })
})

describe("HOTEL P1-5 — leakage detect + backfill helper", () => {
    it("flags skydine / try-arjun and known bad LIVE paths", () => {
        expect(isLeakedHotelFixtureImage(HAVEN_LEAKED_IMAGE_URL)).toBe(true)
        expect(isLeakedHotelFixtureImage(HAVEN_LEAKED_LOGO_URL)).toBe(true)
        expect(isLeakedHotelFixtureImage("/uploads/skydine-cafe/table.jpg")).toBe(true)
        expect(isLeakedHotelFixtureImage("/uploads/TRY-ARJUN.JPG")).toBe(true)
        expect(isLeakedHotelFixtureImage(HAVEN_HONEST_IMAGE_URL)).toBe(false)
        expect(isLeakedHotelFixtureImage("/uploads/owner-custom.jpg")).toBe(false)
        expect(isLeakedHotelFixtureImage(null)).toBe(false)
        expect(isLeakedHotelFixtureImage("")).toBe(false)
    })

    it("backfill replaces only leaked fields; preserves custom owner uploads", () => {
        expect(
            hotelImageryBackfillPatch({
                imageUrl: HAVEN_LEAKED_IMAGE_URL,
                shopLogoUrl: HAVEN_LEAKED_LOGO_URL,
            }),
        ).toEqual({
            imageUrl: HAVEN_HONEST_IMAGE_URL,
            shopLogoUrl: HAVEN_HONEST_LOGO_URL,
        })

        expect(
            hotelImageryBackfillPatch({
                imageUrl: HAVEN_LEAKED_IMAGE_URL,
                shopLogoUrl: "/uploads/owner-custom-logo.png",
            }),
        ).toEqual({ imageUrl: HAVEN_HONEST_IMAGE_URL })

        expect(
            hotelImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: HAVEN_LEAKED_LOGO_URL,
            }),
        ).toEqual({ shopLogoUrl: HAVEN_HONEST_LOGO_URL })

        expect(
            hotelImageryBackfillPatch({
                imageUrl: "/uploads/owner-hero.jpg",
                shopLogoUrl: "/uploads/owner-logo.png",
            }),
        ).toBeNull()

        expect(
            hotelImageryBackfillPatch({
                imageUrl: HAVEN_HONEST_IMAGE_URL,
                shopLogoUrl: HAVEN_HONEST_LOGO_URL,
            }),
        ).toBeNull()

        // empty is not leakage — create path sets URLs; do not invent overwrite
        expect(hotelImageryBackfillPatch({ imageUrl: null, shopLogoUrl: "" })).toBeNull()
    })
})

describe("HOTEL P1-5 — seed wiring + resolve honesty", () => {
    it("try-hotel seed creates with honest URLs and backfills leakage on ensure", () => {
        const seed = readFileSync(join(root, "src/lib/hotels/try-hotel-seed.ts"), "utf8")
        expect(seed).toMatch(/imageUrl:\s*TRY_HOTEL\.imageUrl/)
        expect(seed).toMatch(/shopLogoUrl:\s*TRY_HOTEL\.shopLogoUrl/)
        expect(seed).toMatch(/P1-5: replace known cafe\/creator leakage/)
        expect(seed).toMatch(/hotelImageryBackfillPatch/)
        expect(seed).toMatch(/HAVEN_HOTEL\.slug/)
        // preserve P1-4 WA
        expect(seed).toMatch(/P1-4: keep Profile\.whatsapp/)
        expect(seed).toMatch(/whatsapp:\s*TRY_HOTEL\.whatsapp/)
    })

    it("stay.ts photo map has no skydine / try-arjun asset paths", () => {
        const stay = readFileSync(join(root, "src/lib/demo-shops/stay.ts"), "utf8")
        expect(stay).not.toMatch(/\/uploads\/skydine/)
        expect(stay).not.toMatch(/\/uploads\/try-arjun/)
        expect(stay).toMatch(/\/uploads\/haven-hinoo\/lobby\.jpg/)
        expect(stay).toMatch(/\/uploads\/haven-hinoo\/logo\.png/)
    })

    it("hotels index re-exports imagery helpers", () => {
        const index = readFileSync(join(root, "src/lib/hotels/index.ts"), "utf8")
        expect(index).toMatch(/hotelImageryBackfillPatch/)
        expect(index).toMatch(/isLeakedHotelFixtureImage/)
        expect(index).toMatch(/from "\.\/hotel-imagery"/)
    })

    it("menu/book still resolve logo via profile fields + resolveHotelBrandLogo (no hardcoded skydine)", () => {
        const menu = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menu).toMatch(/resolveHotelBrandLogo/)
        expect(menu).not.toMatch(/skydine-cafe\/interior/)
        expect(menu).not.toMatch(/try-arjun\.jpg/)
        const book = readFileSync(join(root, "src/app/[slug]/book/page.tsx"), "utf8")
        expect(book).toMatch(/resolveHotelBrandLogo/)
        expect(book).not.toMatch(/skydine-cafe\/interior/)
        expect(book).not.toMatch(/try-arjun\.jpg/)
    })
})
