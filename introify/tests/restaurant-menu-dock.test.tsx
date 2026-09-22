import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { RestaurantMenu } from "@/components/shop/restaurant-menu"

describe("restaurant menu dock", () => {
    it("keeps search and menu above the page bottom so they stay visible", () => {
        render(
            <RestaurantMenu
                slug="skydine-cafe"
                shopName="SkyDine Cafe"
                currency="INR"
                items={[{ id: "p1", title: "Burger", thumbnailUrl: null, priceCents: 19900, category: "Burgers & Sandwiches" }]}
            />,
        )
        const search = screen.getByRole("button", { name: "Search" })
        const dock = search.closest(".fixed") as HTMLElement
        expect(dock).toBeTruthy()
        expect(dock.className).toMatch(/z-\[70\]/)
        expect(dock.className).toMatch(/bottom-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/)
        expect(screen.getByRole("button", { name: "MENU" })).toBeTruthy()
    })

    it("uses a wider desktop shell from lg while keeping the phone max width", () => {
        const src = readFileSync(join(process.cwd(), "src/components/shop/restaurant-menu.tsx"), "utf8")
        expect(src).toMatch(/max-w-lg lg:max-w-5xl/)
        expect(src).toMatch(/lg:grid-cols-3/)
        expect(src).toMatch(/xl:grid-cols-4/)
        expect(src).toMatch(/lg:max-w-5xl lg:px-6/)
        expect(src).toMatch(/!\(cartOpen \|\| nav \|\| custom\)/)
    })
})

describe("catalog header compact shell", () => {
    it("widens compact restaurant headers on lg+", () => {
        const src = readFileSync(join(process.cwd(), "src/components/shop/catalog-header.tsx"), "utf8")
        expect(src).toMatch(/compact \? "max-w-lg lg:max-w-5xl" : "max-w-5xl"/)
    })
})
