// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import Stripe from "stripe"

const mocks = vi.hoisted(() => ({
    productFind: vi.fn(),
    bookingFind: vi.fn(),
    proofUpsert: vi.fn(),
    blockUpsert: vi.fn(),
    construct: vi.fn(),
    record: vi.fn(async () => {}),
    stamp: vi.fn(async () => {}),
}))

vi.mock("@/lib/prisma", () => ({
    prisma: {
        digitalProduct: { findUnique: mocks.productFind },
        booking: { findUnique: mocks.bookingFind },
        knowledgePaymentProof: { upsert: mocks.proofUpsert },
        knowledgePaymentBlock: { upsert: mocks.blockUpsert },
        productPurchase: { updateMany: vi.fn() },
        courseEnrollment: { updateMany: vi.fn() },
        eventRegistration: { updateMany: vi.fn() },
        communityMember: { updateMany: vi.fn() },
        booking2: {},
    },
}))
vi.mock("@/lib/stripe", () => ({
    getUncachableStripeClient: vi.fn(async () => ({ webhooks: { constructEvent: mocks.construct } })),
    requireStripeWebhookSecret: vi.fn(() => "whsec_test"),
}))
vi.mock("@/lib/members", () => ({ normalizeEmail: (e: string) => e.trim().toLowerCase() }))

import { recordKnowledgePaymentEvent } from "@/lib/knowledge-payments"
import { WebhookHandlers } from "@/lib/webhook-handlers"
import { prisma } from "@/lib/prisma"

const db = prisma as never

function event(type: string, object: Record<string, unknown>, account?: string): Stripe.Event {
    return { id: "evt_1", type, account, data: { object } } as unknown as Stripe.Event
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.productFind.mockResolvedValue({ id: "prod-1", profileId: "prof-1" })
    mocks.bookingFind.mockResolvedValue({ profileId: "prof-1", serviceOfferingId: "svc-1" })
})

describe("recordKnowledgePaymentEvent", () => {
    it("stores a product proof only for a paid session with intent and email", async () => {
        await recordKnowledgePaymentEvent(event("checkout.session.completed", {
            id: "cs_1", payment_status: "paid", payment_intent: "pi_1",
            customer_details: { email: "Buyer@Example.com" },
            metadata: { itemType: "product", itemId: "prod-1" },
        }), db)
        expect(mocks.proofUpsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { stripeAccountId_checkoutSessionId: { stripeAccountId: "platform", checkoutSessionId: "cs_1" } },
            create: expect.objectContaining({ profileId: "prof-1", itemType: "PRODUCT", itemId: "prod-1", buyerEmail: "buyer@example.com" }),
        }))
    })

    it("accepts the legacy type=product/productId metadata shape", async () => {
        await recordKnowledgePaymentEvent(event("checkout.session.completed", {
            id: "cs_2", payment_status: "paid", payment_intent: "pi_2", customer_email: "b@x.co",
            metadata: { type: "product", productId: "prod-1" },
        }), db)
        expect(mocks.proofUpsert.mock.calls[0][0].create.itemType).toBe("PRODUCT")
    })

    it("stores a service proof via a real booking, never arbitrary profileId metadata", async () => {
        await recordKnowledgePaymentEvent(event("checkout.session.completed", {
            id: "cs_3", payment_status: "paid", payment_intent: "pi_3", customer_email: "b@x.co",
            metadata: { type: "booking", bookingId: "bk-1", profileId: "prof-9" },
        }), db)
        expect(mocks.proofUpsert.mock.calls[0][0].create).toMatchObject({ profileId: "prof-1", itemType: "SERVICE", itemId: "svc-1" })
    })

    it("ignores unpaid sessions, missing intents, missing emails and unknown items", async () => {
        await recordKnowledgePaymentEvent(event("checkout.session.completed", { id: "cs_4", payment_status: "unpaid", payment_intent: "pi_4", customer_email: "b@x.co", metadata: { itemType: "product", itemId: "prod-1" } }), db)
        await recordKnowledgePaymentEvent(event("checkout.session.completed", { id: "cs_5", payment_status: "paid", payment_intent: null, customer_email: "b@x.co", metadata: { itemType: "product", itemId: "prod-1" } }), db)
        await recordKnowledgePaymentEvent(event("checkout.session.completed", { id: "cs_6", payment_status: "paid", payment_intent: "pi_6", metadata: { itemType: "product", itemId: "prod-1" } }), db)
        mocks.productFind.mockResolvedValue(null)
        await recordKnowledgePaymentEvent(event("checkout.session.completed", { id: "cs_7", payment_status: "paid", payment_intent: "pi_7", customer_email: "b@x.co", metadata: { itemType: "product", itemId: "prod-9" } }), db)
        expect(mocks.proofUpsert).not.toHaveBeenCalled()
    })

    it("records refund and dispute blocks keyed to the payment intent", async () => {
        await recordKnowledgePaymentEvent(event("charge.refunded", { payment_intent: "pi_9", amount_refunded: 500, refunded: false }), db)
        expect(mocks.blockUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ paymentIntentId: "pi_9", reason: "refunded" }) }))
        await recordKnowledgePaymentEvent(event("charge.dispute.created", { payment_intent: "pi_10" }), db)
        expect(mocks.blockUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ paymentIntentId: "pi_10", reason: "dispute" }) }))
    })

    it("ignores refunds with no amount refunded and blocks before a later proof", async () => {
        await recordKnowledgePaymentEvent(event("charge.refunded", { payment_intent: "pi_11", amount_refunded: 0, refunded: false }), db)
        expect(mocks.blockUpsert).not.toHaveBeenCalled()
        await recordKnowledgePaymentEvent(event("charge.dispute.created", { payment_intent: "pi_12" }, "acct_2"), db)
        expect(mocks.blockUpsert.mock.calls[0][0].create.stripeAccountId).toBe("acct_2")
    })

    it("is idempotent for duplicate signed events", async () => {
        const session = { id: "cs_8", payment_status: "paid", payment_intent: "pi_8", customer_email: "b@x.co", metadata: { itemType: "product", itemId: "prod-1" } }
        await recordKnowledgePaymentEvent(event("checkout.session.completed", session), db)
        await recordKnowledgePaymentEvent(event("checkout.session.completed", session), db)
        expect(mocks.proofUpsert).toHaveBeenCalledTimes(2)
        expect(mocks.proofUpsert.mock.calls[1][0].update).toEqual({})
    })
})

describe("webhook wiring", () => {
    it("WebhookHandlers records knowledge payments only after signature verification", async () => {
        const order: string[] = []
        mocks.construct.mockImplementation(() => { order.push("verify"); return event("charge.refunded", { payment_intent: "pi_20", refunded: true }) })
        mocks.blockUpsert.mockImplementation(async () => { order.push("record"); return {} })
        await WebhookHandlers.processWebhook(Buffer.from("{}"), "sig")
        expect(order).toEqual(["verify", "record"])
        expect(mocks.blockUpsert).toHaveBeenCalled()
    })

    it("the webhook route records knowledge payments only after signature verification", async () => {
        vi.resetModules()
        vi.doMock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "Stripe-Signature": "sig" })) }))
        vi.doMock("@/lib/admin/capacity", () => ({ stampStripeWebhook: mocks.stamp }))
        vi.doMock("@/lib/knowledge-payments", () => ({ recordKnowledgePaymentEvent: mocks.record }))
        const order: string[] = []
        mocks.construct.mockImplementation(() => { order.push("verify"); return event("charge.dispute.created", { payment_intent: "pi_21" }) })
        mocks.record.mockImplementation(async () => { order.push("record") })
        const { POST } = await import("@/app/api/webhooks/stripe/route")
        const response = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}" }))
        expect(response.status).toBe(200)
        expect(order).toEqual(["verify", "record"])
        expect((mocks.record.mock.calls[0] as unknown[])[0]).toMatchObject({ type: "charge.dispute.created" })
    })
})
