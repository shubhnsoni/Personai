import { describe, expect, it } from "vitest"
import { catalogLabel, catalogPath, isRestaurant, needsGuestTableOffering } from "@/lib/menu"

describe("isRestaurant role alias", () => {
    it("treats RESTAURANT and every food-menu alias as restaurant menus", () => {
        expect(isRestaurant("RESTAURANT")).toBe(true)
        expect(isRestaurant("CAFE")).toBe(true)
        expect(isRestaurant("DHABA")).toBe(true)
        expect(isRestaurant("CLOUD_KITCHEN")).toBe(true)
        expect(isRestaurant("BAKERY")).toBe(true)
        expect(isRestaurant("SWEETS")).toBe(true)
    })

    it("does not treat non-food shop aliases as restaurants", () => {
        expect(isRestaurant("SHOP")).toBe(false)
        expect(isRestaurant("KIRANA")).toBe(false)
        expect(isRestaurant("BOUTIQUE")).toBe(false)
        expect(isRestaurant(null)).toBe(false)
    })

    it("labels and paths follow the restaurant surface for cafes and bakeries", () => {
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogPath("skydine-cafe", "CAFE")).toBe("/skydine-cafe/menu")
        expect(catalogLabel("BAKERY")).toBe("Menu")
        expect(catalogPath("try-bakery", "BAKERY")).toBe("/try-bakery/menu")
    })
})

describe("needsGuestTableOffering", () => {
    it("keeps dine-in food roles on the table-ensure path", () => {
        expect(needsGuestTableOffering("RESTAURANT", "BOOK_TABLE")).toBe(true)
        expect(needsGuestTableOffering("CAFE", "BOOK_TABLE")).toBe(true)
        expect(needsGuestTableOffering("DHABA", "BOOK_TABLE")).toBe(true)
        expect(needsGuestTableOffering("CLOUD_KITCHEN", "BOOK_TABLE")).toBe(true)
        expect(needsGuestTableOffering("CAFE", null)).toBe(true)
    })

    it("skips bakery/sweets counters so Free-plan catalogs do not trip ensureTableService", () => {
        expect(needsGuestTableOffering("BAKERY", "SELL_PRODUCTS")).toBe(false)
        expect(needsGuestTableOffering("SWEETS", "SELL_PRODUCTS")).toBe(false)
        expect(needsGuestTableOffering("BAKERY", "BOOK_TABLE")).toBe(false)
        expect(needsGuestTableOffering("RESTAURANT", "SELL_PRODUCTS")).toBe(false)
        expect(needsGuestTableOffering("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(needsGuestTableOffering(null, null)).toBe(false)
    })
})
