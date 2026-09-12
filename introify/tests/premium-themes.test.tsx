import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"
import {
    BLOUB_THEME_META,
    PREMIUM_BLOUB_THEMES,
    bloubThemeThumb,
    clampOrbForPlan,
    isPremiumBloubTheme,
    parseOrbBag,
    resolveBloubTheme,
    resolveThemedOrb,
    writeOrbBag,
} from "@/lib/bloub/catalog"
import { PremiumThemeOrb } from "@/components/premium-theme-orb"
import { WelcomeOrb } from "@/components/welcome-orb"

vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/ada",
}))
vi.mock("framer-motion", async () => await import("./helpers/framer-motion-mock"))

const { ProfileView } = await import("@/components/profile/profile-view")

const PROFILE = {
    id: "p1",
    slug: "ada",
    displayName: "Ada Lovelace",
    headline: "Mathematician",
    bio: "First programmer.",
    welcomeMessageOverride: null,
    contentDisplayMode: "chat",
    workExperiences: [],
    projects: [],
    serviceOfferings: [],
} as unknown as Parameters<typeof ProfileView>[0]["profile"]

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    installMatchMedia({ [REDUCE_MOTION]: true })
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    localStorage.clear()
    window.history.replaceState({}, "", "/ada")
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("premium theme catalog", () => {
    it("resolves the three bespoke themes and keeps unknown ids classic", () => {
        expect(resolveBloubTheme("astral-nebula")).toBe("astral-nebula")
        expect(resolveBloubTheme("holographic-hud")).toBe("holographic-hud")
        expect(resolveBloubTheme("liquid-chrome")).toBe("liquid-chrome")
        expect(resolveBloubTheme("retro-lcd")).toBe("retro-lcd")
        expect(resolveBloubTheme("mystery")).toBe("classic")
        expect(isPremiumBloubTheme("liquid-chrome")).toBe(true)
        expect(isPremiumBloubTheme("retro-lcd")).toBe(false)
        for (const theme of PREMIUM_BLOUB_THEMES) {
            expect(BLOUB_THEME_META[theme]?.canvas.dark).toBeTruthy()
            expect(BLOUB_THEME_META[theme]?.canvas.light).toBeTruthy()
            expect(bloubThemeThumb(theme, "dark").dot).not.toBe(bloubThemeThumb(theme, "dark").bar)
        }
    })

    it("maps bespoke themes to their orb renderer, classic stays blob", () => {
        expect(resolveThemedOrb("astral-nebula")).toBe("astral-nebula")
        expect(resolveThemedOrb("classic")).toBeNull()
    })

    it("forces the round silhouette for themed bots and gates premium themes by plan", () => {
        const rich = clampOrbForPlan({ theme: "liquid-chrome", shape: "nuage" }, true)
        expect(rich.theme).toBe("liquid-chrome")
        expect(rich.shape).toBe("cercle")

        const free = clampOrbForPlan({ theme: "liquid-chrome", shape: "nuage" }, false)
        expect(free.theme).toBe("classic")
        expect(free.shape).toBe("cercle")

        // Retro LCD stays included for free plans.
        const freeRetro = clampOrbForPlan({ theme: "retro-lcd" }, false)
        expect(freeRetro.theme).toBe("retro-lcd")

        // Saved bags round-trip premium themes for entitled editors.
        const bag = writeOrbBag(undefined, { theme: "holographic-hud" }, true)
        expect(parseOrbBag(bag).theme).toBe("holographic-hud")
    })
})

describe("PremiumThemeOrb", () => {
    it("renders each variant with exactly two expressive eyes", () => {
        for (const variant of ["astral-nebula", "holographic-hud", "liquid-chrome"] as const) {
            const { container, unmount } = render(
                <PremiumThemeOrb variant={variant} size={168} gaze={{ x: 0.4, y: -0.2 }} lid="none" expression="attentif" mood="listening" aura="pulse" />,
            )
            expect(container.querySelector(`.pt-orb--${variant}`)).not.toBeNull()
            expect(container.querySelectorAll(".pt-orb-eye")).toHaveLength(2)
            expect(container.querySelector(".pt-orb-eyes")!.getAttribute("style")).toContain("translate")
            unmount()
        }
    })

    it("closes a single eye on wink and respects still mode for gaze", () => {
        const { container } = render(
            <PremiumThemeOrb variant="liquid-chrome" size={120} gaze={{ x: 1, y: 1 }} lid="wink-left" expression="centre" still />,
        )
        expect(container.querySelector(".pt-orb")!.getAttribute("data-still")).toBe("true")
        expect(container.querySelector(".pt-orb-eyes")!.getAttribute("style")).toContain("translate(0px, 0px)")
        expect(container.querySelectorAll(".pt-orb-eye")[0].getAttribute("style")).toContain("scale(1, 0.12)")
        expect(container.querySelectorAll(".pt-orb-eye")[1].getAttribute("style")).not.toContain("scale(1, 0.12)")
    })
})

describe("WelcomeOrb themed dispatch", () => {
    it("renders the premium orb instead of the blob renderer", () => {
        const { container } = render(<WelcomeOrb look="bloub" theme="holographic-hud" aura="pulse" still />)
        expect(container.querySelector(".pt-orb--holographic-hud")).not.toBeNull()
        expect(container.querySelector(".pl-orb")).toBeNull()
        expect(container.querySelector(".pl-orb-aura")).toBeNull()
        expect(container.querySelector(".pl-orb-scene")!.className).toContain("is-premium")
        expect(container.querySelector(".pl-orb-scene")!.getAttribute("data-bot-theme")).toBe("holographic-hud")
    })
})

describe("ProfileView - premium appearance", () => {
    it("forwards the theme through profile and chat surfaces without a classic accent override", () => {
        const { container } = render(<ProfileView profile={PROFILE} animationConfig={{ theme: "astral-nebula", look: "glass" }} colors={["#52E8FF"]} />)
        const profile = container.querySelector<HTMLElement>('[data-public-profile-theme="astral-nebula"]')
        const chat = container.querySelector<HTMLElement>('[data-chat-theme="astral-nebula"]')
        expect(profile).not.toBeNull()
        expect(chat).not.toBeNull()
        expect(profile!.style.getPropertyValue("--pl-aurora")).toBe("")
        expect(chat!.style.getPropertyValue("--chat-accent")).toBe("")
        expect(container.querySelector(".pl-intro-veil")).toBeNull()
        expect(container.querySelector(".pl-orb-aura")).toBeNull()
        expect(container.querySelectorAll(".pt-orb--astral-nebula .pt-orb-eye").length).toBeGreaterThanOrEqual(2)
    })

    it("returns to classic when the theme is removed", () => {
        const { container, rerender } = render(<ProfileView profile={PROFILE} animationConfig={{ theme: "liquid-chrome" }} colors={["#52E8FF"]} />)
        expect(container.querySelector('[data-chat-theme="liquid-chrome"]')).not.toBeNull()
        expect(container.querySelector(".pt-orb--liquid-chrome")).not.toBeNull()
        rerender(<ProfileView profile={PROFILE} animationConfig={{}} colors={["#52E8FF"]} />)
        expect(container.querySelector('[data-chat-theme="classic"]')).not.toBeNull()
        expect(container.querySelector(".pt-orb")).toBeNull()
    })
})
