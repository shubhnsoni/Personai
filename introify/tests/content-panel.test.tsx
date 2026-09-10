import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ContentPanel } from "@/components/profile/content-panel"

vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

/**
 * Guest content chrome on the public profile.
 *
 * The owner picks Popup vs Side panel in the editor (`contentDisplayMode`). That value was
 * stored and never read: ContentPanel always used a bottom-aligned overlay below `lg` and a
 * sidebar at `lg+`. On a desktop window under 1024px — and for Book/Tip, at every width — the
 * guest saw a mobile bottom drawer. About already used the in-flow sidebar at large widths;
 * every other type must share that same stage, and the stage must honour the saved mode.
 *
 * Classes, not computed layout: jsdom has no viewport. `md:` is the desktop cutoff so a typical
 * laptop window is not treated as a phone. The shell is a full-screen flex box: `items-end` on
 * phones, `md:items-center` for popup, `md:static` for the in-flow sidebar. Never `inset-x-0
 * bottom-0` plus a leftover `right: 0`, which kept desktop panels looking like drawers.
 */

function data(mode: string) {
    return {
        displayName: "Ada Lovelace",
        headline: "Mathematician",
        bio: "First programmer.",
        contentDisplayMode: mode,
        workExperiences: [],
        projects: [],
        serviceOfferings: [],
    }
}

function stage() {
    return document.querySelector("[data-content-stage]")
}

describe("ContentPanel - owner display mode", () => {
    it("SIDE_PANEL uses the in-flow sidebar on desktop, not a bottom drawer", () => {
        render(
            <ContentPanel
                isOpen
                onClose={() => {}}
                type="about"
                data={data("SIDE_PANEL")}
            />,
        )
        const node = stage()
        expect(node).toBeTruthy()
        expect(node?.getAttribute("data-desktop-surface")).toBe("sidebar")
        expect(node?.className, "phone still docks to the bottom").toMatch(/\bitems-end\b/)
        expect(node?.className, "desktop sidebar must sit in the page, not over it").toMatch(/\bmd:static\b/)
        expect(node?.className).not.toMatch(/\blg:hidden\b/)
    })

    it("POPUP centres on desktop instead of sticking to the bottom", () => {
        render(
            <ContentPanel
                isOpen
                onClose={() => {}}
                type="about"
                data={data("POPUP")}
            />,
        )
        const node = stage()
        expect(node?.getAttribute("data-desktop-surface")).toBe("popup")
        expect(node?.className).toMatch(/\bitems-end\b/)
        expect(node?.className, "desktop popup is flex-centred, not a bottom sheet").toMatch(/\bmd:items-center\b/)
        expect(node?.className).not.toMatch(/\bmd:static\b/)
        expect(node?.className).not.toMatch(/\binset-x-0\b/)
    })

    it("services, projects, and about share the same desktop surface", () => {
        const { rerender } = render(
            <ContentPanel isOpen onClose={() => {}} type="about" data={data("SIDE_PANEL")} />,
        )
        const about = stage()?.getAttribute("data-desktop-surface")
        expect(about).toBe("sidebar")

        rerender(<ContentPanel isOpen onClose={() => {}} type="services" data={data("SIDE_PANEL")} />)
        expect(stage()?.getAttribute("data-desktop-surface")).toBe(about)
        expect(screen.getByText("Services & Pricing")).toBeTruthy()

        rerender(<ContentPanel isOpen onClose={() => {}} type="projects" data={data("SIDE_PANEL")} />)
        expect(stage()?.getAttribute("data-desktop-surface")).toBe(about)
        expect(screen.getByText("Projects")).toBeTruthy()
    })

    it("hides the dimmed backdrop on desktop when the owner chose the side panel", () => {
        render(
            <ContentPanel
                isOpen
                onClose={() => {}}
                type="about"
                data={data("SIDE_PANEL")}
            />,
        )
        const backdrop = document.querySelector("[data-content-backdrop]")
        expect(backdrop?.className).toMatch(/\bmd:hidden\b/)
    })

    it("keeps the popup backdrop on desktop so the chat stays dimmed", () => {
        render(
            <ContentPanel
                isOpen
                onClose={() => {}}
                type="about"
                data={data("POPUP")}
            />,
        )
        const backdrop = document.querySelector("[data-content-backdrop]")
        expect(backdrop?.className).not.toMatch(/\bmd:hidden\b/)
    })

    it("does not render a stage when closed", () => {
        render(
            <ContentPanel
                isOpen={false}
                onClose={() => {}}
                type="about"
                data={data("SIDE_PANEL")}
            />,
        )
        expect(stage()).toBeNull()
    })
})
