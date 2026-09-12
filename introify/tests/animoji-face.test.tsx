import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { installMatchMedia } from "./helpers/match-media"
import { AnimojiFace } from "@/components/animoji-face"
import { ANIMOJI_FRAME_COUNT, animojiStripSrc, animojiStripValues } from "@/lib/animoji"

describe("coded animoji faces", () => {
    it("plays the full exported frame strip inside svg, and freezes on the first cell when still", () => {
        installMatchMedia()
        expect(ANIMOJI_FRAME_COUNT).toBe(46)
        expect(animojiStripValues().split(";")).toHaveLength(46)
        expect(animojiStripSrc("bounce")).toBe("/bots/animoji/coded/bounce.webp")

        const live = render(<AnimojiFace id="sun" size={64} />)
        expect(live.container.querySelector("svg")).toBeTruthy()
        expect(live.container.querySelector("img")).toBeNull()
        expect(live.container.querySelector("[data-animoji='sun']")).toBeTruthy()
        expect(live.container.querySelector("[data-animoji-frames='46']")).toBeTruthy()
        expect(live.container.querySelector("image")?.getAttribute("href")).toBe("/bots/animoji/coded/sun.webp")
        expect(live.container.querySelector(".animoji-strip")).toBeTruthy()
        live.unmount()

        const frozen = render(<AnimojiFace id="et" size={64} still />)
        expect(frozen.container.querySelector("[data-still]")).toBeTruthy()
        expect(frozen.container.querySelector("image")?.getAttribute("href")).toBe("/bots/animoji/et.png")
        expect(frozen.container.querySelector(".animoji-strip")).toBeNull()
        frozen.unmount()
    })
})
