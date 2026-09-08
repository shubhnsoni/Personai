import { act } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProfilePreview } from "@/components/landing/profile-preview"
import { IntroifyGuide } from "@/components/landing/introify-guide"
import { HomeLanding } from "@/components/landing/home-landing"
import { LandingMotion, MotionToggle } from "@/components/landing/brand-motion"
import { BrandOrb } from "@/components/landing/brand-orb"

const motionKey = "introify-landing-motion"

function reducedMotionPreference(initial = false) {
    let reduced = initial
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const query = {
        media: "(prefers-reduced-motion: reduce)",
        get matches() { return reduced },
        addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => listeners.add(callback),
        removeEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => listeners.delete(callback),
    } as unknown as MediaQueryList
    vi.stubGlobal("matchMedia", vi.fn(() => query))
    return {
        listeners,
        change(next: boolean) {
            reduced = next
            act(() => {
                for (const listener of [...listeners]) listener({ matches: next } as MediaQueryListEvent)
            })
        },
    }
}

class IntersectionFixture implements IntersectionObserver {
    static instances: IntersectionFixture[] = []
    readonly root = null
    readonly rootMargin = "0px"
    readonly thresholds = [0]
    readonly targets = new Set<Element>()
    readonly observe = vi.fn((target: Element) => { this.targets.add(target) })
    readonly unobserve = vi.fn((target: Element) => { this.targets.delete(target) })
    readonly disconnect = vi.fn(() => { this.targets.clear() })
    readonly takeRecords = () => []

    constructor(private callback: IntersectionObserverCallback) {
        IntersectionFixture.instances.push(this)
    }

    intersect(target: Element, isIntersecting: boolean) {
        if (!this.targets.has(target)) throw new Error("Element is not observed")
        act(() => this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this))
    }
}

let frames: Map<number, FrameRequestCallback>
let hidden = false

function flushFrames() {
    act(() => {
        const pending = [...frames.values()]
        frames.clear()
        for (const callback of pending) callback(0)
    })
}

function observerFor(target: Element) {
    const observer = IntersectionFixture.instances.find(instance => instance.targets.has(target))
    if (!observer) throw new Error("Expected element to be observed")
    return observer
}

function placeRevealsBelowViewport() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const top = this.hasAttribute("data-reveal") ? window.innerHeight + 80 : 0
        return { x: 0, y: top, top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, toJSON() {} }
    })
}

function MotionScene() {
    return <LandingMotion>
        <MotionToggle />
        <section data-reveal><button type="button">Continue reading</button></section>
        <BrandOrb />
    </LandingMotion>
}

beforeEach(() => {
    localStorage.removeItem(motionKey)
    reducedMotionPreference()
    IntersectionFixture.instances = []
    vi.stubGlobal("IntersectionObserver", IntersectionFixture)
    frames = new Map()
    let nextFrame = 0
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
        frames.set(++nextFrame, callback)
        return nextFrame
    }))
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { frames.delete(id) }))
    hidden = false
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden)
})

afterEach(() => {
    cleanup()
    localStorage.removeItem(motionKey)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe("homepage profile exploration", () => {
    it("switches real panel content and offers a signup link from each section", () => {
        render(<ProfilePreview />)
        const content = ["Everyday objects with a little character.", "Objects for everyday rituals.", "Something worth making time for."]
        for (const [index, tab] of screen.getAllByRole("tab").entries()) {
            fireEvent.click(tab)
            const panel = screen.getByRole("tabpanel")
            expect(panel.textContent).toContain(content[index])
            expect(panel.id).toBe(tab.getAttribute("aria-controls"))
            expect(panel.getAttribute("aria-labelledby")).toBe(tab.id)
            expect(tab.getAttribute("aria-selected")).toBe("true")
            expect(within(panel).getByRole("link").getAttribute("href")).toBe("/sign-up")
        }
    })

    it("supports arrow wrapping and Home/End with one selected keyboard tab", () => {
        render(<ProfilePreview />)
        const tabs = screen.getAllByRole("tab")
        tabs[0].focus()
        for (const [key, index] of [["ArrowLeft", 2], ["ArrowRight", 0], ["End", 2], ["Home", 0], ["ArrowRight", 1]] as const) {
            fireEvent.keyDown(document.activeElement!, { key })
            expect(document.activeElement).toBe(tabs[index])
            expect(tabs[index].getAttribute("aria-selected")).toBe("true")
            expect(tabs.filter(tab => tab.tabIndex === 0)).toEqual([tabs[index]])
            expect(screen.getByRole("tabpanel").id).toBe(tabs[index].getAttribute("aria-controls"))
        }
    })

    it("keeps tab and panel IDs unique across multiple previews", () => {
        const { container } = render(<><ProfilePreview /><ProfilePreview /></>)
        const ids = [...container.querySelectorAll("[id]")].map(element => element.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const tab of screen.getAllByRole("tab")) {
            const panel = document.getElementById(tab.getAttribute("aria-controls")!)!
            expect(panel.getAttribute("aria-labelledby")).toBe(tab.id)
            expect(panel.hidden).toBe(tab.getAttribute("aria-selected") !== "true")
        }
    })
})

describe("Introify product guide", () => {
    it("answers the selected question, announces the reply and makes no network requests", () => {
        const fetch = vi.fn()
        vi.stubGlobal("fetch", fetch)
        const { container } = render(<IntroifyGuide />)
        const group = screen.getByRole("group", { name: "Questions about Introify" })
        const questions = within(group).getAllByRole("button")
        const answers = ["Start with what makes you, you", "set your available slots", "share your QR card in person"]
        const conversation = container.querySelector("[aria-live='polite']")!
        expect(conversation.getAttribute("aria-atomic")).toBe("true")
        for (const [index, question] of questions.entries()) {
            fireEvent.click(question)
            expect(conversation.textContent).toContain(question.textContent)
            expect(conversation.textContent).toContain(answers[index])
            expect(questions.filter(button => button.getAttribute("aria-pressed") === "true")).toEqual([question])
            expect(within(conversation as HTMLElement).getByRole("link").getAttribute("href")).toBe("/sign-up")
        }
        expect(fetch).not.toHaveBeenCalled()
        expect(container.querySelector("form, input, textarea, [contenteditable='true']")).toBeNull()
    })

    it("presents the homepage and shared shell without stale demo or fictional-story labels", () => {
        const { container } = render(<HomeLanding />)
        expect(container.textContent).not.toMatch(/\b(?:fictional|demo|scripted|illustrative)\b/i)
        expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Big things[\s\S]*good intro/)
        expect(screen.getByRole("main").id).toBe("main-content")
    })
})

describe("landing motion preferences and lifecycle", () => {
    it("starts with visible content, respects reduced motion and remembers an explicit pause", () => {
        const preference = reducedMotionPreference(true)
        placeRevealsBelowViewport()
        const { container } = render(<MotionScene />)
        const reveal = container.querySelector("[data-reveal]")!
        const orb = container.querySelector("[data-bm-orb-active]")!
        expect(reveal.hasAttribute("data-bm-reveal")).toBe(false)
        flushFrames()
        observerFor(orb).intersect(orb, true)
        expect(screen.getByRole("button", { name: "Resume animations" })).toBeTruthy()
        expect(orb.getAttribute("data-bm-orb-active")).toBe("false")
        expect(reveal.hasAttribute("data-bm-reveal")).toBe(false)

        preference.change(false)
        expect(screen.getByRole("button", { name: "Pause animations" })).toBeTruthy()
        expect(orb.getAttribute("data-bm-orb-active")).toBe("true")
        fireEvent.click(screen.getByRole("button", { name: "Pause animations" }))
        expect(localStorage.getItem(motionKey)).toBe("off")
        expect(reveal.hasAttribute("data-bm-reveal")).toBe(false)
        preference.change(true)
        preference.change(false)
        expect(orb.getAttribute("data-bm-orb-active")).toBe("false")
        fireEvent.click(screen.getByRole("button", { name: "Resume animations" }))
        expect(localStorage.getItem(motionKey)).toBe("on")
        expect(orb.getAttribute("data-bm-orb-active")).toBe("true")
    })

    it("reveals approaching content and reveals a focused control before it can remain hidden", () => {
        placeRevealsBelowViewport()
        const { container } = render(<LandingMotion><section data-reveal>Further reading</section><section data-reveal><button type="button">Continue reading</button></section></LandingMotion>)
        flushFrames()
        const [scrolled, focused] = container.querySelectorAll("[data-reveal]")
        expect(scrolled.getAttribute("data-bm-reveal")).toBe("waiting")
        const observer = observerFor(scrolled)
        observer.intersect(scrolled, true)
        expect(scrolled.getAttribute("data-bm-reveal")).toBe("visible")
        expect(observer.targets.has(scrolled)).toBe(false)
        act(() => screen.getByRole("button", { name: "Continue reading" }).focus())
        expect(focused.getAttribute("data-bm-reveal")).toBe("visible")
        expect(observer.targets.has(focused)).toBe(false)
    })

    it("runs the orb only while on screen and visible, then releases observers and listeners", () => {
        const preference = reducedMotionPreference()
        const removedWindow = vi.spyOn(window, "removeEventListener")
        const removedDocument = vi.spyOn(document, "removeEventListener")
        const { container, unmount } = render(<MotionScene />)
        flushFrames()
        const orb = container.querySelector("[data-bm-orb-active]")!
        const observer = observerFor(orb)
        expect(orb.getAttribute("data-bm-orb-active")).toBe("false")
        observer.intersect(orb, true)
        expect(orb.getAttribute("data-bm-orb-active")).toBe("true")
        hidden = true
        fireEvent(document, new Event("visibilitychange"))
        expect(orb.getAttribute("data-bm-orb-active")).toBe("false")
        hidden = false
        fireEvent(document, new Event("visibilitychange"))
        expect(orb.getAttribute("data-bm-orb-active")).toBe("true")
        observer.intersect(orb, false)
        expect(orb.getAttribute("data-bm-orb-active")).toBe("false")
        unmount()
        expect(IntersectionFixture.instances.every(instance => instance.disconnect.mock.calls.length > 0)).toBe(true)
        expect(preference.listeners.size).toBe(0)
        expect(removedWindow.mock.calls.some(([type]) => type === "storage")).toBe(true)
        expect(removedDocument.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true)
        expect(frames.size).toBe(0)
    })

    it("keeps a saved pause on remount and cancels unresolved startup frames on unmount", () => {
        localStorage.setItem(motionKey, "off")
        const first = render(<MotionScene />)
        expect(frames.size).toBeGreaterThan(0)
        first.unmount()
        expect(frames.size).toBe(0)
        const second = render(<MotionScene />)
        flushFrames()
        expect(screen.getByRole("button", { name: "Resume animations" })).toBeTruthy()
        expect(second.container.querySelector("[data-bm-motion]")?.getAttribute("data-bm-motion")).toBe("off")
    })

    it("keeps content usable without motion browser APIs and allows an explicit resume", () => {
        vi.stubGlobal("matchMedia", undefined)
        vi.stubGlobal("IntersectionObserver", undefined)
        vi.stubGlobal("requestAnimationFrame", undefined)
        vi.stubGlobal("cancelAnimationFrame", undefined)
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
        const schedule = vi.spyOn(window, "setTimeout")
        const cancel = vi.spyOn(window, "clearTimeout")
        const { container, unmount } = render(<MotionScene />)
        const startupTimers = schedule.mock.results.map(result => result.value)
        expect(startupTimers.length).toBeGreaterThan(0)
        act(() => vi.advanceTimersByTime(0))
        expect(screen.getByRole("button", { name: "Resume animations" })).toBeTruthy()
        expect(container.querySelector("[data-reveal]")?.hasAttribute("data-bm-reveal")).toBe(false)
        fireEvent.click(screen.getByRole("button", { name: "Resume animations" }))
        expect(container.querySelector("[data-bm-orb-active]")?.getAttribute("data-bm-orb-active")).toBe("true")
        unmount()
        for (const timer of startupTimers) expect(cancel).toHaveBeenCalledWith(timer)
    })
})
