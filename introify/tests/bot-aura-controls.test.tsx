import { useState, type ComponentProps } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WelcomeOrb } from "@/components/welcome-orb"
import { BloubCustomizerSheet } from "@/components/dashboard/bloub-customizer-sheet"
import { BLOUB_AURAS, BLOUB_MOODS, CUSTOMIZER_BOTS, DEFAULT_BLOUB_PICK, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS, bloubBotPick, clampOrbForPlan, customizerBotPick, parseOrbBag, writeOrbBag, type BloubPick } from "@/lib/bloub/catalog"
import { validateAiSettings } from "@/lib/ai-settings"

const { entitlement } = vi.hoisted(() => ({ entitlement: vi.fn() }))
vi.mock("@/lib/billing/entitlements", () => ({ lookupProfileEntitlement: entitlement }))
import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"

const renderers: { name: string; props: ComponentProps<typeof WelcomeOrb>; selector: string }[] = [
    { name: "Blob", props: { look: "bloub" }, selector: "svg[data-expression]" },
    { name: "Glow", props: { look: "glass" }, selector: ".pl-orb-core" },
    { name: "Animoji", props: { look: "animoji", skin: "sun" }, selector: ".animoji-face" },
    { name: "8-Bit", props: { look: "pixel", skin: "bit" }, selector: ".pl-pix.is-bit" },
    { name: "CRT", props: { look: "pixel", skin: "crt" }, selector: ".pl-pix.is-crt" },
    { name: "Spark", props: { look: "pixel", skin: "spark" }, selector: ".pl-pix.is-spark" },
    { name: "LCD", props: { theme: "retro-lcd" }, selector: ".retro-lcd-orb" },
    { name: "Nyx", props: { theme: "astral-nebula" }, selector: ".pt-orb--astral-nebula" },
    { name: "Ion", props: { theme: "holographic-hud" }, selector: ".pt-orb--holographic-hud" },
    { name: "Vex", props: { theme: "liquid-chrome" }, selector: ".pt-orb--liquid-chrome" },
    { name: "Azure", props: { theme: "planet-azure" }, selector: ".planet-orb--planet-azure" },
    { name: "Rose", props: { theme: "planet-rose" }, selector: ".planet-orb--planet-rose" },
    { name: "Sage", props: { theme: "planet-sage" }, selector: ".planet-orb--planet-sage" },
    { name: "Nova Space", props: { theme: "cosmic-space" }, selector: ".cosmic-orb--cosmic-space" },
    { name: "Nova Comic", props: { theme: "cosmic-comic" }, selector: ".cosmic-orb--cosmic-comic" },
]

let reduced = false
let frameId = 0
const motionListeners = new Set<() => void>()
const pendingFrames = new Set<number>()

beforeEach(() => {
    reduced = false
    frameId = 0
    motionListeners.clear()
    pendingFrames.clear()
    vi.stubGlobal("matchMedia", vi.fn(() => ({
        get matches() { return reduced },
        addEventListener: (_event: string, listener: () => void) => motionListeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => motionListeners.delete(listener),
    })))
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => { pendingFrames.add(++frameId); return frameId }))
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => pendingFrames.delete(id)))
    entitlement.mockReset()
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe("shared aura across every bot renderer", () => {
    it.each(renderers)("applies Pulse, Breathe and Aura off to $name without duplicate aura layers", ({ props, selector }) => {
        const { container, rerender } = render(<WelcomeOrb {...props} aura="pulse" frozenAt={1.75} speed={2} />)
        expect(container.querySelector(selector)).not.toBeNull()
        for (const aura of ["pulse", "breathe"] as const) {
            rerender(<WelcomeOrb {...props} aura={aura} frozenAt={1.75} speed={2} />)
            const layers = container.querySelectorAll<HTMLElement>(".bot-aura")
            expect(layers).toHaveLength(1)
            expect(layers[0].querySelectorAll(".bot-aura-ring")).toHaveLength(3)
            expect(container.querySelector(".bot-aura-glow,.planet-atmosphere,.cosmic-atmosphere,.pl-orb-shadow")).toBeNull()
            expect(layers[0].dataset.aura).toBe(aura)
            expect(layers[0].dataset.paused).toBe("true")
            expect(layers[0].style.getPropertyValue("--bot-aura-time")).toBe("-1.75s")
            expect(layers[0].style.getPropertyValue("--bot-aura-duration")).toBe(aura === "pulse" ? "1.2s" : "2.4s")
            expect(container.querySelectorAll(".pl-orb-aura,.pl-pix-aura")).toHaveLength(0)
        }
        rerender(<WelcomeOrb {...props} aura="still" frozenAt={1.75} />)
        expect(container.querySelector(".bot-aura")).toBeNull()
        expect(container.querySelector<HTMLElement>(".pl-orb-scene")?.dataset.aura).toBe("still")
        expect(container.querySelector(selector)).not.toBeNull()
        expect(pendingFrames.size).toBe(0)

        rerender(<WelcomeOrb {...props} aura="breathe" still />)
        expect(container.querySelector<HTMLElement>(".bot-aura")?.dataset.paused).toBe("true")
        expect(pendingFrames.size).toBe(0)
    })

    it("stops all running bots when reduced motion changes and releases subscriptions and frames", () => {
        const { container, unmount } = render(<>{renderers.map(({ name, props }) => <WelcomeOrb key={name} {...props} aura="pulse" />)}</>)
        expect(container.querySelectorAll('.bot-aura[data-paused="false"]')).toHaveLength(renderers.length)
        expect(pendingFrames.size).toBeGreaterThan(0)
        act(() => {
            reduced = true
            for (const notify of motionListeners) notify()
        })
        expect(container.querySelectorAll('.bot-aura[data-paused="true"]')).toHaveLength(renderers.length)
        expect(container.querySelectorAll('.pl-orb-scene[data-motion-paused="true"]')).toHaveLength(renderers.length)
        expect(pendingFrames.size).toBe(0)
        unmount()
        expect(motionListeners.size).toBe(0)
        expect(pendingFrames.size).toBe(0)
    })
})

describe("Aura off", () => {
    it("keeps aura disabled when changing bots and saving the resulting settings", () => {
        let selected: BloubPick = { ...DEFAULT_BLOUB_PICK, aura: "still" }
        for (const bot of [...INCLUDED_BLOUB_BOTS, ...PREMIUM_BLOUB_BOTS]) {
            const pick = bloubBotPick(bot, selected)
            expect(pick.aura, bot.label).toBe("still")
            selected = { ...selected, ...pick }
        }
        for (const bot of CUSTOMIZER_BOTS) {
            const next = { ...selected, ...customizerBotPick(bot, selected) }
            expect(next.aura, bot.label).toBe("still")
        }
        const saved = validateAiSettings("free", { personalityConfig: writeOrbBag("{}", selected) }).personalityConfig
        expect(parseOrbBag(saved).aura).toBe("still")
        expect(configuredProfileAnimation({ personalityConfig: saved }).aura).toBe("still")
    })

    it("offers a selected Aura off action in the dashboard while keeping the bot visible", () => {
        function OwnerControls() {
            const [value, setValue] = useState(DEFAULT_BLOUB_PICK)
            return <BloubCustomizerSheet open onClose={vi.fn()} value={value} onChange={patch => setValue(current => ({ ...current, ...patch }))} />
        }
        render(<OwnerControls />)
        fireEvent.click(screen.getByRole("tab", { name: "Mood" }))
        const off = screen.getByRole("button", { name: "Aura off" })
        expect(off.getAttribute("aria-pressed")).toBe("false")
        fireEvent.click(off)
        expect(off.getAttribute("aria-pressed")).toBe("true")
        expect(document.querySelector(".bot-aura")).toBeNull()
        expect(document.querySelector(".pl-orb-scene")).not.toBeNull()
    })
})

describe("Animoji aura persistence", () => {
    it.each(BLOUB_AURAS)("keeps $label through selection, saving, plan clamping and public output", async ({ id: aura }) => {
        const chosen = { ...DEFAULT_BLOUB_PICK, look: "animoji" as const, skin: "sun" as const, expression: "curieux" as const, aura }
        const animoji = CUSTOMIZER_BOTS.find(bot => bot.id === "animoji")!
        expect(customizerBotPick(animoji, chosen).aura).toBe(aura)
        for (const premium of [false, true]) {
            expect(clampOrbForPlan(chosen, premium)).toMatchObject({ look: "animoji", skin: "sun", expression: "curieux", aura })
            const personalityConfig = writeOrbBag('{"socials":{"website":"https://example.test"}}', chosen, premium)
            expect(parseOrbBag(personalityConfig)).toMatchObject({ look: "animoji", skin: "sun", expression: "curieux", aura })
            expect(JSON.parse(personalityConfig).socials.website).toBe("https://example.test")
            const configured = configuredProfileAnimation({ personalityConfig })
            entitlement.mockResolvedValue({ features: { customBranding: premium } })
            expect(await publicAnimationConfig("animoji-profile", configured)).toMatchObject({ look: "animoji", skin: "sun", expression: "curieux", aura })
            entitlement.mockRejectedValue(new Error("billing unavailable"))
            expect(await publicAnimationConfig("animoji-profile", configured)).toMatchObject({ look: "animoji", skin: "sun", expression: "curieux", aura })
        }
    })
})

describe("owner Animoji controls", () => {
    it("exposes all six moods and three aura actions and forwards each selection", () => {
        const onChange = vi.fn()
        render(<BloubCustomizerSheet open onClose={vi.fn()} onChange={onChange} value={{ ...DEFAULT_BLOUB_PICK, look: "animoji", skin: "sun", aura: "breathe" }} />)
        fireEvent.click(screen.getByRole("tab", { name: "Mood" }))
        const moodSection = screen.getByText("Mood", { selector: "p" }).closest("section")!
        const auraSection = screen.getByText("Aura", { selector: "p" }).closest("section")!
        expect(within(moodSection).getAllByRole("button")).toHaveLength(6)
        for (const { id, label } of BLOUB_MOODS) {
            fireEvent.click(within(moodSection).getByRole("button", { name: label }))
            expect(onChange).toHaveBeenLastCalledWith({ expression: id })
        }
        expect(within(auraSection).getAllByRole("button")).toHaveLength(3)
        for (const { id, label } of BLOUB_AURAS) {
            fireEvent.click(within(auraSection).getByRole("button", { name: label }))
            expect(onChange).toHaveBeenLastCalledWith({ aura: id })
        }
        expect(moodSection.querySelectorAll(".animoji-face")).toHaveLength(6)
    })
})
