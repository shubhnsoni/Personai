// @vitest-environment node
import type Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
import { validatePrice } from "@/lib/billing/stripe-platform"
import { PLAN_VERSION } from "@/lib/billing/catalog"

function price(changes: Record<string, unknown> = {}) {
    return { id: "price_fixture", metadata: { purpose: "introify-platform", planId: "pro", planVersion: PLAN_VERSION, cadence: "yearly" }, currency: "usd", unit_amount: 19000, recurring: { interval: "year", interval_count: 1 }, ...changes } as unknown as Stripe.Price
}
describe("server-owned Stripe catalog", () => {
    it("accepts the exact approved annual price", () => expect(validatePrice(price())).toEqual({ planId: "pro", cadence: "yearly", amountCents: 19000 }))
    it("rejects custom Scale prices from self-serve validation", () => {
        expect(() => validatePrice(price({ metadata: { purpose: "introify-platform", planId: "scale", planVersion: PLAN_VERSION, cadence: "yearly" }, unit_amount: 100000 }))).toThrow(/not available for self-serve checkout/)
    })
    it.each([{ unit_amount: 20 }, { currency: "inr" }, { recurring: { interval: "month", interval_count: 1 } }, { recurring: { interval: "year", interval_count: 2 } }, { metadata: { purpose: "merchant-community", planId: "pro" } }])("rejects price, currency, cadence or product-family mismatches", changed => expect(() => validatePrice(price(changed))).toThrow())
})
