import { describe, expect, it } from "vitest"
import {
    K22_BPS,
    boardMoved,
    gramsToMg,
    metalPaise,
    rupeesPerGramToPaisePer10g,
    ticketPaise,
} from "@/lib/metal/math"

const MUMBAI = {
    k24PaisePer10g: rupeesPerGramToPaisePer10g(15535),
    k22PaisePer10g: rupeesPerGramToPaisePer10g(14240),
    k18PaisePer10g: rupeesPerGramToPaisePer10g(11651),
}

describe("gold math", () => {
    it("stores ₹/g as paise per 10 g", () => {
        expect(MUMBAI.k22PaisePer10g).toBe(14_240_000)
        expect(MUMBAI.k24PaisePer10g).toBe(15_535_000)
    })

    it("prices 10 g of 22K on the city 22K board", () => {
        expect(metalPaise(gramsToMg(10), K22_BPS, MUMBAI)).toBe(14_240_000)
    })

    it("adds making on top of metal", () => {
        expect(
            ticketPaise({ grossMg: gramsToMg(10), purityBps: K22_BPS, makingPaise: 50_000 }, MUMBAI),
        ).toBe(14_290_000)
    })

    it("scales a 8.5 g 22K piece", () => {
        expect(metalPaise(gramsToMg(8.5), K22_BPS, MUMBAI)).toBe(12_104_000)
    })

    it("nudges only when 22K moved ₹200 / 10 g", () => {
        expect(boardMoved(MUMBAI, { ...MUMBAI, k22PaisePer10g: MUMBAI.k22PaisePer10g + 19_999 })).toBe(false)
        expect(boardMoved(MUMBAI, { ...MUMBAI, k22PaisePer10g: MUMBAI.k22PaisePer10g + 20_000 })).toBe(true)
    })
})
