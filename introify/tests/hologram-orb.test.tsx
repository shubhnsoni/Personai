import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PremiumThemeOrb } from "@/components/premium-theme-orb"

const base = { variant: "holographic-hud" as const, size: 240, gaze: { x: 0, y: 0 }, lid: "none" as const, expression: "heureux" }

describe("floating hologram bot", () => {
    it("keeps the saved variant compatible and renders a floating globe without a projector base", () => {
        const { container } = render(<PremiumThemeOrb {...base} />)
        expect(container.querySelector(".pt-orb--holographic-hud")).not.toBeNull()
        expect(container.querySelectorAll("[data-hologram-eye]")).toHaveLength(2)
        expect(container.querySelector(".pt-holo-mouth")).not.toBeNull()
        expect(container.querySelector(".pt-holo-grid")).not.toBeNull()
        expect(container.querySelector(".pt-holo-projector, .pt-holo-source")).toBeNull()
        expect(container.querySelector(".pt-hud-rings, .pt-hud-readout, .pt-hud-scan")).toBeNull()
        expect(container.textContent).not.toContain("AI.CORE")
    })

    it("preserves all six chosen expressions in still previews and supports a speaking mouth", () => {
        const { container, rerender } = render(<PremiumThemeOrb {...base} still />)
        const poses = ["centre", "heureux", "attentif", "curieux", "surpris", "timide"].map(expression => {
            rerender(<PremiumThemeOrb {...base} expression={expression} still />)
            return Array.from(container.querySelectorAll("[data-hologram-eye], .pt-holo-mouth"), node => node.getAttribute("d")).join("|")
        })
        expect(new Set(poses).size).toBe(6)
        rerender(<PremiumThemeOrb {...base} mood="speaking" />)
        expect(container.querySelector(".pt-holo-mouth")?.getAttribute("d")).toMatch(/Z$/)
    })

    it("winks independently and ignores live gaze and lids when frozen", () => {
        const { container, rerender } = render(<PremiumThemeOrb {...base} />)
        const paths = () => Array.from(container.querySelectorAll("[data-hologram-eye]"), node => node.getAttribute("d"))
        const open = paths()
        rerender(<PremiumThemeOrb {...base} lid="wink-left" />)
        expect(paths()[0]).not.toBe(open[0])
        expect(paths()[1]).toBe(open[1])
        rerender(<PremiumThemeOrb {...base} gaze={{ x: 1, y: 1 }} lid="blink" still />)
        expect(paths()).toEqual(open)
        expect(container.querySelector<SVGGElement>(".pt-orb-eyes")?.style.transform).toBe("translate(0px, 0px)")
        expect(container.querySelector("svg")?.dataset.still).toBe("true")
    })

    it("isolates glass and glow references across several mounted bots", () => {
        const { container } = render(<><PremiumThemeOrb {...base} /><PremiumThemeOrb {...base} /></>)
        const ids = Array.from(container.querySelectorAll("[id]"), node => node.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const node of container.querySelectorAll("[fill], [filter], [clip-path]")) {
            for (const attribute of ["fill", "filter", "clip-path"]) {
                const id = node.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1]
                if (id) expect(ids).toContain(id)
            }
        }
    })
})
