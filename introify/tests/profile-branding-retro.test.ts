// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { lookupEntitlement } = vi.hoisted(() => ({ lookupEntitlement: vi.fn() }))
vi.mock("@/lib/billing/entitlements", () => ({ lookupProfileEntitlement: lookupEntitlement }))

import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"

beforeEach(() => {
    lookupEntitlement.mockReset()
    lookupEntitlement.mockResolvedValue({ features: { customBranding: false } })
})

describe("public Retro LCD branding", () => {
    it("reads the saved bot on nested public routes while retaining the preset's other settings", () => {
        expect(configuredProfileAnimation({
            animationStyle: { config: '{"variant":"ember","speed":0.8,"theme":"classic"}' },
            personalityConfig: '{"orb":{"theme":"retro-lcd","expression":"heureux"}}',
        })).toEqual({ variant: "ember", speed: 0.8, theme: "retro-lcd", expression: "heureux" })
    })

    it("recovers a saved bot from a malformed preset and ignores invalid personality bags", () => {
        expect(configuredProfileAnimation({
            animationStyle: { config: "broken" }, personalityConfig: '{"orb":{"theme":"retro-lcd"}}',
        })).toEqual({ theme: "retro-lcd" })
        expect(configuredProfileAnimation({
            animationStyle: { config: { variant: "ember" } }, personalityConfig: "null",
        })).toEqual({ variant: "ember" })
        expect(configuredProfileAnimation({ animationStyle: { config: "[]" }, personalityConfig: '{"orb":[]}' }))
            .toEqual({})
    })

    it("preserves the included LCD bot on Free while clamping an older premium shape", async () => {
        expect(await publicAnimationConfig("page", {
            theme: "retro-lcd", look: "glass", shape: "nuage", expression: "heureux", color: "violet",
        })).toMatchObject({ theme: "retro-lcd", look: "bloub", shape: "cercle", expression: "heureux" })
    })

    it("uses the same round renderer when a paid account's saved animation preset has no look", async () => {
        lookupEntitlement.mockResolvedValue({ features: { customBranding: true } })
        expect(await publicAnimationConfig("page", {
            theme: "retro-lcd", variant: "ember", speed: 0.8,
        })).toEqual({ theme: "retro-lcd", look: "bloub", shape: "cercle", variant: "ember", speed: 0.8 })
    })

    it("keeps LCD through a billing outage while other paid presentation still fails closed", async () => {
        lookupEntitlement.mockRejectedValue(new Error("unavailable"))
        const config = await publicAnimationConfig("page", {
            theme: "retro-lcd", variant: "ember", look: "glass", shape: "hexagone", intensity: 5,
        })
        expect(config).toMatchObject({ theme: "retro-lcd", look: "bloub", shape: "cercle", intensity: 1 })
        expect(config.variant).toBeUndefined()
    })

    it("normalizes an unknown theme and leaves existing paid presets without a theme unchanged", async () => {
        lookupEntitlement.mockResolvedValue({ features: { customBranding: true } })
        expect(await publicAnimationConfig("page", { theme: "unknown", look: "glass" }))
            .toEqual({ theme: "classic", look: "glass" })
        expect(await publicAnimationConfig("page", { variant: "ember" })).toEqual({ variant: "ember" })
    })
})
