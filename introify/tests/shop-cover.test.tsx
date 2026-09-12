import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { ShopWordmark } from "@/components/shop/shop-cover"

describe("shop wordmark", () => {
    it("shows a cafe logo as a small circle, not a short original-aspect rectangle", () => {
        const { container } = render(
            <ShopWordmark name="SkyDine Cafe" logoUrl="/uploads/skydine-cafe/logo.png" />,
        )
        const img = container.querySelector("img") as HTMLImageElement
        expect(img.className).toMatch(/rounded-full/)
        expect(img.className).toMatch(/object-cover/)
        expect(img.className).toMatch(/h-8/)
        expect(img.className).toMatch(/w-8/)
        expect(img.className).not.toMatch(/w-auto/)
        expect(container.textContent).toContain("SkyDine Cafe")
    })
})
