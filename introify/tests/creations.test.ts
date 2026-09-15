import { describe, expect, it } from "vitest"
import {
    instructionsFromAnswers,
    isCreationVisibility,
    isPubliclyReachable,
    knowledgeFromUpload,
    nextCreationAccess,
    publicCreationPath,
    visitorChatEnabled,
} from "@/lib/creations"

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
        expect(isCreationVisibility("UNLISTED")).toBe(true)
        expect(isCreationVisibility("FOR_HIRE")).toBe(false)
    })

    it("lets Unlisted and Showcase share a link; Private never does", () => {
        expect(isPubliclyReachable("UNLISTED")).toBe(true)
        expect(isPubliclyReachable("SHOWCASE")).toBe(true)
        expect(isPubliclyReachable("PRIVATE")).toBe(false)
        expect(publicCreationPath("neal", "ani")).toBe("/neal/ai/ani")
    })

    it("allows visitor chat on Unlisted and Showcase, never on Private", () => {
        expect(visitorChatEnabled("UNLISTED", true)).toBe(true)
        expect(visitorChatEnabled("SHOWCASE", true)).toBe(true)
        expect(visitorChatEnabled("PRIVATE", true)).toBe(false)
        expect(nextCreationAccess({ visibility: "PRIVATE", allowVisitorChat: false }, { visibility: "UNLISTED", allowVisitorChat: true })).toEqual({
            visibility: "UNLISTED",
            allowVisitorChat: true,
        })
        expect(nextCreationAccess({ visibility: "SHOWCASE", allowVisitorChat: true }, { visibility: "PRIVATE" })).toEqual({
            visibility: "PRIVATE",
            allowVisitorChat: false,
        })
    })

    it("turns a readable text file into a knowledge note", () => {
        expect(knowledgeFromUpload("brand-voice.md", "  Quiet, premium, no bounce.  ")).toEqual({
            title: "brand-voice",
            rawText: "Quiet, premium, no bounce.",
        })
        expect(() => knowledgeFromUpload("empty.txt", "   hi   ")).toThrow(/readable text/i)
    })
})
