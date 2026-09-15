import { describe, expect, it } from "vitest"
import { renderToString } from "react-dom/server"

describe("workspace hire checkout gate", () => {
    it("names the billing lock instead of calling hire a later phase", async () => {
        const { default: CheckoutPage } = await import("@/app/workspace/checkout/page")
        const html = renderToString(CheckoutPage())
        expect(html).toMatch(/Paid jobs are not open yet/)
        expect(html).not.toMatch(/later Introify phase/i)
        expect(html).toMatch(/workspace\/earnings/)
    })
})
