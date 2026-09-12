import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"

const route = vi.hoisted(() => ({ pathname: "/custom" }))
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }))
const { PublicBusinessFrame } = await import("@/components/profile/public-business-frame")

function installViewport(height = 780, scale = 1, innerHeight = 780) {
    const dimensions = { height, scale }
    const viewport = new EventTarget()
    Object.defineProperties(viewport, {
        height: { get: () => dimensions.height },
        scale: { get: () => dimensions.scale },
    })
    const add = vi.spyOn(viewport, "addEventListener")
    const remove = vi.spyOn(viewport, "removeEventListener")
    vi.stubGlobal("visualViewport", viewport)
    vi.stubGlobal("innerHeight", innerHeight)
    return { dimensions, viewport, add, remove }
}

const contents = () => (
    <PublicBusinessFrame profilePath="/custom" theme="retro-lcd">
        <main>Conversation</main>
        <footer>Made with Introify</footer>
    </PublicBusinessFrame>
)

beforeEach(() => { route.pathname = "/custom" })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("Public business viewport boundary", () => {
    it("constrains only the profile route and releases the shell when opening a catalogue", () => {
        const { add, remove } = installViewport()
        route.pathname = "/custom/"
        const { container, rerender } = render(contents())
        const frame = container.firstElementChild as HTMLElement
        expect(frame.hasAttribute("data-profile-viewport")).toBe(true)
        expect(frame.className).toMatch(/\bbg-profile\b/)
        expect(frame.style.height).toBe("780px")
        expect(frame.querySelector("main")).not.toBeNull()
        expect(frame.querySelector("footer")).not.toBeNull()

        route.pathname = "/custom/shop"
        rerender(contents())
        expect(frame.hasAttribute("data-profile-viewport")).toBe(false)
        expect(frame.style.height).toBe("")
        expect(frame.className).toMatch(/\bbg-profile\b/)
        expect(frame.className).not.toMatch(/\bh-dvh\b/)
        expect(remove).toHaveBeenCalledWith("resize", add.mock.calls[0][1])
        expect(frame.getAttribute("data-public-business-theme")).toBe("retro-lcd")
    })

    it("updates height for mobile keyboard and window resizing while ignoring pinch zoom", () => {
        const { dimensions, viewport } = installViewport(780.4)
        const { container } = render(contents())
        const frame = container.firstElementChild as HTMLElement
        expect(frame.style.height).toBe("780px")
        dimensions.height = 410.6
        act(() => { viewport.dispatchEvent(new Event("resize")) })
        expect(frame.style.height).toBe("411px")
        expect(frame.hasAttribute("data-keyboard")).toBe(true)

        dimensions.scale = 1.5
        dimensions.height = 250
        act(() => { viewport.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("resize")) })
        expect(frame.style.height).toBe("411px")
        expect(frame.hasAttribute("data-keyboard")).toBe(false)

        dimensions.scale = 1
        dimensions.height = 410
        act(() => { viewport.dispatchEvent(new Event("resize")) })
        expect(frame.hasAttribute("data-keyboard")).toBe(true)

        dimensions.scale = 1
        dimensions.height = 700
        act(() => { window.dispatchEvent(new Event("resize")) })
        expect(frame.style.height).toBe("700px")
        expect(frame.hasAttribute("data-keyboard")).toBe(false)
    })

    it("marks the frame when the software keyboard has stolen the visual viewport", () => {
        const { dimensions, viewport } = installViewport(780)
        const { container } = render(contents())
        const frame = container.firstElementChild as HTMLElement
        expect(frame.hasAttribute("data-keyboard")).toBe(false)

        dimensions.height = 410
        act(() => { viewport.dispatchEvent(new Event("resize")) })
        expect(frame.hasAttribute("data-keyboard")).toBe(true)
        expect(frame.style.height).toBe("410px")

        dimensions.height = 780
        act(() => { viewport.dispatchEvent(new Event("resize")) })
        expect(frame.hasAttribute("data-keyboard")).toBe(false)
    })

    it("removes both listeners and the measured height on unmount", () => {
        const { dimensions, viewport, add, remove } = installViewport()
        const windowAdd = vi.spyOn(window, "addEventListener")
        const windowRemove = vi.spyOn(window, "removeEventListener")
        const { container, unmount } = render(contents())
        const frame = container.firstElementChild as HTMLElement
        const resize = add.mock.calls.find(([type]) => type === "resize")![1]
        expect(windowAdd).toHaveBeenCalledWith("resize", resize)
        unmount()
        expect(remove).toHaveBeenCalledWith("resize", resize)
        expect(windowRemove).toHaveBeenCalledWith("resize", resize)
        expect(frame.style.height).toBe("")
        dimensions.height = 300
        act(() => { viewport.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("resize")) })
        expect(frame.style.height).toBe("")
    })

    it("leaves catalogues unconstrained and uses CSS sizing when visualViewport is unavailable", () => {
        const { add } = installViewport()
        route.pathname = "/custom/courses/course-one"
        const view = render(contents())
        let frame = view.container.firstElementChild as HTMLElement
        expect(frame.hasAttribute("data-profile-viewport")).toBe(false)
        expect(frame.style.height).toBe("")
        expect(add).not.toHaveBeenCalled()
        view.unmount()

        vi.stubGlobal("visualViewport", undefined)
        route.pathname = "/custom"
        const fallback = render(contents())
        frame = fallback.container.firstElementChild as HTMLElement
        expect(frame.hasAttribute("data-profile-viewport")).toBe(true)
        expect(frame.className).toContain("h-dvh")
        expect(frame.style.height).toBe("")
    })
})
