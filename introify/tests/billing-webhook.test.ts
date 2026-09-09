// @vitest-environment node
import Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), process: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { billingProviderEvent: { upsert: mocks.upsert } } }))
vi.mock("@/lib/billing/stripe-platform", () => ({ platformStripe: () => new Stripe("sk_test_local_fixture_only"), processBillingEvent: mocks.process }))
import { POST } from "@/app/api/billing/webhook/route"

const secret = "whsec_local_fixture_for_signature_testing"
const stripe = new Stripe("sk_test_local_fixture_only")
function request(livemode = false, header?: string) {
    const body = JSON.stringify({ id: "evt_billing_fixture", object: "event", type: "invoice.paid", livemode, created: Math.floor(Date.now() / 1000), data: { object: { id: "in_fixture" } } })
    const signature = header || stripe.webhooks.generateTestHeaderString({ payload: body, secret })
    return new Request("https://introify.com/api/billing/webhook", { method: "POST", headers: { "stripe-signature": signature }, body })
}
beforeEach(() => {
    vi.stubEnv("INTROIFY_STRIPE_WEBHOOK_SECRET", secret)
    vi.stubEnv("INTROIFY_BILLING_MODE", "test")
    vi.stubEnv("NODE_ENV", "test")
    mocks.upsert.mockReset().mockResolvedValue({})
    mocks.process.mockReset().mockResolvedValue(undefined)
})
describe("platform billing webhook authentication and durable acknowledgement", () => {
    it("rejects unsigned or forged events before any database write", async () => {
        expect((await POST(request(false, "t=1,v1=forged"))).status).toBe(400)
        expect(mocks.upsert).not.toHaveBeenCalled()
        expect(mocks.process).not.toHaveBeenCalled()
    })
    it("rejects signed events from another Stripe environment", async () => {
        expect((await POST(request(true))).status).toBe(400)
        expect(mocks.upsert).not.toHaveBeenCalled()
    })
    it("does not fulfill test-mode payments in production", async () => {
        vi.stubEnv("NODE_ENV", "production")
        expect((await POST(request(false))).status).toBe(400)
        expect(mocks.upsert).not.toHaveBeenCalled()
    })
    it("stores a verified event by stable environment-scoped id before processing", async () => {
        expect((await POST(request())).status).toBe(200)
        expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "stripe:test:evt_billing_fixture" }, update: {} }))
        expect(mocks.process).toHaveBeenCalledWith("stripe:test:evt_billing_fixture")
        expect(mocks.upsert.mock.invocationCallOrder[0]).toBeLessThan(mocks.process.mock.invocationCallOrder[0])
    })
    it("returns retryable status after a reconciliation failure instead of claiming success", async () => {
        mocks.process.mockRejectedValueOnce(new Error("database unavailable"))
        expect((await POST(request())).status).toBe(503)
        expect((await POST(request())).status).toBe(200)
        expect(mocks.upsert.mock.calls[0][0].where).toEqual(mocks.upsert.mock.calls[1][0].where)
    })
    it("does not acknowledge an event that was never persisted", async () => {
        mocks.upsert.mockRejectedValue(new Error("storage unavailable"))
        expect((await POST(request())).status).toBe(503)
        expect(mocks.process).not.toHaveBeenCalled()
    })
})
