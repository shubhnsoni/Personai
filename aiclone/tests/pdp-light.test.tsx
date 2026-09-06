import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { buildPdpContent } from "@/lib/shop/pdp-content"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("next/link", () => ({
    default: function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
        return <a href={href} className={className}>{children}</a>
    },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))

vi.mock("@/app/actions/products", () => ({ addProductReview: vi.fn() }))

vi.mock("@/components/checkout/checkout-sheet", () => ({
    CheckoutSheet: () => null,
}))

const { PdpLight } = await import("@/components/shop/pdp-light")

describe("PdpLight v1.3", () => {
    it("renders the locked light pharmacy PDP structure", () => {
        const content = buildPdpContent({
            title: "Paracetamol 650",
            shopName: "E2E Sunrise Pharmacy",
            category: "Fever",
            fulfillment: "PHYSICAL",
            type: "PHYSICAL",
            pharmacy: true,
        })
        const { container } = render(
            <PdpLight
                slug="e2e-sunrise"
                shopName="E2E Sunrise Pharmacy"
                catalogLabel="Medicines"
                title="Paracetamol 650"
                content={content}
                photos={[]}
                priceLabel="$0.32"
                stockLabel="40 in stock"
                inStock
                ratingAvg={5}
                ratingCount={12}
                quotes={content.sampleQuotes}
                productId="pcm-650"
                buy={{ label: "Order · $0.32" }}
            />,
        )

        const root = container.querySelector(".pdp-v13")
        expect(root).toBeTruthy()
        expect(root?.className).toContain("light")
        expect(window.getComputedStyle(root as Element).backgroundColor).not.toBe("rgb(7, 8, 10)")

        expect(screen.getByText("E2E Sunrise Pharmacy")).toBeTruthy()
        expect(screen.getByText("Medicines")).toBeTruthy()
        expect(screen.getByText("Cart · 0")).toBeTruthy()
        expect(screen.getByRole("heading", { name: "Paracetamol 650" })).toBeTruthy()
        expect(screen.getByText("Physical · Fever")).toBeTruthy()
        expect(screen.getByText("$0.32")).toBeTruthy()
        expect(screen.getByText("40 in stock")).toBeTruthy()
        expect(screen.getAllByText("Order · $0.32")).toHaveLength(2)
        expect(screen.getByText("Form")).toBeTruthy()
        expect(screen.getByText("Tablet")).toBeTruthy()
        expect(screen.getByText("650 mg")).toBeTruthy()
        expect(screen.getByText("Fever / Analgesic")).toBeTruthy()
        expect(screen.getByText("10 tablets")).toBeTruthy()
        expect(screen.getByText("More details")).toBeTruthy()
        expect(screen.getByText("MORE")).toBeTruthy()
        expect(screen.getByText("Relief you can count on")).toBeTruthy()
        expect(screen.getByText("From the brand")).toBeTruthy()
        expect(screen.getByText("Trusted OTC, everyday care")).toBeTruthy()
        expect(screen.getByText("Daytime ease")).toBeTruthy()
        expect(screen.getByText("Family ready")).toBeTruthy()
        expect(screen.getByText("Shelf trusted")).toBeTruthy()
        expect(screen.getByText("Reviews")).toBeTruthy()
        expect(screen.getByText("Priya S. · Verified")).toBeTruthy()
        expect(screen.queryByText(/PersonaLink craft v1\.3/i)).toBeNull()
        expect(container.querySelector(".sticky-bar")).toBeTruthy()
        expect(container.innerHTML.toLowerCase()).not.toContain("merchants upload")
        expect(container.innerHTML).not.toContain("#07080a")
        expect(container.querySelector(".pdp")).toBeTruthy()
    })
})
