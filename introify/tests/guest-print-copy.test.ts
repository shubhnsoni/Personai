// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    guestPrintFooterHint,
    guestPrintKicker,
    guestPrintScanCopy,
    HOTEL_DEFERRED_KIT_TEASER,
} from "@/lib/guest-print-copy"

describe("guestPrintFooterHint (SHOP P1-3 + HOTEL P1-2)", () => {
    it("suppresses deferred Dashboard teaser for hotel kits and aliases (P1-2)", () => {
        for (const role of ["HOTEL", "RESORT", "HOSTEL", "HOMESTAY", "SERVICED_APARTMENT"]) {
            const hint = guestPrintFooterHint(role)
            expect(hint, role).toBeNull()
        }
    })

    it("does not mention hotel for shop / kirana / jewellery kits", () => {
        for (const role of [
            "SHOP",
            "KIRANA",
            "BOUTIQUE",
            "OPTICS",
            "FLORIST",
            "PRINT_SHOP",
            "JEWELRY_RETAIL",
            "JEWELRY_WHOLESALE",
            "PHARMACY",
            "AUTO_PARTS",
            "DISTRIBUTOR",
        ]) {
            const hint = guestPrintFooterHint(role)
            expect(hint, role).toBeTruthy()
            expect(hint!.toLowerCase(), role).not.toContain("hotel")
            expect(hint, role).toMatch(/QR & Print|counter|till|shop/i)
        }
    })

    it("returns null for food kits (menu/table chrome owns the sheet)", () => {
        for (const role of ["RESTAURANT", "CAFE", "BAKERY", "SWEETS", "DHABA", "CLOUD_KITCHEN"]) {
            expect(guestPrintFooterHint(role)).toBeNull()
        }
    })

    it("uses neutral non-hotel copy for other non-food kits", () => {
        const hint = guestPrintFooterHint("CREATOR")
        expect(hint).toBeTruthy()
        expect(hint!.toLowerCase()).not.toContain("hotel")
        expect(hint).toMatch(/QR & Print/)
    })
})

describe("guest print kickers (HOTEL P1-2)", () => {
    it("labels Stay QR for hotel kits and Page QR for shops", () => {
        expect(guestPrintKicker("HOTEL")).toBe("Stay QR")
        expect(guestPrintKicker("RESORT")).toBe("Stay QR")
        expect(guestPrintKicker("SERVICED_APARTMENT")).toBe("Stay QR")
        expect(guestPrintKicker("SHOP")).toBe("Page QR")
        expect(guestPrintKicker("RESTAURANT")).toBe("Menu QR")
        expect(guestPrintScanCopy("HOTEL")).toMatch(/concierge/i)
        expect(guestPrintScanCopy("HOTEL")).not.toMatch(/when this page is a hotel kit/i)
        expect(HOTEL_DEFERRED_KIT_TEASER).toMatch(/when this page is a hotel kit/)
    })
})

describe("guest print page wiring (SHOP P1-3 + HOTEL P1-2 regression)", () => {
    it("print page uses guestPrintFooterHint and no longer hardcodes hotel deferred teaser", () => {
        const src = readFileSync(
            join(process.cwd(), "src/app/[slug]/print/page.tsx"),
            "utf8",
        )
        expect(src).toMatch(/guestPrintFooterHint/)
        expect(src).toMatch(/isHotelRole/)
        expect(src).toMatch(/Room tents|hotelQr|data-hotel-room-tents/)
        expect(src).not.toContain(HOTEL_DEFERRED_KIT_TEASER)
        expect(src).not.toMatch(/Prefer the downloadable hotel print package\? Use Dashboard → QR &amp; Print when this page is a hotel kit\./)
        expect(src).not.toMatch(/\{!food \? \(/)
    })
})
