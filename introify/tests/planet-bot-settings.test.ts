// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

const { entitlement } = vi.hoisted(() => ({ entitlement: vi.fn() }))
vi.mock("@/lib/billing/entitlements", () => ({ lookupProfileEntitlement: entitlement }))

import {
    CUSTOMIZER_BOTS, DEFAULT_BLOUB_PICK, INCLUDED_BLOUB_BOTS, PLANET_THEMES, PREMIUM_BLOUB_BOTS,
    bloubBotPick, clampOrbForPlan, customizerBotPick, isPremiumBloubTheme, parseOrbBag, writeOrbBag, isNamedBloubBotSelected, lookThemesFor,
} from "@/lib/bloub/catalog"
import { validateAiSettings } from "@/lib/ai-settings"
import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"

describe("planet bots and orbiting profile settings", () => {
    it("keeps every planet as a Premium look of Azure and preserves the exact saved choice when entitled", () => {
        const bot = PREMIUM_BLOUB_BOTS.find(item => item.label === "Azure")!
        expect(bot).toBeDefined()
        expect(INCLUDED_BLOUB_BOTS.map(item => item.label)).toEqual(["LCD"])
        for (const theme of PLANET_THEMES) {
            const current = { ...DEFAULT_BLOUB_PICK, theme }
            expect(isNamedBloubBotSelected(bot, current)).toBe(true)
            expect(isPremiumBloubTheme(theme)).toBe(true)
            expect(lookThemesFor(current)).toEqual([])
            const saved = writeOrbBag('{"socials":{"website":"https://example.test"}}', {
                ...bloubBotPick(bot, current), orbitProfile: true,
            }, true)
            expect(parseOrbBag(saved)).toMatchObject({ theme, shape: "cercle", look: "bloub", orbitProfile: true })
            expect(JSON.parse(saved).socials).toEqual({ website: "https://example.test" })
            // Free plans fall back to the Classic blob but keep the rest of the choice.
            expect(clampOrbForPlan({ theme, expression: "timide", orbitProfile: true }, false)).toMatchObject({ theme: "classic", expression: "timide", orbitProfile: true })
        }
    })

    it("retains orbit when switching between every included bot family", () => {
        const current = { ...DEFAULT_BLOUB_PICK, orbitProfile: true }
        for (const bot of CUSTOMIZER_BOTS.filter(item => !item.premium)) {
            expect(parseOrbBag(writeOrbBag("{}", { ...current, ...customizerBotPick(bot, current) }, false)).orbitProfile).toBe(true)
        }
        for (const bot of [...INCLUDED_BLOUB_BOTS, ...PREMIUM_BLOUB_BOTS]) {
            expect(parseOrbBag(writeOrbBag("{}", { ...current, ...bloubBotPick(bot) }, false)).orbitProfile).toBe(true)
        }
    })

    it("accepts only an explicit boolean and preserves it through server validation on every plan", () => {
        for (const malformed of [undefined, null, 1, "true", {}, []]) {
            expect(clampOrbForPlan({ orbitProfile: malformed }, true).orbitProfile).toBe(false)
        }
        for (const plan of ["free", "starter", "pro", "business", "scale"] as const) {
            const saved = validateAiSettings(plan, { personalityConfig: '{"orb":{"theme":"planet-azure","orbitProfile":true}}' })
            expect(JSON.parse(saved.personalityConfig!).orb).toMatchObject({ orbitProfile: true })
        }
    })

    it("shows the planet publicly only while entitled and falls back to Classic on Free or a billing outage", async () => {
        const configured = configuredProfileAnimation({
            animationStyle: { config: '{"theme":"classic","look":"glass"}' },
            personalityConfig: '{"orb":{"theme":"planet-sage","orbitProfile":true}}',
        })
        entitlement.mockResolvedValue({ features: { customBranding: true } })
        expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "planet-sage", look: "bloub", orbitProfile: true })
        entitlement.mockResolvedValue({ features: { customBranding: false } })
        expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "classic", look: "bloub" })
        entitlement.mockRejectedValue(new Error("temporarily unavailable"))
        expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "classic" })
    })
})
