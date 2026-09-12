// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

const { entitlement } = vi.hoisted(() => ({ entitlement: vi.fn() }))
vi.mock("@/lib/billing/entitlements", () => ({ lookupProfileEntitlement: entitlement }))

import {
    BLOUB_MOODS, COSMIC_THEMES, DEFAULT_BLOUB_PICK, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS,
    bloubBotPick, clampOrbForPlan, isNamedBloubBotSelected, isPremiumBloubTheme, lookThemesFor,
    parseOrbBag, resolveThemedOrb, writeOrbBag,
} from "@/lib/bloub/catalog"
import { validateAiSettings } from "@/lib/ai-settings"
import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"

describe("Nova and its Space and Comic themes", () => {
    const nova = PREMIUM_BLOUB_BOTS.find((bot) => bot.label === "Nova")!

    it("has one selectable bot with two owned themes and keeps other bots separate", () => {
        expect(nova).toBeDefined()
        const bots = [...INCLUDED_BLOUB_BOTS, ...PREMIUM_BLOUB_BOTS]
        for (const theme of COSMIC_THEMES) {
            const pick = { ...DEFAULT_BLOUB_PICK, ...bloubBotPick(nova), theme }
            expect(bots.filter((bot) => isNamedBloubBotSelected(bot, pick))).toEqual([nova])
            expect(lookThemesFor(pick).map((item) => item.label)).toEqual(["Space", "Comic"])
            expect(resolveThemedOrb(theme)).toBe(theme)
            expect(isPremiumBloubTheme(theme)).toBe(true)
            expect(bloubBotPick(nova, pick).theme).toBe(theme)
        }
        expect(bloubBotPick(nova, DEFAULT_BLOUB_PICK).theme).toBe("cosmic-space")
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, theme: "astral-nebula" }).map((item) => item.id)).toEqual(["astral-nebula"])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, theme: "planet-azure" })).toEqual([])
        expect(isNamedBloubBotSelected(nova, { ...DEFAULT_BLOUB_PICK, theme: "cosmic-space", look: "glass" })).toBe(false)
    })

    it("switches theme without changing the saved mood, aura, photo orbit or unrelated settings", () => {
        for (const expression of BLOUB_MOODS.map((mood) => mood.id)) {
            for (const aura of ["pulse", "breathe", "still"] as const) {
                let saved = writeOrbBag('{"socials":{"website":"https://example.test"}}', {
                    ...bloubBotPick(nova), expression, aura, orbitProfile: true,
                }, true)
                for (const theme of ["cosmic-comic", "cosmic-space"] as const) {
                    saved = writeOrbBag(saved, { theme }, true)
                    expect(parseOrbBag(saved)).toMatchObject({ theme, expression, aura, orbitProfile: true, shape: "cercle", look: "bloub" })
                    expect(JSON.parse(saved).socials).toEqual({ website: "https://example.test" })
                }
            }
        }
    })

    it("keeps both Nova themes for paid plans and returns Free to Classic", () => {
        for (const theme of COSMIC_THEMES) {
            for (const plan of ["starter", "pro", "business", "scale"] as const) {
                const saved = validateAiSettings(plan, {
                    personalityConfig: JSON.stringify({ orb: { theme, expression: "curieux", aura: "pulse", orbitProfile: true } }),
                })
                expect(parseOrbBag(saved.personalityConfig)).toMatchObject({ theme, expression: "curieux", aura: "pulse", orbitProfile: true })
            }
            const free = validateAiSettings("free", { personalityConfig: JSON.stringify({ orb: { theme, expression: "curieux", aura: "pulse", orbitProfile: true } }) })
            expect(parseOrbBag(free.personalityConfig)).toMatchObject({ theme: "classic", expression: "curieux", aura: "pulse", orbitProfile: true })
            expect(clampOrbForPlan({ theme, look: "pixel", skin: "crt", shape: "nuage" }, true)).toMatchObject({ theme, look: "bloub", shape: "cercle" })
            expect(clampOrbForPlan({ theme, look: "pixel", skin: "crt" }, true).skin).toBeUndefined()
        }
        expect(clampOrbForPlan({ theme: "astral-nebula" }, false).theme).toBe("classic")
        expect(clampOrbForPlan({ theme: "cosmic-unknown" }, false).theme).toBe("classic")
    })

    it("uses the saved Nova theme on public pages while entitled, despite legacy presets", async () => {
        for (const theme of COSMIC_THEMES) {
            const configured = configuredProfileAnimation({
                animationStyle: { config: '{"theme":"classic","look":"glass"}' },
                personalityConfig: JSON.stringify({ orb: { theme, expression: "timide", aura: "breathe", orbitProfile: true } }),
            })
            entitlement.mockResolvedValue({ features: { customBranding: true } })
            expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme, look: "bloub", shape: "cercle", expression: "timide", aura: "breathe", orbitProfile: true })
            entitlement.mockResolvedValue({ features: { customBranding: false } })
            expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "classic", expression: "timide", aura: "breathe" })
            entitlement.mockRejectedValue(new Error("temporarily unavailable"))
            expect(await publicAnimationConfig("profile", configured)).toMatchObject({ theme: "classic", expression: "timide" })
        }
    })
})
