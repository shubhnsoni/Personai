import { describe, expect, it, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    guestHistoryOrPopularSection,
    readPriorOrderItemIds,
    writePriorOrderItemIds,
} from "@/lib/restaurant-menu-sections"

const catalog = [
    { id: "pav", title: "Pav pack", sold: 12 },
    { id: "loaf", title: "Sandwich loaf", sold: 8 },
    { id: "croissant", title: "Butter croissant", sold: 5 },
    { id: "brownie", title: "Chocolate brownie", sold: 0 },
    { id: "milk", title: "Milk cake 500g", sold: 0 },
]

describe("guestHistoryOrPopularSection (P1-2 Order Again truth)", () => {
    it("never labels sold/downloadCount bestsellers as Order Again on a fresh guest", () => {
        const section = guestHistoryOrPopularSection(catalog, [])
        expect(section).not.toBeNull()
        expect(section!.label).toBe("Popular")
        expect(section!.id).toBe("popular")
        expect(section!.items.map((i) => i.id)).toEqual(["pav", "loaf", "croissant"])
        expect(section!.label).not.toBe("Order Again")
    })

    it("omits the highlight rail when there is no history and no sold counts (no first-N fabrication)", () => {
        const cold = catalog.map((row) => ({ ...row, sold: 0 }))
        expect(guestHistoryOrPopularSection(cold, [])).toBeNull()
        expect(guestHistoryOrPopularSection(cold, ["missing-id"])).toBeNull()
    })

    it("keeps Order Again only when prior ids still exist on this menu", () => {
        const section = guestHistoryOrPopularSection(catalog, ["croissant", "milk", "gone"])
        expect(section).toEqual({
            id: "again",
            label: "Order Again",
            items: [
                { id: "croissant", title: "Butter croissant", sold: 5 },
                { id: "milk", title: "Milk cake 500g", sold: 0 },
            ],
        })
    })

    it("falls back to Popular when prior ids miss the current catalog", () => {
        const section = guestHistoryOrPopularSection(catalog, ["retired-sku"])
        expect(section!.label).toBe("Popular")
        expect(section!.items[0].id).toBe("pav")
    })
})

describe("prior order item persistence", () => {
    beforeEach(() => {
        const store = new Map<string, string>()
        const memory = {
            getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
            setItem: (key: string, value: string) => { store.set(key, String(value)) },
            removeItem: (key: string) => { store.delete(key) },
            clear: () => { store.clear() },
            key: (index: number) => Array.from(store.keys())[index] ?? null,
            get length() { return store.size },
        }
        Object.defineProperty(globalThis, "localStorage", { value: memory, configurable: true })
        localStorage.clear()
    })

    it("round-trips ordered ids newest-first and de-dupes", () => {
        writePriorOrderItemIds("try-bakery", ["pav", "loaf"])
        writePriorOrderItemIds("try-bakery", ["croissant", "pav"])
        expect(readPriorOrderItemIds("try-bakery")).toEqual(["croissant", "pav", "loaf"])
        expect(readPriorOrderItemIds("other-shop")).toEqual([])
    })
})

describe("RestaurantMenu wiring (source)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/shop/restaurant-menu.tsx"), "utf8")

    it("gates the highlight rail through guestHistoryOrPopularSection", () => {
        expect(src).toMatch(/guestHistoryOrPopularSection/)
        expect(src).toMatch(/writePriorOrderItemIds/)
        expect(src).toMatch(/readPriorOrderItemIds/)
        expect(src).not.toMatch(/label:\s*"Order Again",\s*items:\s*again\.length \? again : items\.slice\(0,\s*3\)/)
        expect(src).not.toMatch(/items\.slice\(0,\s*3\)/)
    })
})
