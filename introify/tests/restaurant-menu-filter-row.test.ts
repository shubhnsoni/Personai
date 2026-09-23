import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * P1-4 — mobile filter row must stay legible at ~390px.
 * Full RTL/jsdom for RestaurantMenu is currently blocked on this box
 * (jsdom undici CacheStorage / markAsUncloneable). Source guards lock
 * overflow-x scroll + fade affordance + full chip labels + a11y hooks.
 */
describe("restaurant menu filter row (P1-4)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/shop/restaurant-menu.tsx"), "utf8")

    it("keeps all four filter labels including Ratings 4.0+", () => {
        for (const label of ["Veg", "Non-Veg", "Bestsellers", "Ratings 4.0+"]) {
            expect(src).toContain(`label: "${label}"`)
        }
    })

    it("scrolls the filter row with a visible thin scrollbar (no hide-only clip)", () => {
        expect(src).toMatch(/data-menu-filter-row/)
        expect(src).toMatch(/overflow-x-auto/)
        expect(src).toMatch(/overscroll-x-contain/)
        expect(src).toMatch(/\[scrollbar-width:thin\]/)
        expect(src).not.toMatch(
            /data-menu-filter-row[\s\S]{0,260}\[-ms-overflow-style:none\] \[scrollbar-width:none\]/,
        )
        expect(src).not.toMatch(
            /data-menu-filter-row[\s\S]{0,260}\[&::-webkit-scrollbar\]:hidden/,
        )
    })

    it("renders start/end fade affordances when the row overflows", () => {
        expect(src).toMatch(/data-filter-scroll-fade="start"/)
        expect(src).toMatch(/data-filter-scroll-fade="end"/)
        expect(src).toMatch(/syncFilterOverflow/)
        expect(src).toMatch(/filterOverflow\.end/)
        expect(src).toMatch(/bg-gradient-to-l from-background/)
    })

    it("keeps filter chips keyboard/touch accessible", () => {
        expect(src).toMatch(/role="toolbar"/)
        expect(src).toMatch(/aria-label="Menu filters"/)
        expect(src).toMatch(/aria-pressed=\{c\.on\}/)
        expect(src).toMatch(/type="button"/)
    })
})
