import { describe, expect, it } from "vitest"
import { chargeStoredPrice, formatCheckoutPrice, formatStoredPrice } from "@/lib/pricing"
import { catalogDisplayCurrency } from "@/lib/menu"
import { formatInrPaise, gramsToMg, K22_BPS, ticketPaise } from "@/lib/metal/math"

const RANCHI = {
    k24PaisePer10g: 15_535_000,
    k22PaisePer10g: 14_240_000,
    k18PaisePer10g: 11_651_000,
}

describe("catalogDisplayCurrency", () => {
    it("keeps INR for café roles even when the request wants USD", () => {
        expect(catalogDisplayCurrency("CAFE", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("RESTAURANT", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("BAKERY", "INR", "USD")).toBe("INR")
    })

    it("keeps INR for shop / jewellery / pharmacy / parts kits under a USD request", () => {
        expect(catalogDisplayCurrency("KIRANA", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("BOUTIQUE", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("SHOP", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("JEWELRY_RETAIL", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("JEWELRY_WHOLESALE", null, "USD")).toBe("INR")
        expect(catalogDisplayCurrency("PHARMACY", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("AUTO_PARTS", "INR", "USD")).toBe("INR")
        expect(catalogDisplayCurrency("DISTRIBUTOR", "INR", "USD")).toBe("INR")
    })

    it("leaves creator/designer roles on the request currency", () => {
        expect(catalogDisplayCurrency("DESIGNER", "USD", "USD")).toBe("USD")
        expect(catalogDisplayCurrency("DESIGNER", "USD", "INR")).toBe("INR")
    })

    it("formats Cream Of Tomato paise as rupees on food PDP, not geo dollars", () => {
        expect(formatStoredPrice(15900, "INR", catalogDisplayCurrency("CAFE", "INR", "USD"))).toMatch(/159/)
        expect(formatStoredPrice(15900, "INR", catalogDisplayCurrency("CAFE", "INR", "USD"))).not.toMatch(/\$/)
    })
})

describe("shop checkout currency preservation (P0-2)", () => {
    const mkBangleTicket = ticketPaise(
        { grossMg: gramsToMg(10), purityBps: K22_BPS, makingPaise: 1_420_000 },
        RANCHI,
    )

    it("MK 22K light bangle ticket is exactly ₹1,56,600", () => {
        expect(mkBangleTicket).toBe(15_660_000)
        expect(formatInrPaise(mkBangleTicket)).toBe("₹1,56,600")
    })

    it("does not turn the jewellery ticket into $1800 under a USD geo request", () => {
        // Regression: formatStoredPrice(15660000, INR, USD) ÷ 87 → $1800
        expect(formatStoredPrice(mkBangleTicket, "INR", "USD")).toBe("$1800")
        expect(formatCheckoutPrice(mkBangleTicket, "INR", "USD")).toBe("₹1,56,600")
        expect(formatCheckoutPrice(mkBangleTicket, "INR", "USD")).not.toMatch(/\$/)
    })

    it("charges Stripe in INR paise for jewellery / kirana, not converted USD cents", () => {
        expect(chargeStoredPrice(mkBangleTicket, "INR", "USD")).toEqual({
            amountCents: 15_660_000,
            currency: "INR",
        })
        expect(chargeStoredPrice(16_800, "INR", "USD")).toEqual({
            amountCents: 16_800,
            currency: "INR",
        })
    })

    it("still geo-converts USD-stored creator prices", () => {
        expect(chargeStoredPrice(1000, "USD", "INR").currency).toBe("INR")
        expect(chargeStoredPrice(1000, "USD", "INR").amountCents).toBeGreaterThan(1000)
        expect(formatCheckoutPrice(1000, "USD", "USD")).toMatch(/\$/)
    })

    it("preserves FIRAYALAL / RAGHU INR catalog totals through checkout formatting", () => {
        // Banarasi ₹12,500 and Toor dal ₹168
        expect(formatCheckoutPrice(1_250_000, "INR", "USD")).toBe("₹12,500")
        expect(formatCheckoutPrice(16_800, "INR", "USD")).toBe("₹168")
        expect(
            formatStoredPrice(
                16_800,
                "INR",
                catalogDisplayCurrency("KIRANA", "INR", "USD"),
            ),
        ).toBe("₹168")
    })
})
