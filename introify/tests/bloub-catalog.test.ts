// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    DEFAULT_BLOUB_PICK,
    clampOrbForPlan,
    gradientForColor,
    parseOrbBag,
    writeOrbBag,
} from "@/lib/bloub/catalog"

describe("blob look bag", () => {
    it("defaults to a centred circle with one pulse aura", () => {
        expect(DEFAULT_BLOUB_PICK).toEqual({
            shape: "cercle",
            expression: "centre",
            color: "blanc",
            aura: "pulse",
        })
        expect(parseOrbBag(null)).toEqual(DEFAULT_BLOUB_PICK)
    })

    it("locks premium shapes on Free and keeps colour, mood and aura", () => {
        expect(clampOrbForPlan({
            shape: "galet",
            expression: "heureux",
            color: "rouge",
            aura: "breathe",
        }, false)).toEqual({
            shape: "cercle",
            expression: "heureux",
            color: "rouge",
            aura: "breathe",
        })
        expect(clampOrbForPlan({ shape: "galet", color: "bleu" }, true).shape).toBe("galet")
    })

    it("builds one gradient from the chosen colour instead of a preset list", () => {
        const [bright, deep] = gradientForColor("turquoise")
        expect(bright).toMatch(/^#/)
        expect(deep).toMatch(/^#/)
        expect(bright).not.toBe(deep)
    })

    it("round-trips aura with the rest of the bag", () => {
        const json = writeOrbBag("{}", { color: "bleu", aura: "breathe", expression: "curieux" })
        expect(parseOrbBag(json)).toMatchObject({
            shape: "cercle",
            color: "bleu",
            aura: "breathe",
            expression: "curieux",
        })
    })
})
