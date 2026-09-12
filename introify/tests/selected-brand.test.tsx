import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SelectedBrand } from "@/components/brand/selected-brand"

let intersect: (entries: Partial<IntersectionObserverEntry>[]) => void
let reduced = false
const enter = (visible: boolean) => act(() => intersect([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]))
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
    vi.useFakeTimers()
    reduced = false
    vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced }, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    vi.stubGlobal("IntersectionObserver", class {
        constructor(callback: typeof intersect) { intersect = callback }
        observe() {}
        disconnect() {}
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => '<svg xmlns="http://www.w3.org/2000/svg" />' }))
    let number = 0
    URL.createObjectURL = vi.fn(() => `blob:logo-${++number}`)
    URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.useRealTimers())

describe("approved site logo playback", () => {
    it("keeps the static logo when browser animation APIs are unavailable", () => {
        vi.stubGlobal("matchMedia", undefined)
        vi.stubGlobal("IntersectionObserver", undefined)
        const { container } = render(<SelectedBrand />)
        expect(container.querySelector("svg")?.getAttribute("data-brand-playing")).toBe("false")
        expect(container.querySelector('image[href$="light-still.svg"]')).not.toBeNull()
    })
    it("waits for the footer to enter, plays one loop, rests, and replays only after reentry", async () => {
        const { container } = render(<SelectedBrand />)
        const logo = container.querySelector("svg")!
        expect(logo.getAttribute("data-brand-option")).toBe("9")
        expect(logo.getAttribute("data-brand-playing")).toBe("false")
        expect(fetch).not.toHaveBeenCalled()
        enter(true)
        await settle()
        expect(logo.getAttribute("data-brand-playing")).toBe("true")
        fireEvent.load(container.querySelector('image[href^="blob:"]')!)
        act(() => vi.advanceTimersByTime(3193))
        expect(logo.getAttribute("data-brand-playing")).toBe("true")
        act(() => vi.advanceTimersByTime(1))
        expect(logo.getAttribute("data-brand-playing")).toBe("false")
        enter(true)
        await settle()
        expect(logo.getAttribute("data-brand-playing")).toBe("false")
        enter(false)
        enter(true)
        await settle()
        expect(logo.getAttribute("data-brand-playing")).toBe("true")
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    })

    it("keeps a readable static logo with reduced motion", async () => {
        reduced = true
        const { container } = render(<SelectedBrand />)
        enter(true)
        await settle()
        expect(container.querySelector("svg")?.getAttribute("data-brand-playing")).toBe("false")
        expect(container.querySelector('image[href$="light-still.svg"]')).not.toBeNull()
        expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it("releases animation resources when unmounted during playback", async () => {
        const { container, unmount } = render(<SelectedBrand />)
        enter(true)
        await settle()
        fireEvent.load(container.querySelector('image[href^="blob:"]')!)
        unmount()
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
        expect(vi.getTimerCount()).toBe(0)
    })
})
