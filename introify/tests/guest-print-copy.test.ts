// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { guestPrintFooterHint } from "@/lib/guest-print-copy"

describe("guestPrintFooterHint (SHOP P1-3)", () => {
    it("keeps hotel package language for hotel kits and aliases", () => {
        for (const role of ["HOTEL", "RESORT", "HOSTEL", "HOMESTAY", "SERVICED_APARTMENT"]) {
            const hint = guestPrintFooterHint(role)
            expect(hint).toMatch(/hotel print package/i)
            expect(hint).toMatch(/QR & Print/)
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

describe("guest print page wiring (SHOP P1-3 regression)", () => {
    it("print page uses guestPrintFooterHint and no longer hardcodes hotel copy", () => {
        const src = readFileSync(
            join(process.cwd(), "src/app/[slug]/print/page.tsx"),
            "utf8",
        )
        expect(src).toMatch(/guestPrintFooterHint/)
        expect(src).not.toMatch(/Prefer the downloadable hotel print package\? Use Dashboard → QR &amp; Print when this page is a hotel kit\./)
        // Hotel string may still appear only via the helper call path, not inline for !food
        expect(src).not.toMatch(/\{!food \? \(/)
    })
})
