import { describe, expect, it } from "vitest"
import { isRestaurant, needsGuestTableOffering } from "@/lib/menu"
import { BAKERS_FRESH, SAMRIDDHI_SWEETS } from "@/lib/demo-shops/food"
import { TRY_BAKERY } from "@/lib/demo-shops/try-food"

/**
 * P0-1: bakery/sweets profile homes crashed with React #441 because
 * isRestaurant(BAKERY|SWEETS) + missing TABLE called ensureTableService,
 * which throws when Free-plan offerings are already filled by the product catalog.
 */
describe("P0-1 bakery/sweets guest table ensure", () => {
    it("demo bakery/sweets remain food-menu roles but do not need a guest TABLE", () => {
        for (const shop of [BAKERS_FRESH, SAMRIDDHI_SWEETS, TRY_BAKERY]) {
            expect(isRestaurant(shop.flavor)).toBe(true)
            expect(shop.goal).toBe("SELL_PRODUCTS")
            expect(needsGuestTableOffering(shop.flavor, shop.goal)).toBe(false)
            expect(shop.services?.some((s) => s.kind === "TABLE") ?? false).toBe(false)
            expect((shop.products || []).length).toBeGreaterThanOrEqual(8)
        }
    })
})
