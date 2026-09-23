import { describe, expect, it } from "vitest"
import { formatMoney, formatStoredPrice } from "@/lib/pricing"
import { catalogDisplayCurrency } from "@/lib/menu"

const INR = "\u20b9"

/**
 * salon-p0-1: book INR priceCents must not take the USD->INR FX branch.
 * Fixtures store paise (priceRupees*100) with currency=INR.
 * Regression: money(30000) under INR geo treated cents as USD -> INR26,100.
 */
describe("salon-p0-1 book INR priceCents", () => {
    it("formats Prince cut 30000 paise as INR 300 with no FX when stored+display INR", () => {
        expect(formatStoredPrice(30_000, "INR", "INR")).toBe(`${INR}300`)
        expect(formatStoredPrice(30_000, "INR", "INR")).not.toMatch(/26,?100/)
        expect(formatStoredPrice(30_000, "INR", "INR")).not.toMatch(/\$/)
    })

    it("formats H Square spa / cut badges: 45000->INR450, 99900->INR999", () => {
        expect(formatStoredPrice(45_000, "INR", "INR")).toBe(`${INR}450`)
        expect(formatStoredPrice(99_900, "INR", "INR")).toBe(`${INR}999`)
        expect(formatStoredPrice(45_000, "INR", "INR")).not.toMatch(/39,?150/)
    })

    it("keeps Free for zero / free services", () => {
        expect(formatStoredPrice(0, "INR", "INR")).toBe("Free")
        expect(formatStoredPrice(0, "USD", "USD")).toBe("Free")
        expect(formatMoney(0, "INR")).toBe("Free")
    })

    it("does not regress USD creator/hotel-style stored USD under USD display", () => {
        expect(formatStoredPrice(2900, "USD", "USD")).toBe("$29")
        expect(formatStoredPrice(1900, "USD", "USD")).toBe("$19")
        expect(formatMoney(2900, "USD")).toBe("$29")
    })

    it("omitting stored currency under INR display still FX (bug path without stored)", () => {
        expect(formatStoredPrice(30_000, undefined, "INR")).toBe(`${INR}26,100`)
    })

    it("SALON_SPA / BARBER kits preserve INR catalog currency under USD geo request", () => {
        expect(catalogDisplayCurrency("SALON_SPA", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("BARBER", "INR", "USD")).toBe("INR")
        expect(
            formatStoredPrice(30_000, "INR", catalogDisplayCurrency("SALON_SPA", "INR", "USD")),
        ).toBe(`${INR}300`)
    })
})
