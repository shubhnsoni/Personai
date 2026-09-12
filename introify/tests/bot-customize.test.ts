// @vitest-environment node
import { describe, expect, it } from "vitest"
import { CUSTOMIZER_BOTS, BLOB_COLOR_STOPS, BLOB_SHAPES, blobColorFromIndex, blobColorIndex, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS, BLOUB_THEMES, DEFAULT_BLOUB_PICK, lookThemesFor, clampOrbForPlan, customizerBotPick, usesAnimojiFaces } from "@/lib/bloub/catalog"
import { assistantPendingPhrase, typingInputGaze } from "@/lib/chat-gaze"
import { ANIMOJI_FACES, animojiClipForMood, resolveAnimojiId } from "@/lib/animoji"

describe("customise bots", () => {
    it("shows Blob, Animoji, 8-Bit, CRT and Spark plus named bots and never Neo", () => {
        expect(CUSTOMIZER_BOTS.map((bot) => bot.label)).toEqual(["Blob", "Glow", "Animoji", "8-Bit", "CRT", "Spark"])
        expect(INCLUDED_BLOUB_BOTS.map((bot) => bot.label)).toEqual(["LCD"])
        expect(PREMIUM_BLOUB_BOTS.map((bot) => bot.label)).toEqual(["Azure", "Nova", "Telly", "Aurum", "Doodle", "Pearl", "Nyx", "Ion", "Vex"])
        expect(BLOB_SHAPES.map((item) => item.label)).toEqual(["Circle", "Sol", "Lux", "Sky", "Dew"])
        expect(PREMIUM_BLOUB_BOTS.some((bot) => bot.label === "Neo")).toBe(false)
    })

    it("treats aqua forest ember violet sunrise ice as one blob colour ramp", () => {
        expect(BLOB_COLOR_STOPS.map((stop) => stop.id)).toEqual(["aqua", "forest", "ember", "violet", "sunrise", "ice"])
        expect(blobColorFromIndex(0).id).toBe("aqua")
        expect(blobColorIndex("ember")).toBe(2)
    })

    it("names look palettes as chat themes without selling copy", () => {
        expect(BLOUB_THEMES.map((theme) => theme.label)).toEqual(["Classic", "Retro LCD", "Azure", "Rose", "Sage", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Space", "Comic", "Retro TV", "Solid Gold", "Pencil Sketch", "Glass Bubble", "Astral Nebula", "Hologram", "Liquid Chrome"])
        for (const theme of BLOUB_THEMES) {
            expect(theme.description).toBe("")
        }
        expect(lookThemesFor(DEFAULT_BLOUB_PICK).map((theme) => theme.id)).toEqual(["classic"])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, look: "pixel", skin: "crt" })).toEqual([])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, look: "animoji", skin: "sun" })).toEqual([])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, look: "glass" })).toEqual([])
        expect(lookThemesFor({ ...DEFAULT_BLOUB_PICK, theme: "astral-nebula" }).map((theme) => theme.id)).toEqual(["astral-nebula"])
    })
})

describe("blob gaze while typing", () => {
    it("looks straight ahead when the composer is idle", () => {
        expect(typingInputGaze(0, false)).toBeNull()
    })

    it("keeps pending chat copy as full phrases that dwell for seconds", () => {
        expect(assistantPendingPhrase("SkyDine", 0)).toBe("thinking this through carefully")
        expect(assistantPendingPhrase("SkyDine", 5199)).toBe("thinking this through carefully")
        expect(assistantPendingPhrase("SkyDine", 5200)).toBe("reading your message in full")
        expect(assistantPendingPhrase("SkyDine", 20800)).toMatch(/SkyDine/)
        expect(assistantPendingPhrase("SkyDine", 0).split(" ").length).toBeGreaterThan(3)
    })

    it("looks down and tracks left to right as the composer fills", () => {
        const empty = typingInputGaze(0, true)
        const full = typingInputGaze(28, true)
        expect(empty?.y).toBeLessThan(0)
        expect(full?.y).toBeLessThan(0)
        expect(empty!.x).toBeLessThan(full!.x)
    })
})

describe("animoji bot", () => {
    it("ships coded faces and keeps the chosen face through chat mood", () => {
        const animoji = CUSTOMIZER_BOTS.find((bot) => bot.id === "animoji")!
        expect(customizerBotPick(animoji, DEFAULT_BLOUB_PICK)).toMatchObject({ look: "animoji", skin: "bounce" })
        expect(usesAnimojiFaces({ ...DEFAULT_BLOUB_PICK, look: "animoji", skin: "sun" })).toBe(true)
        expect(ANIMOJI_FACES.map((item) => item.id)).toEqual([
            "bounce", "sun", "et", "love", "laugh", "wow", "sleepy", "ghost", "cloud", "coffee", "cry", "money", "angry", "wink", "cool", "star", "moon", "nerd", "shy", "devil", "angel", "cat", "robot", "flower", "fire", "frog", "panda",
        ])
        expect(resolveAnimojiId("laugh")).toBe("laugh")
        expect(resolveAnimojiId("wow")).toBe("wow")
        expect(resolveAnimojiId("pacman")).toBe("bounce")
        expect(clampOrbForPlan({ look: "animoji", skin: "wow" }, false)).toMatchObject({ look: "animoji", skin: "wow" })
        expect(clampOrbForPlan({ look: "animoji", skin: "et" }, false)).toMatchObject({ look: "animoji", skin: "et" })
        expect(animojiClipForMood("sun", "idle")).toBe("sun")
        expect(animojiClipForMood("sun", "thinking")).toBe("sun")
        expect(animojiClipForMood("sun", "speaking")).toBe("sun")
        expect(animojiClipForMood("et", "listening")).toBe("et")
        expect(animojiClipForMood("bounce", "greeting")).toBe("bounce")
    })
})
