import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { PlanetOrb, isPlanetOrbVariant } from "@/components/planet-orb"

describe("PlanetOrb", () => {
    it("keeps gradient references separate when several planets appear together", () => {
        const { container } = render(<><PlanetOrb size={200} /><PlanetOrb size={200} variant="planet-rose" /><PlanetOrb size={200} variant="planet-sage" /></>)
        const ids = Array.from(container.querySelectorAll("[id]"), element => element.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(container.querySelectorAll(".planet-eye")).toHaveLength(6)
        for (const element of container.querySelectorAll("[fill],[stroke],[clip-path],[filter]")) {
            for (const attribute of ["fill", "stroke", "clip-path", "filter"]) {
                const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1]
                if (reference) expect(ids).toContain(reference)
            }
        }
    })

    it("honors eye expressions, still previews and exact frozen timing", () => {
        const { container, rerender } = render(<PlanetOrb size={200} lid="wink-left" frozenAt={1.25} speed={2} />)
        expect(container.querySelector<SVGGElement>('[data-eye="0"]')?.style.transform).toBe("scale(1, .09)")
        expect(container.querySelector<SVGGElement>('[data-eye="1"]')?.style.transform).toBe("scale(1)")
        const svg = container.querySelector("svg")!
        expect(svg.dataset.frozen).toBe("true")
        expect(svg.style.getPropertyValue("--planet-delay")).toBe("-1.25s")
        expect(svg.style.getPropertyValue("--planet-unit")).toBe("0.5s")
        rerender(<PlanetOrb size={32} lid="blink" still speed={NaN} />)
        expect(svg.dataset.still).toBe("true")
        expect(svg.style.getPropertyValue("--planet-unit")).toBe("1s")
        expect(container.querySelector<SVGGElement>('[data-eye="0"]')?.style.transform).toBe("scale(1)")
        expect(container.querySelector("feTurbulence")).toBeNull()
    })

    it("identifies only supported planet IDs", () => {
        for (const id of ["planet-azure", "planet-rose", "planet-sage", "planet-mercury", "planet-venus", "planet-earth", "planet-mars", "planet-jupiter", "planet-saturn", "planet-uranus", "planet-neptune", "planet-pluto"]) {
            expect(isPlanetOrbVariant(id), id).toBe(true)
        }
        expect(isPlanetOrbVariant("planet-unknown")).toBe(false)
        expect(isPlanetOrbVariant("constructor")).toBe(false)
        expect(isPlanetOrbVariant(undefined)).toBe(false)
    })

    it("gives each solar planet its own surface while keeping the shared face", () => {
        const SOLAR = ["planet-mercury", "planet-venus", "planet-earth", "planet-mars", "planet-jupiter", "planet-saturn", "planet-uranus", "planet-neptune", "planet-pluto"] as const
        const { container } = render(<>{SOLAR.map((variant) => <PlanetOrb key={variant} size={200} variant={variant} />)}</>)
        const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(container.querySelectorAll(".planet-eye")).toHaveLength(SOLAR.length * 2)
        for (const element of container.querySelectorAll("[fill],[stroke],[clip-path],[filter]")) {
            for (const attribute of ["fill", "stroke", "clip-path", "filter"]) {
                const reference = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1]
                if (reference) expect(ids).toContain(reference)
            }
        }
        const surfaces = new Set(Array.from(container.querySelectorAll("svg"), (svg) => svg.querySelector('[clip-path]')!.innerHTML.replace(/planet-[^"]*-/g, "")))
        expect(surfaces.size).toBe(SOLAR.length)
        expect(container.querySelector(".planet-orb--planet-saturn [data-ring=\"front\"]")).not.toBeNull()
        expect(container.querySelector(".planet-orb--planet-saturn [data-ring=\"back\"]")).not.toBeNull()
        expect(container.querySelector(".planet-orb--planet-mars .planet-ring")).toBeNull()
        expect(container.querySelector(".planet-orb--planet-mercury .planet-clouds")).toBeNull()
        expect(container.querySelector(".planet-orb--planet-jupiter .planet-clouds")).not.toBeNull()
    })

    it("renders all six saved expressions distinctly even without animation", () => {
        const { container, rerender } = render(<PlanetOrb size={160} still />)
        const faces = new Set<string>()
        for (const expression of ["centre", "heureux", "attentif", "curieux", "surpris", "timide"]) {
            rerender(<PlanetOrb size={160} expression={expression} still />)
            faces.add(container.querySelector(".planet-face")!.innerHTML)
            expect(container.querySelector("svg")?.dataset.expression).toBe(expression)
        }
        expect(faces.size).toBe(6)
        expect(container.querySelector(".planet-cheeks")).not.toBeNull()

        rerender(<PlanetOrb size={160} expression="heureux" still />)
        expect(container.querySelectorAll(".planet-eye-smile")).toHaveLength(2)
        rerender(<PlanetOrb size={160} expression="attentif" still />)
        expect(container.querySelector<SVGGElement>('[data-eye="0"]')?.style.transform).toBe("scale(1.04, 1.22)")
        rerender(<PlanetOrb size={160} expression="surpris" still />)
        expect(container.querySelector(".planet-mouth")?.getAttribute("fill")).not.toBe("none")
    })

    it("retains resolved faces through runtime moods and opens its mouth while speaking", () => {
        const { container, rerender } = render(<PlanetOrb size={160} />)
        const faces = [
            ["idle", "timide"], ["greeting", "heureux"], ["listening", "attentif"],
            ["thinking", "curieux"], ["speaking", "centre"], ["success", "heureux"], ["error", "triste"],
        ]
        for (const [mood, expression] of faces) {
            rerender(<PlanetOrb size={160} mood={mood} expression={expression} frozenAt={1.25} />)
            expect(container.querySelector("svg")?.dataset.mood).toBe(mood)
            expect(container.querySelector("svg")?.dataset.expression).toBe(expression)
            expect(container.querySelector("svg")?.dataset.frozen).toBe("true")
            if (mood === "speaking") expect(container.querySelector(".planet-mouth")?.getAttribute("fill")).not.toBe("none")
        }
        expect(container.querySelector(".planet-mouth")?.getAttribute("d")).toBe("M154 168 Q161 161 168 168")
        expect(container.querySelectorAll(".planet-brows path")).toHaveLength(2)
    })
})
