// @vitest-environment node
import { describe, expect, it } from "vitest"
import { DEMO_SHOPS } from "@/lib/demo-shops"
import {
    catalogSize,
    orderedDemoShops,
    runPool,
    seedBudgetMs,
    shouldSkipPopulated,
} from "@/lib/demo-shops/seed-order"

describe("demo shop seed order", () => {
    it("fills Aura Fitness and Fit24 before the rest of the kits", () => {
        const slugs = orderedDemoShops(DEMO_SHOPS).map((shop) => shop.slug)
        expect(slugs.slice(0, 3)).toEqual(["neal", "aura-fitness-ranchi", "fit24-ranchi"])
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

    it("keeps Hostinger bootstrap under a 5 minute seed budget by default", () => {
        expect(seedBudgetMs({})).toBe(300_000)
        expect(seedBudgetMs({ INTROIFY_SEED_BUDGET_MS: "15000" })).toBe(15_000)
        expect(seedBudgetMs({ INTROIFY_SEED_BUDGET_MS: "not-a-number" })).toBe(300_000)
    })

    it("runs leftover shops concurrently without dropping items", async () => {
        const seen: number[] = []
        await runPool([1, 2, 3, 4, 5], 3, async (n) => {
            seen.push(n)
        })
        expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    })
})
