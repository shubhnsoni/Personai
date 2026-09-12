import { describe, expect, it } from "vitest"
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
})
