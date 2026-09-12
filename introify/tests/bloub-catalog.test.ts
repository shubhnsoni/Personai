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
            theme: "classic",
        })
        expect(parseOrbBag(null)).toEqual(DEFAULT_BLOUB_PICK)
    })

    it("includes Zen and Sol on Free and locks other bots", () => {
        expect(clampOrbForPlan({
            shape: "galet",
            expression: "heureux",
            color: "rouge",
            aura: "breathe",
        }, false)).toEqual({
            shape: "galet",
            expression: "heureux",
            color: "rouge",
            aura: "breathe",
            theme: "classic",
        })
        expect(clampOrbForPlan({
            shape: "nuage",
            expression: "excite",
            color: "bleu",
            aura: "still",
        }, false).shape).toBe("cercle")
        expect(clampOrbForPlan({ shape: "nuage", color: "bleu" }, true).shape).toBe("nuage")
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

    it("keeps Retro LCD on Free and round-trips it without losing other profile settings", () => {
        const saved = writeOrbBag('{"customInstructions":"Be concise","socials":{"instagram":"https://instagram.com/studio"}}', {
            theme: "retro-lcd", shape: "galet", expression: "curieux", color: "rose", aura: "breathe",
        }, false)
        expect(parseOrbBag(saved)).toEqual({
            theme: "retro-lcd", shape: "cercle", expression: "curieux", color: "rose", aura: "breathe",
        })
        expect(JSON.parse(saved)).toMatchObject({ customInstructions: "Be concise", socials: { instagram: "https://instagram.com/studio" } })
        expect(parseOrbBag(writeOrbBag(saved, { theme: "classic" }, false))).toMatchObject({
            theme: "classic", color: "rose", expression: "curieux", aura: "breathe",
        })
    })

    it("defaults legacy or unsupported themes to Classic", () => {
        expect(parseOrbBag('{"orb":{"shape":"galet","color":"turquoise"}}')).toMatchObject({ theme: "classic", shape: "galet", color: "turquoise" })
        expect(parseOrbBag('{"orb":{"theme":"untrusted-theme","shape":"cercle"}}')).toMatchObject({ theme: "classic", shape: "cercle" })
        expect(parseOrbBag("broken JSON")).toEqual(DEFAULT_BLOUB_PICK)
        expect(clampOrbForPlan({ theme: "retro-lcd", shape: "nuage" }, true).shape).toBe("cercle")
        for (const malformed of ["null", "[]", '"old value"', "broken JSON"]) {
            expect(parseOrbBag(writeOrbBag(malformed, { theme: "retro-lcd" }, false))).toMatchObject({ theme: "retro-lcd", shape: "cercle" })
        }
    })
})
