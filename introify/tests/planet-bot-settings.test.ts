// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

const { entitlement } = vi.hoisted(() => ({ entitlement: vi.fn() }))
vi.mock("@/lib/billing/entitlements", () => ({ lookupProfileEntitlement: entitlement }))

import {
    CUSTOMIZER_BOTS, DEFAULT_BLOUB_PICK, INCLUDED_BLOUB_BOTS, PLANET_THEMES,
    bloubBotPick, clampOrbForPlan, customizerBotPick, parseOrbBag, writeOrbBag, isNamedBloubBotSelected, lookThemesFor,
} from "@/lib/bloub/catalog"
import { validateAiSettings } from "@/lib/ai-settings"
import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"

describe("planet bots and orbiting profile settings", () => {
    it("includes every planet on Free and preserves its exact saved choice", () => {
        for (const theme of PLANET_THEMES) {
            const bot = INCLUDED_BLOUB_BOTS.find(item => item.label === "Azure")!
            const current = { ...DEFAULT_BLOUB_PICK, theme }
            expect(isNamedBloubBotSelected(bot, current)).toBe(true)
            expect(lookThemesFor(current)).toEqual([])
            expect(bot).toBeDefined()
            const saved = writeOrbBag('{"socials":{"website":"https://example.test"}}', {
                ...bloubBotPick(bot, current), orbitProfile: true,
            }, false)
            expect(parseOrbBag(saved)).toMatchObject({ theme, shape: "cercle", look: "bloub", orbitProfile: true })
            expect(JSON.parse(saved).socials).toEqual({ website: "https://example.test" })
        }
    })

    it("retains orbit when switching between every included bot family", () => {
        const current = { ...DEFAULT_BLOUB_PICK, orbitProfile: true }
        for (const bot of CUSTOMIZER_BOTS.filter(item => !item.premium)) {
            expect(parseOrbBag(writeOrbBag("{}", { ...current, ...customizerBotPick(bot, current) }, false)).orbitProfile).toBe(true)
        }
        for (const bot of INCLUDED_BLOUB_BOTS) {
            expect(parseOrbBag(writeOrbBag("{}", { ...current, ...bloubBotPick(bot) }, false)).orbitProfile).toBe(true)
        }
    })

    it("accepts only an explicit boolean and preserves it through server validation on every plan", () => {
        for (const malformed of [undefined, null, 1, "true", {}, []]) {
            expect(clampOrbForPlan({ orbitProfile: malformed }, true).orbitProfile).toBe(false)
        }
        for (const plan of ["free", "starter", "pro", "business", "scale"] as const) {
            const saved = validateAiSettings(plan, { personalityConfig: '{"orb":{"theme":"planet-azure","orbitProfile":true}}' })
            expect(JSON.parse(saved.personalityConfig!).orb).toMatchObject({ theme: "planet-azure", orbitProfile: true })
        }
    })

    it("keeps the planet and orbit on public routes for Free, paid, and unavailable billing", async () => {
        const configured = configuredProfileAnimation({
            animationStyle: { config: '{"theme":"classic","look":"glass"}' },
            personalityConfig: '{"orb":{"theme":"planet-sage","orbitProfile":true}}',
        })
        for (const paid of [false, true]) {
            entitlement.mockResolvedValue({ features: { customBranding: paid } })
            expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "planet-sage", look: "bloub", orbitProfile: true })
        }
        entitlement.mockRejectedValue(new Error("temporarily unavailable"))
        expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "planet-sage", orbitProfile: true })
    })
})
