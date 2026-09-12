import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { CosmicOrb, isCosmicOrbVariant } from "@/components/cosmic-orb"

describe("CosmicOrb", () => {
    it("renders one star-eyed identity in Space and Comic, with isolated SVG definitions", () => {
        const { container } = render(<><CosmicOrb size={200} /><CosmicOrb size={200} variant="cosmic-comic" /></>)
        const ids = Array.from(container.querySelectorAll("[id]"), element => element.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(container.querySelectorAll(".cosmic-eye")).toHaveLength(4)
        expect(container.querySelectorAll(".cosmic-eye-rays")).toHaveLength(4)
        expect(container.querySelector(".cosmic-mouth")).toBeNull()
        const shapes = Array.from(container.querySelectorAll(".cosmic-silhouette"), path => path.getAttribute("d"))
        expect(shapes[0]).toBe(shapes[1])
        expect(container.querySelectorAll(".cosmic-ink-accents")).toHaveLength(1)
        for (const element of container.querySelectorAll("[fill],[stroke],[clip-path],[filter]")) {
            for (const attribute of ["fill", "stroke", "clip-path", "filter"]) {
                const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1]
                if (reference) expect(ids).toContain(reference)
            }
        }
    })

    it("keeps all six saved expressions distinct in still thumbnails", () => {
        const { container, rerender } = render(<CosmicOrb size={160} still />)
        const poses = new Set<string>()
        for (const expression of ["centre", "heureux", "attentif", "curieux", "surpris", "timide"]) {
            rerender(<CosmicOrb size={160} expression={expression} still />)
            poses.add(container.querySelector(".cosmic-face")!.innerHTML)
            expect(container.querySelector("svg")!.dataset.expression).toBe(expression)
        }
        expect(poses.size).toBe(6)
        expect(container.querySelectorAll(".cosmic-eye")).toHaveLength(2)
    })

    it("uses live mood expressions while preserving the saved face on idle", () => {
        const { container, rerender } = render(<CosmicOrb size={160} />)
        for (const [mood, expression] of [
            ["idle", "timide"], ["greeting", "excite"], ["listening", "attentif"],
            ["thinking", "confus"], ["speaking", "curieux"], ["success", "heureux"], ["error", "triste"],
        ]) {
            rerender(<CosmicOrb size={160} expression="timide" mood={mood} />)
            expect(container.querySelector("svg")!.dataset.mood).toBe(mood)
            expect(container.querySelector("svg")!.dataset.expression).toBe(expression)
        }
    })

    it("honors exact frozen timing, speed, intensity, gaze and eyelids", () => {
        const { container, rerender } = render(<CosmicOrb size={200} speed={2} intensity={.5} frozenAt={1.25} lid="wink-left" gaze={{ x: 1, y: -1 }} />)
        const svg = container.querySelector("svg")!
        expect(svg.dataset.frozen).toBe("true")
        expect(svg.style.getPropertyValue("--cosmic-delay")).toBe("-1.25s")
        expect(svg.style.getPropertyValue("--cosmic-unit")).toBe("0.5s")
        expect(svg.style.getPropertyValue("--cosmic-lift")).toBe("-1.25px")
        expect(container.querySelector(".cosmic-gaze")?.getAttribute("transform")).toBe("translate(5 4)")
        expect(container.querySelector<SVGGElement>('[data-eye="0"]')?.style.transform).toBe("scale(1, .08)")
        expect(container.querySelector<SVGGElement>('[data-eye="1"]')?.style.transform).toBe("scale(1)")
        rerender(<CosmicOrb size={32} speed={NaN} intensity={NaN} gaze={{ x: NaN, y: Infinity }} still lid="blink" />)
        expect(svg.dataset.still).toBe("true")
        expect(svg.dataset.detail).toBe("false")
        expect(svg.style.getPropertyValue("--cosmic-unit")).toBe("1s")
        expect(container.querySelector(".cosmic-gaze")?.getAttribute("transform")).toBe("translate(0 0)")
        expect(container.querySelector<SVGGElement>('[data-eye="0"]')?.style.transform).toBe("scale(1)")
        expect(container.querySelector("feTurbulence")).toBeNull()
        expect(container.querySelectorAll(".cosmic-eye")).toHaveLength(2)
    })

    it("recognizes only the two Nova theme variants", () => {
        expect(isCosmicOrbVariant("cosmic-space")).toBe(true)
        expect(isCosmicOrbVariant("cosmic-comic")).toBe(true)
        expect(isCosmicOrbVariant("astral-nebula")).toBe(false)
        expect(isCosmicOrbVariant(undefined)).toBe(false)
    })
})
