import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    emptyMenuCopy,
    filterMenuItems,
    menuFiltersActive,
    nextDietFilter,
} from "@/lib/restaurant-menu-filters"

const items = [
    { title: "Iced Latte", diet: "VEG", sold: 12, priceCents: 16900, rating: 4.6 },
    { title: "Chicken Burger", diet: "NONVEG", sold: 0, priceCents: 24900, rating: 4.2 },
    { title: "Plain Toast", diet: "VEG", sold: 0, priceCents: 9900, rating: 3.5 },
]

describe("restaurant menu empty / filter semantics (P1-8)", () => {
    it("returns zero rows for a search miss", () => {
        const rows = filterMenuItems(items, { q: "zzzz-no-such-dish", veg: false, nonveg: false, best: false, rated: false })
        expect(rows).toHaveLength(0)
        expect(menuFiltersActive({ q: "zzzz-no-such-dish", veg: false, nonveg: false, best: false, rated: false })).toBe(true)
        expect(emptyMenuCopy({ q: "zzzz-no-such-dish", veg: false, nonveg: false, best: false, rated: false }).title).toBe("No dishes match")
    })

    it("makes Veg and Non-Veg mutually exclusive", () => {
        expect(nextDietFilter("veg", { veg: false, nonveg: true })).toEqual({ veg: true, nonveg: false })
        expect(nextDietFilter("nonveg", { veg: true, nonveg: false })).toEqual({ veg: false, nonveg: true })
        expect(nextDietFilter("veg", { veg: true, nonveg: false })).toEqual({ veg: false, nonveg: false })
    })

    it("explains empty Bestsellers without looking broken", () => {
        const onlyNonBest = [{ title: "Obscure Side", diet: "VEG", sold: 0, priceCents: 5000, rating: 4 }]
        const rows = filterMenuItems(onlyNonBest, { q: "", veg: false, nonveg: false, best: true, rated: false })
        expect(rows).toHaveLength(0)
        expect(emptyMenuCopy({ q: "", veg: false, nonveg: false, best: true, rated: false }).title).toBe("No bestsellers yet")
    })

    it("renders an explicit empty-state + clear action in RestaurantMenu", () => {
        const src = readFileSync(join(process.cwd(), "src/components/shop/restaurant-menu.tsx"), "utf8")
        expect(src).toMatch(/No dishes match|emptyCopy\.title/)
        expect(src).toMatch(/data-empty-menu/)
        expect(src).toMatch(/Clear search|Clear filters/)
        expect(src).toMatch(/nextDietFilter/)
        expect(src).toMatch(/max-w-lg lg:max-w-5xl/)
    })
})
