// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    guestPrintFooterHint,
    guestPrintKicker,
    guestPrintScanCopy,
    hotelGuestPrintEmptyRoomsCopy,
    HOTEL_DEFERRED_KIT_TEASER,
} from "@/lib/guest-print-copy"
import { isHotelRole } from "@/lib/hotels"

const root = process.cwd()
const DEFERRED = HOTEL_DEFERRED_KIT_TEASER

describe("HOTEL P1-2 guest /print — no deferred-kit Dashboard teaser", () => {
    it("isHotelRole covers HOTEL + stay aliases", () => {
        expect(isHotelRole("HOTEL")).toBe(true)
        expect(isHotelRole("RESORT")).toBe(true)
        expect(isHotelRole("SERVICED_APARTMENT")).toBe(true)
        expect(isHotelRole("SHOP")).toBe(false)
        expect(isHotelRole("RESTAURANT")).toBe(false)
    })

    it("hotel footer hint is null — never the deferred-kit string", () => {
        for (const role of ["HOTEL", "RESORT", "HOSTEL", "HOMESTAY", "SERVICED_APARTMENT"]) {
            const hint = guestPrintFooterHint(role)
            expect(hint, role).toBeNull()
            expect(String(hint)).not.toContain("when this page is a hotel kit")
            expect(String(hint)).not.toContain(DEFERRED)
        }
    })

    it("hotel kicker / scan copy are stay-honest without Dashboard deferral", () => {
        expect(guestPrintKicker("HOTEL")).toBe("Stay QR")
        expect(guestPrintScanCopy("HOTEL")).toMatch(/concierge/i)
        expect(guestPrintScanCopy("HOTEL").toLowerCase()).not.toContain("dashboard")
        expect(hotelGuestPrintEmptyRoomsCopy()).toMatch(/room tents|property QR/i)
        expect(hotelGuestPrintEmptyRoomsCopy().toLowerCase()).not.toContain("dashboard")
        expect(hotelGuestPrintEmptyRoomsCopy().toLowerCase()).not.toContain("when this page is a hotel kit")
    })

    it("print page wires hotel room tents and never embeds deferred teaser", () => {
        const src = readFileSync(join(root, "src/app/[slug]/print/page.tsx"), "utf8")
        expect(src).toMatch(/isHotelRole/)
        expect(src).toMatch(/hotelQr/)
        expect(src).toMatch(/hotelQrPath/)
        expect(src).toMatch(/Room tents/)
        expect(src).toMatch(/data-hotel-guest-print/)
        expect(src).toMatch(/guestPrintFooterHint/)
        expect(src).not.toContain(DEFERRED)
        expect(src).not.toMatch(/when this page is a hotel kit/)
        // Food + shop paths preserved
        expect(src).toMatch(/isRestaurant/)
        expect(src).toMatch(/Table QRs/)
        expect(src).toMatch(/guestPrintFooterHint\(profile\.roleTemplate\)/)
    })

    it("helper module documents that hotels suppress the teaser", () => {
        const src = readFileSync(join(root, "src/lib/guest-print-copy.ts"), "utf8")
        expect(src).toContain("HOTEL_DEFERRED_KIT_TEASER")
        expect(src).toMatch(/if \(isHotelRole\(role\)\) return null/)
        expect(src).toContain(DEFERRED)
    })
})
