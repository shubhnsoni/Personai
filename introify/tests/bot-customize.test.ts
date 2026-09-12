// @vitest-environment node
import { describe, expect, it } from "vitest"
import { CUSTOMIZER_BOTS, BLOB_COLOR_STOPS, BLOB_SHAPES, blobColorFromIndex, blobColorIndex, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS, BLOUB_THEMES, DEFAULT_BLOUB_PICK, lookThemesFor } from "@/lib/bloub/catalog"
import { typingInputGaze } from "@/lib/chat-gaze"

describe("customise bots", () => {
    it("shows Blob, 8-Bit, CRT and Spark plus named bots and never Neo", () => {
        expect(CUSTOMIZER_BOTS.map((bot) => bot.label)).toEqual(["Blob", "8-Bit", "CRT", "Spark"])
        expect(INCLUDED_BLOUB_BOTS.map((bot) => bot.label)).toEqual(["LCD"])
        expect(PREMIUM_BLOUB_BOTS.map((bot) => bot.label)).toEqual(["Nyx", "Ion", "Vex"])
        expect(BLOB_SHAPES.map((item) => item.label)).toEqual(["Circle", "Sol", "Lux", "Sky", "Dew"])
        expect(PREMIUM_BLOUB_BOTS.some((bot) => bot.label === "Neo")).toBe(false)
    })

    it("treats aqua forest ember violet sunrise ice as one blob colour ramp", () => {
        expect(BLOB_COLOR_STOPS.map((stop) => stop.id)).toEqual(["aqua", "forest", "ember", "violet", "sunrise", "ice"])
        expect(blobColorFromIndex(0).id).toBe("aqua")
        expect(blobColorIndex("ember")).toBe(2)
    })

    it("names look palettes as chat themes without selling copy", () => {
        expect(BLOUB_THEMES.map((theme) => theme.label)).toEqual(["Classic", "Retro LCD", "Astral Nebula", "Holographic HUD", "Liquid Chrome"])
        for (const theme of BLOUB_THEMES) {
            expect(theme.description).toBe("")
        }
        expect(lookThemesFor(DEFAULT_BLOUB_PICK).map((theme) => theme.id)).toEqual(["classic"])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, look: "pixel", skin: "crt" })).toEqual([])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, theme: "astral-nebula" }).map((theme) => theme.id)).toEqual(["astral-nebula"])
    })
})

describe("blob gaze while typing", () => {
    it("looks straight ahead when the composer is idle", () => {
        expect(typingInputGaze(0, false)).toBeNull()
    })

    it("looks down and tracks left to right as the composer fills", () => {
        const empty = typingInputGaze(0, true)
        const full = typingInputGaze(28, true)
        expect(empty?.y).toBeLessThan(0)
        expect(full?.y).toBeLessThan(0)
        expect(empty!.x).toBeLessThan(full!.x)
    })
})
