// @vitest-environment node
import { describe, expect, it } from "vitest"
import { DEMO_SHOPS } from "@/lib/demo-shops"
import {
    catalogSize,
    orderedDemoShops,
    seedBudgetMs,
    shouldSkipPopulated,
} from "@/lib/demo-shops/seed-order"

describe("demo shop seed order", () => {
    it("fills Aura Fitness and Fit24 before the rest of the kits", () => {
        const slugs = orderedDemoShops(DEMO_SHOPS).map((shop) => shop.slug)
        expect(slugs.slice(0, 2)).toEqual(["aura-fitness-ranchi", "fit24-ranchi"])
        expect(slugs.at(-1)).toBe("skydine-cafe")
        expect(new Set(slugs).size).toBe(DEMO_SHOPS.length)
    })

    it("skips a shop only when the live catalog is at least as large as the fixture", () => {
        const shop = { products: [{}, {}], services: [{}] }
        expect(catalogSize(shop)).toBe(3)
        expect(shouldSkipPopulated(shop, 2, 1, false)).toBe(true)
        expect(shouldSkipPopulated(shop, 1, 1, false)).toBe(false)
        expect(shouldSkipPopulated(shop, 2, 1, true)).toBe(false)
        expect(shouldSkipPopulated({ products: [], services: [] }, 0, 0, false)).toBe(false)
    })

    it("keeps Hostinger bootstrap under a 3 minute seed budget by default", () => {
        expect(seedBudgetMs({})).toBe(180_000)
        expect(seedBudgetMs({ INTROIFY_SEED_BUDGET_MS: "15000" })).toBe(15_000)
        expect(seedBudgetMs({ INTROIFY_SEED_BUDGET_MS: "not-a-number" })).toBe(180_000)
    })
})
