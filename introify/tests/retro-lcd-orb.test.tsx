import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RetroLcdOrb } from "@/components/retro-lcd-orb"
import { LCD_CIRCLE_PATH, lcdEyes } from "@/lib/bloub/lcd"

describe("Retro LCD bot", () => {
    it("renders the same circle and exactly two eyes at small and large sizes", () => {
        const { container } = render(<>
            <RetroLcdOrb size={32} gaze={{ x: 0, y: 0 }} lid="none" expression="centre" still />
            <RetroLcdOrb size={168} gaze={{ x: 0, y: 0 }} lid="none" expression="centre" still />
        </>)
        const bots = container.querySelectorAll("svg")
        expect(bots).toHaveLength(2)
        for (const bot of bots) {
            expect(bot.querySelector(".retro-lcd-ink")?.getAttribute("d")).toBe(LCD_CIRCLE_PATH)
            expect(bot.querySelectorAll("[data-lcd-eye]")).toHaveLength(2)
        }
        const patternIds = [...container.querySelectorAll("pattern")].map(node => node.id)
        expect(new Set(patternIds).size).toBe(2)
    })

    it("blinks one eye independently and keeps the original circle intact", () => {
        const open = lcdEyes()
        const wink = lcdEyes({ lid: "wink-left" })
        expect(wink[0]).not.toBe(open[0])
        expect(wink[1]).toBe(open[1])
        expect(lcdEyes({ lid: "blink" })[1]).not.toBe(open[1])
        expect(lcdEyes({ gaze: { x: 100, y: -100 } })).toEqual(lcdEyes({ gaze: { x: 1, y: -1 } }))
    })

    it("keeps picker previews still while preserving the chosen expression", () => {
        const { container, rerender } = render(<RetroLcdOrb size={44} gaze={{ x: 0, y: 0 }} lid="none" expression="curieux" still />)
        const paths = [...container.querySelectorAll("[data-lcd-eye]")].map(n => n.getAttribute("d"))
        rerender(<RetroLcdOrb size={44} gaze={{ x: 1, y: -1 }} lid="blink" expression="curieux" still />)
        expect([...container.querySelectorAll("[data-lcd-eye]")].map(n => n.getAttribute("d"))).toEqual(paths)
        expect(paths[0]).not.toBe(paths[1])
    })

    it("gives every available LCD mood a distinct expression", () => {
        const poses = ["centre", "heureux", "attentif", "curieux", "surpris", "timide"].map(expression => lcdEyes({ expression }).join("|"))
        expect(new Set(poses).size).toBe(poses.length)
    })

    it("selects the LCD renderer from the saved theme, including a legacy look", async () => {
        vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
        const { WelcomeOrb } = await import("@/components/welcome-orb")
        const { container } = render(<WelcomeOrb look="glass" theme="retro-lcd" still />)
        expect(container.querySelector(".retro-lcd-orb")).not.toBeNull()
        expect(container.querySelector(".pl-orb-core")).toBeNull()
        expect(container.querySelector(".pl-orb-aura")).toBeNull()
        vi.unstubAllGlobals()
    })

    it("stops movement immediately when reduced motion is enabled while mounted", async () => {
        let reduced = false
        let notify: (() => void) | undefined
        vi.stubGlobal("matchMedia", vi.fn(() => ({
            get matches() { return reduced },
            addEventListener: (_event: string, listener: () => void) => { notify = listener },
            removeEventListener: vi.fn(),
        })))
        const { WelcomeOrb } = await import("@/components/welcome-orb")
        const { container } = render(<WelcomeOrb theme="retro-lcd" aura="pulse" />)
        expect(container.querySelector(".retro-lcd-orb")?.getAttribute("data-still")).toBe("false")
        act(() => { reduced = true; notify?.() })
        expect(container.querySelector(".retro-lcd-orb")?.getAttribute("data-still")).toBe("true")
        vi.unstubAllGlobals()
    })
})
