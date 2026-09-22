import { describe, expect, it } from "vitest"
import { formatStoredPrice } from "@/lib/pricing"
import { catalogDisplayCurrency } from "@/lib/menu"

describe("catalogDisplayCurrency", () => {
    it("keeps INR for café roles even when the request wants USD", () => {
        expect(catalogDisplayCurrency("CAFE", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("RESTAURANT", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("BAKERY", "INR", "USD")).toBe("INR")
    })

    it("leaves non-food roles on the request currency", () => {
        expect(catalogDisplayCurrency("DESIGNER", "USD", "USD")).toBe("USD")
        expect(catalogDisplayCurrency("DESIGNER", "USD", "INR")).toBe("INR")
    })

    it("formats Cream Of Tomato paise as rupees on food PDP, not geo dollars", () => {
        expect(formatStoredPrice(15900, "INR", catalogDisplayCurrency("CAFE", "INR", "USD"))).toMatch(/159/)
        expect(formatStoredPrice(15900, "INR", catalogDisplayCurrency("CAFE", "INR", "USD"))).not.toMatch(/\$/)
    })
})
