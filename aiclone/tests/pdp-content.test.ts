import { describe, expect, it } from "vitest"
import {
    buildPdpContent,
    isParacetamol650,
    pdpQuotes,
    pdpRating,
    shopVoiceName,
} from "@/lib/shop/pdp-content"

describe("pdp content", () => {
    it("strips the E2E prefix from shop voice", () => {
        expect(shopVoiceName("E2E Sunrise Pharmacy")).toBe("Sunrise Pharmacy")
        expect(shopVoiceName("Sunrise Pharmacy")).toBe("Sunrise Pharmacy")
    })

    it("locks Paracetamol 650 pharmacy copy to the craft OTC voice", () => {
        expect(isParacetamol650("Paracetamol 650")).toBe(true)
        const content = buildPdpContent({
            title: "Paracetamol 650",
            shopName: "E2E Sunrise Pharmacy",
            category: "Fever",
            fulfillment: "PHYSICAL",
            type: "PHYSICAL",
            pharmacy: true,
        })
        expect(content.kicker).toBe("Physical · Fever")
        expect(content.blurb).toContain("650 mg")
        expect(content.blurb).toContain("Sunrise Pharmacy")
        expect(content.blurb.toLowerCase()).not.toContain("merchant")
        expect(content.specs).toEqual([
            { label: "Form", value: "Tablet" },
            { label: "Strength", value: "650 mg" },
            { label: "Category", value: "Fever / Analgesic" },
            { label: "Pack size", value: "10 tablets" },
        ])
        expect(content.storyTitle).toBe("Relief you can count on")
        expect(content.brandTitle).toBe("Trusted OTC, everyday care")
        expect(content.tiles).toEqual(["Daytime ease", "Family ready", "Shelf trusted"])
        expect(content.sampleQuotes).toHaveLength(3)
    })

    it("uses real reviews when present, otherwise pharmacy sample quotes", () => {
        const content = buildPdpContent({
            title: "Paracetamol 650",
            shopName: "E2E Sunrise Pharmacy",
            category: "Fever",
            fulfillment: "PHYSICAL",
            pharmacy: true,
        })
        expect(pdpQuotes([], content.sampleQuotes).map((q) => q.who)).toEqual([
            "Priya S. · Verified",
            "Marcus L. · Verified",
            "Amina R. · Verified",
        ])
        expect(pdpQuotes([{ visitorName: "Dev", rating: 4, text: "Works." }], content.sampleQuotes)).toEqual([
            { who: "Dev · Verified", text: "Works.", rating: 4 },
        ])
        expect(pdpRating([], 12)).toEqual({ avg: 5, count: 12 })
        expect(pdpRating([{ rating: 4 }, { rating: 5 }], 12)).toEqual({ avg: 4.5, count: 2 })
    })
})
