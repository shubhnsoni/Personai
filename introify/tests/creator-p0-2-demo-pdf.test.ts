import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { catalogDisplayCurrency } from "@/lib/menu"
import { formatStoredPrice } from "@/lib/pricing"
import { digitalCoverForProduct, pdpAllowsBlisterFallback } from "@/lib/shop/digital-cover"

const PHARMACY_MARKERS = ["blister", "pill", "pharmacy", "paracetamol", "medicine", "rx-pack"]

describe("creator-p0-2 demo PDF currency consistency", () => {
    it("keeps Riley Vale CONSULTANT USD fixtures at $29 / $19 under an INR geo request", () => {
        const display = catalogDisplayCurrency("CONSULTANT", "USD", "INR")
        expect(display).toBe("USD")
        const workbook = formatStoredPrice(2900, "USD", display)
        const script = formatStoredPrice(1900, "USD", display)
        expect(workbook).toBe("$29")
        expect(script).toBe("$19")
        expect(workbook).not.toMatch(/₹/)
        expect(script).not.toMatch(/₹/)
    })

    it("still geo-converts DESIGNER USD under INR (shop P0-2 non-regression)", () => {
        expect(catalogDisplayCurrency("DESIGNER", "USD", "INR")).toBe("INR")
        expect(formatStoredPrice(2900, "USD", "INR")).toMatch(/₹/)
    })
})

describe("creator-p0-2 digital cover + blister gate", () => {
    it("maps Offer stack workbook → try-zine and Discovery call script → try-course", () => {
        expect(digitalCoverForProduct("PDF", "Offer stack workbook")).toBe("/uploads/try-zine.jpg")
        expect(digitalCoverForProduct("PDF", "Discovery call script")).toBe("/uploads/try-course.jpg")
    })

    it("never returns a pharmacy-ish URL for PDF covers", () => {
        for (const title of ["Offer stack workbook", "Discovery call script", "Random PDF"]) {
            const url = (digitalCoverForProduct("PDF", title) || "").toLowerCase()
            expect(url.length).toBeGreaterThan(0)
            for (const marker of PHARMACY_MARKERS) {
                expect(url.includes(marker)).toBe(false)
            }
        }
    })

    it("allows blister fallback only for pharmacy kits", () => {
        expect(pdpAllowsBlisterFallback("PHARMACY", true)).toBe(true)
        expect(pdpAllowsBlisterFallback("PHARMACY", false)).toBe(true)
        expect(pdpAllowsBlisterFallback("CONSULTANT", false)).toBe(false)
        expect(pdpAllowsBlisterFallback("CONSULTANT", true)).toBe(true)
        expect(pdpAllowsBlisterFallback("DESIGNER", false)).toBe(false)
    })
})

describe("creator-p0-2 seed / bootstrap fixture values", () => {
    const seed = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8")
    const boot = readFileSync(join(process.cwd(), "scripts/bootstrap-hostinger.mjs"), "utf8")

    it("seeds Offer stack workbook + Discovery call script as USD PDFs with digital covers", () => {
        expect(seed).toContain("Offer stack workbook")
        expect(seed).toContain("Discovery call script")
        expect(seed).toMatch(/priceCents:\s*2900/)
        expect(seed).toMatch(/priceCents:\s*1900/)
        expect(seed).toContain("currency: 'USD'")
        expect(seed).toContain("thumbnailUrl: '/uploads/try-zine.jpg'")
        expect(seed).toContain("thumbnailUrl: '/uploads/try-course.jpg'")
        expect(seed.toLowerCase()).not.toMatch(/pharmacy|blister|paracetamol/)
    })

    it("bootstrap create path mirrors the same USD + cover fixtures", () => {
        expect(boot).toContain("Offer stack workbook")
        expect(boot).toContain("Discovery call script")
        expect(boot).toContain('currency: "USD"')
        expect(boot).toContain("/uploads/try-zine.jpg")
        expect(boot).toContain("/uploads/try-course.jpg")
    })
})
