import { describe, expect, it } from "vitest"
import { instructionsFromAnswers, isCreationVisibility } from "@/lib/creations"

describe("workspace creations", () => {
    it("turns outcome answers into instructions without model knobs", () => {
        const text = instructionsFromAnswers({
            name: "ANI",
            goodAt: "logo motion directions",
            process: "I start from the mark, then three premium paths",
            input: "a logo file",
            output: "three motion directions",
        })
        expect(text).toMatch(/ANI/)
        expect(text).toMatch(/logo motion/)
        expect(text).not.toMatch(/temperature|token limit|embedding/i)
    })

    it("keeps For Hire out of Phase 1 visibility", () => {
        expect(isCreationVisibility("PRIVATE")).toBe(true)
        expect(isCreationVisibility("SHOWCASE")).toBe(true)
        expect(isCreationVisibility("FOR_HIRE")).toBe(false)
    })
})
