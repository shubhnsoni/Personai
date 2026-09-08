import { describe, expect, it } from "vitest"
import { kitAbout } from "@/lib/kit-copy"
import { isDigitalCatalogItem, publicChipAllowed } from "@/lib/surfaces"

describe("pharmacy public chips", () => {
    it("allows the medicines shop chip and blocks the digital-shop chip", () => {
        expect(publicChipAllowed("PHARMACY", "shop")).toBe(true)
        expect(publicChipAllowed("PHARMACY", "products")).toBe(false)
        expect(publicChipAllowed("CREATOR", "products")).toBe(true)
        expect(publicChipAllowed("SHOP", "products")).toBe(true)
    })

    it("treats counter medicines as physical, not digital files", () => {
        expect(isDigitalCatalogItem({ fulfillment: "PHYSICAL", type: "PHYSICAL" })).toBe(false)
        expect(isDigitalCatalogItem({ fulfillment: "DIGITAL", type: "PDF" })).toBe(true)
        expect(isDigitalCatalogItem({ fulfillment: "PHYSICAL", type: "PDF" })).toBe(false)
        expect(isDigitalCatalogItem({ type: "AUDIO" })).toBe(true)
    })

    it("fills pharmacy about copy", () => {
        const about = kitAbout("PHARMACY", "Sunrise Pharmacy")
        expect(about.headline).toMatch(/pharmacy/i)
        expect(about.bio.toLowerCase()).toContain("physical")
        expect(about.bio.toLowerCase()).toContain("digital download")
        expect(about.bio).toContain("Sunrise Pharmacy")
    })
})
