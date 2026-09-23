import { describe, expect, it } from "vitest"
import { formatMoney, formatStoredPrice } from "@/lib/pricing"

const INR = "\u20b9"

/**
 * photo-p0-1: photographer home Events chip must not take the USD->INR FX branch.
 * Let's Click seed stores priceRupees*100 paise with currency=INR (e.g. 1200000 = ₹12,000).
 * Regression: money(1200000) under INR geo treated cents as USD -> ₹10,44,000 ($12,000 × ~87).
 * /book Wedding ₹28,000 / Patratu ₹25,000 already pass currency — keep honest.
 */
describe("photo-p0-1 photographer Events chip INR no USD-FX", () => {
    it("formats LC Patratu event 1200000 paise as INR 12,000 with no FX when stored+display INR", () => {
        expect(formatStoredPrice(1_200_000, "INR", "INR")).toBe(`${INR}12,000`)
        expect(formatStoredPrice(1_200_000, "INR", "INR")).not.toMatch(/10,?44,?000/)
        expect(formatStoredPrice(1_200_000, "INR", "INR")).not.toMatch(/\$/)
    })

    it("omitting stored currency under INR display still FX (bug path EventsStore had)", () => {
        // Same class as salon-p0-1: money(cents) without stored → treat as USD → ×87
        expect(formatStoredPrice(1_200_000, undefined, "INR")).toBe(`${INR}10,44,000`)
    })

    it("keeps /book Wedding and Patratu service INR honest (regression guard)", () => {
        expect(formatStoredPrice(2_800_000, "INR", "INR")).toBe(`${INR}28,000`)
        expect(formatStoredPrice(2_500_000, "INR", "INR")).toBe(`${INR}25,000`)
        expect(formatStoredPrice(2_800_000, "INR", "INR")).not.toMatch(/24,?36,?000/)
        expect(formatStoredPrice(2_500_000, "INR", "INR")).not.toMatch(/21,?75,?000/)
    })

    it("keeps Free for free events / brief calls", () => {
        expect(formatStoredPrice(0, "INR", "INR")).toBe("Free")
        expect(formatMoney(0, "INR")).toBe("Free")
    })

    it("does not regress USD creator-style stored USD under USD display", () => {
        expect(formatStoredPrice(2900, "USD", "USD")).toBe("$29")
        expect(formatMoney(2900, "USD")).toBe("$29")
    })
})
