import { describe, expect, it } from "vitest"
import { gramsToMg, rupeesPerGramToPaisePer10g } from "@/lib/metal/math"
import { fineMg, touchBpsFromPercent, touchPaise } from "@/lib/metal/touch"

const K24 = rupeesPerGramToPaisePer10g(15535)

describe("wholesale touch math", () => {
    it("70 touch on 10 g is 7.00 g fine", () => {
        expect(fineMg(gramsToMg(10), touchBpsFromPercent(70))).toBe(7000)
    })

    it("bills 10 g at 70 touch off 24K ₹15,535/g", () => {
        expect(touchPaise(gramsToMg(10), 7000, K24)).toBe(1_08_74_500)
    })

    it("spread 70 → 74 on 10 g is 0.40 g fine", () => {
        const buy = touchPaise(gramsToMg(10), 7000, K24)
        const sell = touchPaise(gramsToMg(10), 7400, K24)
        expect(sell - buy).toBe(touchPaise(gramsToMg(10), 400, K24))
        expect(fineMg(gramsToMg(10), 7400) - fineMg(gramsToMg(10), 7000)).toBe(400)
    })
})
