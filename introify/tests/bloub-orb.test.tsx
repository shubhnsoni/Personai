import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { BloubOrb } from "@/components/bloub-orb"
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
})
