import { describe, expect, it } from "vitest"
import { catalogLabel, catalogPath, isRestaurant } from "@/lib/menu"

describe("isRestaurant role alias", () => {
    it("treats RESTAURANT and food aliases as restaurant menus", () => {
        expect(isRestaurant("RESTAURANT")).toBe(true)
        expect(isRestaurant("CAFE")).toBe(true)
        expect(isRestaurant("DHABA")).toBe(true)
        expect(isRestaurant("CLOUD_KITCHEN")).toBe(true)
    })

    it("does not treat shop aliases as restaurants", () => {
        expect(isRestaurant("SHOP")).toBe(false)
        expect(isRestaurant("BAKERY")).toBe(false)
        expect(isRestaurant("KIRANA")).toBe(false)
        expect(isRestaurant(null)).toBe(false)
    })

    it("labels and paths follow the restaurant surface for cafes", () => {
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogPath("skydine-cafe", "CAFE")).toBe("/skydine-cafe/menu")
    })
})
