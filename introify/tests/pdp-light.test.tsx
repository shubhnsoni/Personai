import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
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
    it("renders the pharmacy PDP structure without forcing a light class", () => {
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
        expect(root?.className).not.toContain("light")
        expect(container.querySelector("[class*='PdpThemeLock']")).toBeNull()

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
        expect(screen.queryByText("More details")).toBeNull()
        expect(container.querySelectorAll(".deck-card")).toHaveLength(0)
        expect(screen.queryByText("From the brand")).toBeNull()
        expect(screen.getByText("Reviews")).toBeTruthy()
        expect(screen.getByText("Priya S. · Verified")).toBeTruthy()
        expect(screen.queryByText(/Introify craft v1\.3/i)).toBeNull()
        expect(container.querySelector(".sticky-bar")).toBeTruthy()
        expect(container.innerHTML.toLowerCase()).not.toContain("merchants upload")
        expect(container.innerHTML).not.toContain("#07080a")
        expect(container.querySelector(".pdp")).toBeTruthy()
    })

    it("stacks unique square more-details cards the visitor can change", () => {
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
                photos={["/cover.jpg", "/more-a.jpg", "/more-b.jpg", "/more-c.jpg"]}
                showMore
                priceLabel="$0.32"
                quotes={[]}
                productId="pcm-650"
                buy={{ label: "Order · $0.32" }}
            />,
        )

        const cards = container.querySelectorAll(".deck-card")
        expect(cards).toHaveLength(3)
        expect(container.querySelector(".more-deck")).toBeTruthy()
        expect((container.querySelector(".deck-card.front img") as HTMLImageElement | null)?.getAttribute("src")).toBe("/more-a.jpg")
        expect(screen.getByText("MORE")).toBeTruthy()
        expect(container.querySelectorAll(".deck-dot")).toHaveLength(3)

        fireEvent.click(screen.getByText("MORE"))
        expect((container.querySelector(".deck-card.front img") as HTMLImageElement | null)?.getAttribute("src")).toBe("/more-b.jpg")

        fireEvent.click(screen.getByLabelText("Card 3"))
        expect((container.querySelector(".deck-card.front img") as HTMLImageElement | null)?.getAttribute("src")).toBe("/more-c.jpg")
    })

    it("swipes the square more-details stack to the next card", () => {
        const content = buildPdpContent({
            title: "Paracetamol 650",
            shopName: "E2E Sunrise Pharmacy",
            category: "Fever",
            fulfillment: "PHYSICAL",
            pharmacy: true,
        })
        const { container } = render(
            <PdpLight
                slug="e2e-sunrise"
                shopName="E2E Sunrise Pharmacy"
                catalogLabel="Medicines"
                title="Paracetamol 650"
                content={content}
                photos={["/cover.jpg", "/more-a.jpg", "/more-b.jpg"]}
                showMore
                priceLabel="$0.32"
                quotes={[]}
                productId="pcm-650"
                buy={{ label: "Order · $0.32" }}
            />,
        )
        const front = container.querySelector(".deck-card.front") as HTMLElement
        expect((front.querySelector("img") as HTMLImageElement).getAttribute("src")).toBe("/more-a.jpg")
        fireEvent.pointerDown(front, { clientX: 200, clientY: 80, button: 0, pointerId: 1 })
        fireEvent.pointerMove(front, { clientX: 120, clientY: 80, pointerId: 1 })
        fireEvent.pointerUp(front, { clientX: 80, clientY: 80, pointerId: 1 })
        expect((container.querySelector(".deck-card.front img") as HTMLImageElement | null)?.getAttribute("src")).toBe("/more-b.jpg")
    })
})
