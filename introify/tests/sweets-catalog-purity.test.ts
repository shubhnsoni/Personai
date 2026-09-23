// @vitest-environment node
import { describe, expect, it } from "vitest"
import { CHURUWALA, SAMRIDDHI_SWEETS } from "@/lib/demo-shops/food"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"

/** Categories allowed on SWEETS demo kits (honest mithai/namkeen/tray counters). */
const SWEETS_OK_CATEGORIES = new Set(["Mithai", "Trays", "Namkeen", "Sweets"])

describe("P1-1 sweets catalog purity", () => {
    it("Samriddhi Sweets has no Bakery category or chocolate brownie leakage", () => {
        expect(SAMRIDDHI_SWEETS.flavor).toBe("SWEETS")
        expect(SAMRIDDHI_SWEETS.slug).toBe("samriddhi-sweets")
        expect(SAMRIDDHI_SWEETS.venue.categories).toEqual(["Sweets"])

        const products = SAMRIDDHI_SWEETS.products || []
        expect(products.length).toBeGreaterThanOrEqual(8)

        for (const product of products) {
            expect(product.category).toBeTruthy()
            expect(SWEETS_OK_CATEGORIES.has(product.category!)).toBe(true)
            expect(product.category).not.toMatch(/bakery/i)
            expect(product.title).not.toMatch(/brownie/i)
            expect(product.sku).not.toBe("SS-BR")
        }

        const categories = new Set(products.map((p) => p.category))
        expect(categories.has("Bakery")).toBe(false)
        expect(categories.has("Mithai")).toBe(true)
        expect(categories.has("Namkeen")).toBe(true)
        expect(categories.has("Trays")).toBe(true)
    })

    it("Churuwala SWEETS peer stays bakery-free as the purity reference", () => {
        for (const product of CHURUWALA.products || []) {
            expect(product.category).not.toMatch(/bakery/i)
            expect(SWEETS_OK_CATEGORIES.has(product.category!)).toBe(true)
        }
    })

    it("forces Samriddhi catalog refresh so LIVE print/menu drop the leaked Bakery SKU", () => {
        expect(FORCE_REFRESH_SLUGS.has("samriddhi-sweets")).toBe(true)
        const shop = { slug: "samriddhi-sweets", products: SAMRIDDHI_SWEETS.products, services: [] }
        // Even when LIVE still has the old 10-row catalog (including brownie), do not skip.
        expect(shouldSkipPopulated(shop, 10, 0, false)).toBe(false)
    })
})
