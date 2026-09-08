import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type { GoldBoard } from "@/lib/metal/board"
import { GoldRateStrip } from "@/components/shop/gold-rate-strip"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))

vi.mock("@/app/actions/gold-board", () => ({
    applyGoldQuote: vi.fn(),
    checkGoldQuoteIfStale: vi.fn().mockResolvedValue(null),
    previewCityGoldRate: vi.fn(),
    saveGoldBoardDisplay: vi.fn().mockResolvedValue({}),
    saveManualGoldBoard: vi.fn(),
}))

const RATES = { k24PaisePer10g: 15_415_000, k22PaisePer10g: 14_130_000, k18PaisePer10g: 11_561_000 }

const board: GoldBoard = {
    city: "Ranchi",
    citySlug: "ranchi",
    asOf: "2026-09-08T10:00:00.000Z",
    source: "city-feed",
    ...RATES,
    shopTape: true,
    pdpTape: false,
    collapsed: false,
    tape: {
        fetchedAt: "2026-09-08T10:00:00.000Z",
        cities: [
            { city: "Ranchi", citySlug: "ranchi", ...RATES },
            { city: "Mumbai", citySlug: "mumbai", ...RATES },
        ],
    },
}

describe("GoldRateStrip tape", () => {
    it("shows only the marquee on the shop until Rates is opened", () => {
        const { container } = render(<GoldRateStrip board={board} surface="shop" />)
        expect(screen.getByText("City rates")).toBeTruthy()
        expect(screen.getAllByText(/Mumbai/).length).toBeGreaterThan(0)
        expect(screen.queryByText(/metal \+ making/)).toBeNull()
        expect(container.firstElementChild?.className).toContain("bg-card")
        expect(container.firstElementChild?.className).not.toContain("bg-zinc-900")
        fireEvent.click(screen.getByRole("button", { name: "Rates" }))
        expect(screen.getByText(/metal \+ making/)).toBeTruthy()
    })

    it("shows only the marquee on the product page", () => {
        render(<GoldRateStrip board={{ ...board, pdpTape: true }} surface="pdp" tone="light" />)
        expect(screen.getAllByText(/Mumbai/).length).toBeGreaterThan(0)
        expect(screen.queryByText(/Ranchi board/)).toBeNull()
        expect(screen.queryByText("City rates")).toBeNull()
        expect(screen.queryByText(/metal \+ making/)).toBeNull()
        expect(screen.queryByRole("button", { name: "Rates" })).toBeNull()
    })

    it("hides the product-page strip when pdpTape is off", () => {
        const { container } = render(<GoldRateStrip board={board} surface="pdp" tone="light" />)
        expect(container.textContent).toBe("")
    })
})

describe("GoldBoardCard collapse", () => {
    it("puts Compact in the header and keeps shop toggles off the rate board", async () => {
        const { GoldBoardCard } = await import("@/components/shop/gold-board-card")
        await act(async () => {
            render(
                <GoldBoardCard
                    profileId="p1"
                    board={board}
                    personalityConfig={JSON.stringify({ goldBoard: board })}
                />,
            )
        })
        expect(screen.getByText("Compact")).toBeTruthy()
        expect(screen.queryByText("Shop marquee")).toBeNull()
        expect(screen.queryByText("Product page")).toBeNull()
        expect(screen.getByLabelText("24K rupees per gram")).toBeTruthy()
        const compact = screen.getByText("Compact").closest("label")!.querySelector("button")!
        await act(async () => {
            fireEvent.click(compact)
        })
        expect(screen.queryByLabelText("24K rupees per gram")).toBeNull()
        expect(screen.getByText("Compact")).toBeTruthy()
    })
})
