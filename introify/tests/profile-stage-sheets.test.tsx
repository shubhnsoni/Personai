import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ReserveSheet } from "@/components/booking/reserve-sheet"
import { TipSheet } from "@/components/profile/tip-sheet"
import { CheckoutSheet } from "@/components/checkout/checkout-sheet"

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

/**
 * Intro chips besides About (Book, Tip, buy) used a bottom sheet at every width.
 * Desktop must follow the same ProfileStage as About: SIDE_PANEL → sidebar, otherwise a
 * centred popup. Checkout stacks on the panel, so it is forced to popup on desktop — still
 * never a bottom drawer above `md`.
 */

function stage() {
    return document.querySelector("[data-content-stage]")
}

describe("intro sheets follow the owner display mode on desktop", () => {
    it("Book uses the side panel when the owner chose SIDE_PANEL", () => {
        render(
            <ReserveSheet
                open
                onClose={() => {}}
                profile={{ id: "p1", displayName: "Ada" }}
                service={null}
                displayMode="SIDE_PANEL"
            />,
        )
        expect(stage()?.getAttribute("data-desktop-surface")).toBe("sidebar")
        expect(stage()?.className).toMatch(/\bmd:static\b/)
        expect(screen.getByText("Reserve a table")).toBeTruthy()
    })

    it("Book centres as a popup when the owner chose POPUP", () => {
        render(
            <ReserveSheet
                open
                onClose={() => {}}
                profile={{ id: "p1", displayName: "Ada" }}
                service={null}
                displayMode="POPUP"
            />,
        )
        expect(stage()?.getAttribute("data-desktop-surface")).toBe("popup")
        expect(stage()?.className).toMatch(/\bitems-end\b/)
        expect(stage()?.className).toMatch(/\bmd:items-center\b/)
        expect(stage()?.className).not.toMatch(/\binset-x-0\b/)
    })

    it("Tip follows SIDE_PANEL the same way About does", () => {
        render(
            <TipSheet
                profileId="p1"
                displayName="Ada"
                onClose={() => {}}
                displayMode="SIDE_PANEL"
            />,
        )
        expect(stage()?.getAttribute("data-desktop-surface")).toBe("sidebar")
    })

    it("Cafe table booking on the intro screen centres on desktop instead of a drawer", () => {
        render(
            <ReserveSheet
                open
                onClose={() => {}}
                profile={{ id: "cafe", displayName: "Corner Table" }}
                service={null}
                displayMode="POPUP"
            />,
        )
        expect(stage()?.getAttribute("data-desktop-surface")).toBe("popup")
        expect(stage()?.className).toMatch(/\bmd:items-center\b/)
        expect(stage()?.className).not.toMatch(/\binset-x-0\b/)
        expect(screen.getByText("Reserve a table")).toBeTruthy()
    })

    it("Checkout is a centred desktop popup, never a bottom-only sheet", () => {
        render(
            <CheckoutSheet
                item={{ itemType: "product", itemId: "i1", title: "Print", priceCents: 500 }}
                onClose={() => {}}
            />,
        )
        expect(stage()?.getAttribute("data-desktop-surface")).toBe("popup")
        expect(stage()?.className).toMatch(/\bmd:items-center\b/)
        expect(screen.getByText("Print")).toBeTruthy()
    })
})
