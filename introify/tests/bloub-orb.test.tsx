import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { BloubOrb } from "@/components/bloub-orb"
import { contrastInk } from "@/lib/bloub/skins"
import { installMatchMedia, REDUCE_MOTION } from "./helpers/match-media"

describe("BloubOrb faces", () => {
    it("paints a different still face for happy than for calm", () => {
        installMatchMedia({ [REDUCE_MOTION]: true })
        const { rerender, container } = render(<BloubOrb size={80} expression="centre" frozenAt={0.8} />)
        const calm = container.querySelector("svg")?.innerHTML
        rerender(<BloubOrb size={80} expression="heureux" frozenAt={0.8} />)
        const happy = container.querySelector("svg")?.innerHTML
        expect(calm).toBeTruthy()
        expect(happy).toBeTruthy()
        expect(happy).not.toBe(calm)
    })

    it("inverts near-white ink on a light page and near-black ink on a dark page", () => {
        expect(contrastInk("#f7f7f8", "light")).toBe("#0a0a0c")
        expect(contrastInk("#0a0a0c", "dark")).toBe("#f7f7f8")
        expect(contrastInk("#00d7ff", "light")).toBe("#00d7ff")
    })
})
