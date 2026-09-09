// @vitest-environment node
import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { getCreditPack, getPlan, PLAN_VERSION, type PlanId } from "@/lib/billing/catalog"
import { ensureDefaultBillingAccount } from "@/lib/billing/service"
import { processBillingEvent, reconcilePlatformSubscription } from "@/lib/billing/stripe-platform"

const provider = vi.hoisted(() => ({
    subscriptions: { retrieve: vi.fn() },
    invoices: { retrieve: vi.fn(), listLineItems: vi.fn() },
    prices: { retrieve: vi.fn() },
    paymentIntents: { retrieve: vi.fn() },
    charges: { retrieve: vi.fn() },
    invoicePayments: { list: vi.fn() },
    checkout: { sessions: { retrieve: vi.fn() } },
    subscriptionSchedules: { retrieve: vi.fn() },
}))
vi.mock("stripe", () => ({ default: class { constructor() { return provider } } }))
vi.mock("@/lib/billing/config", () => ({ billingMode: () => "test", requirePlatformCheckout: vi.fn() }))

// Real transactions, constraints and ledger writes; only the remote payment
// provider is mocked. The normal application database is never a valid target.
const target = process.env.INTROIFY_BILLING_TEST_DATABASE_URL
const isolated = target && target === process.env.DATABASE_URL && /^postgresql:\/\/introify_test@127\.0\.0\.1:\d+\/introify_billing_integration(?:_migrated)?\?schema=public$/.test(target)
const suite = isolated ? describe : describe.skip
const unique = () => randomUUID().replaceAll("-", "")
const seconds = (value: Date) => Math.floor(value.getTime() / 1000)

async function accountFixture() {
    const key = unique()
    const user = await prisma.user.create({ data: { clerkId: `stripe-test-${key}`, email: `${key}@example.test`, emailVerifiedAt: new Date() } })
    const account = await ensureDefaultBillingAccount(user.id)
    return { user, account, customerId: `cus_${key}` }
}

function priceFixture(planId: PlanId) {
    const plan = getPlan(planId)
    return { id: `price_${unique()}`, currency: "usd", unit_amount: plan.monthlyCents, recurring: { interval: "month", interval_count: 1 }, metadata: { purpose: "introify-platform", planId, planVersion: PLAN_VERSION, cadence: "monthly" } }
}

async function subscriptionFixture(planId: PlanId = "starter", existing?: Awaited<ReturnType<typeof accountFixture>>) {
    const owner = existing || await accountFixture()
    const checkout = await prisma.billingCheckout.create({ data: { accountId: owner.account.id, actorId: owner.user.id, kind: "PLAN", offerId: planId, cadence: "monthly", amountCents: getPlan(planId).monthlyCents, expiresAt: new Date(Date.now() + 3_600_000) } })
    const price = priceFixture(planId)
    const subId = `sub_${unique()}`
    const paymentId = `pi_${unique()}`
    const start = new Date(Date.now() - 60_000)
    const end = new Date(Date.now() + 28 * 86400_000)
    const charge = { id: `ch_${unique()}`, livemode: false, amount_refunded: 0, disputed: false, payment_intent: paymentId, customer: owner.customerId }
    const payment = { id: paymentId, status: "succeeded", amount_received: checkout.amountCents, latest_charge: charge.id, metadata: {} }
    const invoice = { id: `in_${unique()}`, status: "paid", amount_remaining: 0, amount_due: checkout.amountCents, amount_paid: checkout.amountCents, subtotal: checkout.amountCents, currency: "usd", billing_reason: "subscription_create", customer: owner.customerId, parent: { subscription_details: { subscription: subId } }, payments: { data: [{ status: "paid", payment: { type: "payment_intent", payment_intent: paymentId } }] }, hosted_invoice_url: "https://invoice.example.test/fixture" }
    const subscription = { id: subId, metadata: { purpose: "introify-platform", checkoutId: checkout.id, accountId: owner.account.id }, livemode: false, customer: owner.customerId, status: "active", cancel_at_period_end: false, billing_cycle_anchor: seconds(start), schedule: null, items: { data: [{ id: `si_${unique()}`, quantity: 1, price, current_period_end: seconds(end) }] }, latest_invoice: invoice }
    const lines = { data: [{ amount: checkout.amountCents, period: { start: seconds(start), end: seconds(end) }, parent: { subscription_item_details: { subscription: subId } }, pricing: { price_details: { price: price.id } } }] }
    provider.subscriptions.retrieve.mockResolvedValue(subscription)
    provider.invoices.retrieve.mockResolvedValue(invoice)
    provider.invoices.listLineItems.mockResolvedValue(lines)
    provider.prices.retrieve.mockResolvedValue(price)
    provider.paymentIntents.retrieve.mockResolvedValue(payment)
    provider.charges.retrieve.mockResolvedValue(charge)
    provider.invoicePayments.list.mockResolvedValue({ data: [{ invoice: invoice.id }] })
    return { ...owner, checkout, price, subscription, invoice, payment, charge, start, end }
}

async function eventFixture(type: string, object: Record<string, unknown>) {
    const id = `evt_${unique()}`
    await prisma.billingProviderEvent.create({ data: { id, liveMode: false, type, payload: { id, type, data: { object } } as Prisma.InputJsonValue } })
    return id
}

async function packFixture() {
    const owner = await accountFixture()
    const pack = getCreditPack("ai-1000")
    await prisma.platformSubscription.create({ data: { accountId: owner.account.id, planId: "starter", status: "ACTIVE", paidThrough: new Date(Date.now() + 86400_000), providerCustomerId: owner.customerId } })
    const sessionId = `cs_${unique()}`
    const checkout = await prisma.billingCheckout.create({ data: { accountId: owner.account.id, actorId: owner.user.id, kind: "PACK", offerId: pack.id, amountCents: pack.priceCents, expiresAt: new Date(Date.now() + 3_600_000), providerSessionId: sessionId } })
    const metadata = { purpose: "introify-platform-pack", checkoutId: checkout.id, accountId: owner.account.id }
    const payment = { id: `pi_${unique()}`, metadata, status: "succeeded", amount_received: pack.priceCents, latest_charge: `ch_${unique()}` }
    const charge = { id: payment.latest_charge, livemode: false, amount_refunded: 0, disputed: false, payment_intent: payment.id, customer: owner.customerId }
    const session = { id: sessionId, metadata, customer: owner.customerId, livemode: false, currency: "usd", amount_total: pack.priceCents, payment_status: "paid", payment_intent: payment }
    provider.checkout.sessions.retrieve.mockResolvedValue(session)
    provider.charges.retrieve.mockResolvedValue(charge)
    provider.paymentIntents.retrieve.mockResolvedValue(payment)
    return { ...owner, pack, checkout, session, payment, charge }
}

suite("Stripe reconciliation against disposable PostgreSQL", () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_isolated_fixture")
        vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network allowed in payment reconciliation tests") }))
    })
    afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await prisma.$disconnect() })

    it("concurrent paid-invoice replay activates one subscription and grants one monthly allowance", async () => {
        const fixture = await subscriptionFixture("pro")
        const event = await eventFixture("invoice.paid", { id: fixture.invoice.id })
        await Promise.all([processBillingEvent(event), processBillingEvent(event), reconcilePlatformSubscription(fixture.subscription.id)])
        await reconcilePlatformSubscription(fixture.subscription.id, fixture.invoice.id)
        const local = await prisma.platformSubscription.findUniqueOrThrow({ where: { accountId: fixture.account.id } })
        expect(local.planId).toBe("pro")
        expect(local.providerSubscriptionId).toBe(fixture.subscription.id)
        expect(await prisma.platformInvoice.count({ where: { accountId: fixture.account.id } })).toBe(1)
        const grants = await prisma.billingCreditGrant.findMany({ where: { accountId: fixture.account.id, kind: "MONTHLY" } })
        expect(grants).toHaveLength(2)
        expect(grants.find(grant => grant.unit === "AI")?.remaining).toBe(getPlan("pro").aiCredits)
        expect(grants.find(grant => grant.unit === "PHOTOREAL")?.remaining).toBe(getPlan("pro").photorealGenerations)
        expect((await prisma.billingProviderEvent.findUniqueOrThrow({ where: { id: event } })).status).toBe("DONE")
    })

    it("an unpaid upgrade and its older invoice cannot grant the higher plan", async () => {
        const fixture = await subscriptionFixture("starter")
        await reconcilePlatformSubscription(fixture.subscription.id)
        const before = await prisma.billingCreditGrant.findMany({ where: { accountId: fixture.account.id }, orderBy: { id: "asc" } })
        fixture.subscription.items.data[0].price = priceFixture("pro")
        const openInvoice = { ...fixture.invoice, id: `in_${unique()}`, status: "open", amount_remaining: 1000, billing_reason: "subscription_update" }
        fixture.subscription.latest_invoice = openInvoice
        await reconcilePlatformSubscription(fixture.subscription.id)
        // Delivery of the initial invoice after the unpaid price update is also harmless.
        await reconcilePlatformSubscription(fixture.subscription.id, fixture.invoice.id)
        const local = await prisma.platformSubscription.findUniqueOrThrow({ where: { accountId: fixture.account.id } })
        expect(local.planId).toBe("starter")
        expect(local.pendingPlanId).toBe("pro")
        expect(local.providerPriceId).toBe(fixture.price.id)
        expect(await prisma.billingCreditGrant.findMany({ where: { accountId: fixture.account.id }, orderBy: { id: "asc" } })).toEqual(before)
    })

    it("a slower earlier provider snapshot cannot undo a newer cancellation", async () => {
        const fixture = await subscriptionFixture("starter")
        const lines = await provider.invoices.listLineItems()
        let entered!: () => void
        let unblock!: () => void
        const reached = new Promise<void>(resolve => { entered = resolve })
        const paused = new Promise<void>(resolve => { unblock = resolve })
        provider.invoices.listLineItems.mockImplementationOnce(async () => { entered(); await paused; return lines })
        const older = reconcilePlatformSubscription(fixture.subscription.id)
        await reached
        // Different wall-clock instants make the metadata watermark observable.
        await new Promise(resolve => setTimeout(resolve, 5))
        provider.subscriptions.retrieve.mockResolvedValue({ ...fixture.subscription, status: "canceled", cancel_at_period_end: true })
        try { await reconcilePlatformSubscription(fixture.subscription.id) }
        finally { unblock() }
        await older
        const local = await prisma.platformSubscription.findUniqueOrThrow({ where: { accountId: fixture.account.id } })
        expect(local.status).toBe("CANCELED")
        expect(local.cancelAtPeriodEnd).toBe(true)
        expect(await prisma.platformInvoice.count({ where: { accountId: fixture.account.id } })).toBe(1)
    })

    it("orders simultaneous snapshots even when their wall-clock timestamps are identical", async () => {
        const fixture = await subscriptionFixture("starter")
        const lines = await provider.invoices.listLineItems()
        let entered!: () => void
        let unblock!: () => void
        const reached = new Promise<void>(resolve => { entered = resolve })
        const paused = new Promise<void>(resolve => { unblock = resolve })
        provider.invoices.listLineItems.mockImplementationOnce(async () => { entered(); await paused; return lines })
        vi.useFakeTimers({ toFake: ["Date"] })
        vi.setSystemTime(new Date())
        try {
            const older = reconcilePlatformSubscription(fixture.subscription.id)
            await reached
            provider.subscriptions.retrieve.mockResolvedValue({ ...fixture.subscription, status: "canceled", cancel_at_period_end: true })
            try { await reconcilePlatformSubscription(fixture.subscription.id) }
            finally { unblock() }
            await older
            const local = await prisma.platformSubscription.findUniqueOrThrow({ where: { accountId: fixture.account.id } })
            expect(local.status).toBe("CANCELED")
            expect(local.cancelAtPeriodEnd).toBe(true)
            expect(await prisma.platformInvoice.count({ where: { accountId: fixture.account.id } })).toBe(1)
        } finally { vi.useRealTimers() }
    })

    it("a retired subscription cannot replace a newer verified purchase even after its term expires", async () => {
        const fixture = await subscriptionFixture("starter")
        await prisma.billingCheckout.update({ where: { id: fixture.checkout.id }, data: { createdAt: new Date(Date.now() - 86400_000), status: "PAID" } })
        const newId = `sub_${unique()}`
        await prisma.billingCheckout.create({ data: { accountId: fixture.account.id, actorId: fixture.user.id, kind: "PLAN", offerId: "pro", cadence: "monthly", amountCents: getPlan("pro").monthlyCents, status: "PAID", expiresAt: new Date(Date.now() - 60_000) } })
        await prisma.platformSubscription.create({ data: { accountId: fixture.account.id, providerSubscriptionId: newId, providerCustomerId: fixture.customerId, planId: "pro", status: "CANCELED", paidThrough: new Date(Date.now() - 60_000), allowanceAnchor: new Date(Date.now() - 86400_000) } })
        fixture.subscription.status = "canceled"
        await reconcilePlatformSubscription(fixture.subscription.id)
        const local = await prisma.platformSubscription.findUniqueOrThrow({ where: { accountId: fixture.account.id } })
        expect(local.providerSubscriptionId).toBe(newId)
        expect(local.planId).toBe("pro")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: fixture.account.id } })).toBe(0)
        expect(await prisma.platformInvoice.count({ where: { accountId: fixture.account.id } })).toBe(0)
    })

    it("a refund before subscription success places a hold without ever minting credits", async () => {
        const fixture = await subscriptionFixture("pro")
        fixture.charge.amount_refunded = fixture.checkout.amountCents
        await processBillingEvent(await eventFixture("charge.refunded", { id: fixture.charge.id }))
        expect(await prisma.billingCreditGrant.count({ where: { accountId: fixture.account.id } })).toBe(0)
        expect(await prisma.platformSubscription.count({ where: { accountId: fixture.account.id } })).toBe(0)
        await processBillingEvent(await eventFixture("invoice.paid", { id: fixture.invoice.id }))
        await reconcilePlatformSubscription(fixture.subscription.id)
        expect((await prisma.billingAccount.findUniqueOrThrow({ where: { id: fixture.account.id } })).status).toBe("SUSPENDED")
        expect((await prisma.platformInvoice.findUniqueOrThrow({ where: { providerInvoiceId: fixture.invoice.id } })).status).toBe("REFUNDED")
        expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: fixture.checkout.id } })).status).toBe("REFUNDED")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: fixture.account.id } })).toBe(0)
        expect(await prisma.billingAuditEvent.count({ where: { accountId: fixture.account.id, kind: "PAYMENT_REVERSAL" } })).toBe(1)
    })

    it("a pack refund revokes the remaining grant once and success replays cannot restore it", async () => {
        const fixture = await packFixture()
        await processBillingEvent(await eventFixture("checkout.session.completed", fixture.session))
        const grant = await prisma.billingCreditGrant.findUniqueOrThrow({ where: { sourceKey: `pack:${fixture.checkout.id}` } })
        expect(grant.remaining).toBe(fixture.pack.amount)
        fixture.charge.amount_refunded = fixture.pack.priceCents
        await processBillingEvent(await eventFixture("charge.refunded", { id: fixture.charge.id }))
        await processBillingEvent(await eventFixture("charge.refunded", { id: fixture.charge.id }))
        await processBillingEvent(await eventFixture("checkout.session.async_payment_succeeded", fixture.session))
        const revoked = await prisma.billingCreditGrant.findUniqueOrThrow({ where: { id: grant.id } })
        expect(revoked.remaining).toBe(0)
        expect(revoked.revokedAt).not.toBeNull()
        expect(await prisma.billingCreditGrant.count({ where: { sourceKey: `pack:${fixture.checkout.id}` } })).toBe(1)
        expect(await prisma.billingLedgerEntry.count({ where: { accountId: fixture.account.id, kind: "REVOKE" } })).toBe(1)
        expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: fixture.checkout.id } })).status).toBe("REFUNDED")
    })

    it("a refund that commits while successful reconciliation is paused cannot reactivate spending", async () => {
        const fixture = await subscriptionFixture("pro")
        const lines = await provider.invoices.listLineItems()
        let entered!: () => void
        let unblock!: () => void
        const reached = new Promise<void>(resolve => { entered = resolve })
        const paused = new Promise<void>(resolve => { unblock = resolve })
        provider.invoices.listLineItems.mockImplementationOnce(async () => { entered(); await paused; return lines })
        // Charge was checked before the refund; the account lock must still
        // prevent this older success from minting credits after the hold commits.
        const success = reconcilePlatformSubscription(fixture.subscription.id)
        await reached
        fixture.charge.amount_refunded = fixture.checkout.amountCents
        try { await processBillingEvent(await eventFixture("charge.refunded", { id: fixture.charge.id })) }
        finally { unblock() }
        await success
        await reconcilePlatformSubscription(fixture.subscription.id)
        await processBillingEvent(await eventFixture("charge.refunded", { id: fixture.charge.id }))
        expect((await prisma.billingAccount.findUniqueOrThrow({ where: { id: fixture.account.id } })).status).toBe("SUSPENDED")
        expect((await prisma.platformInvoice.findUniqueOrThrow({ where: { providerInvoiceId: fixture.invoice.id } })).status).toBe("REFUNDED")
        expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: fixture.checkout.id } })).status).toBe("REFUNDED")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: fixture.account.id } })).toBe(0)
    })

    it("a pack chargeback before fulfillment holds the account and prevents delayed success", async () => {
        const fixture = await packFixture()
        fixture.charge.disputed = true
        await processBillingEvent(await eventFixture("charge.dispute.created", { id: `dp_${unique()}`, charge: fixture.charge.id }))
        await processBillingEvent(await eventFixture("checkout.session.completed", fixture.session))
        expect((await prisma.billingAccount.findUniqueOrThrow({ where: { id: fixture.account.id } })).status).toBe("DISPUTED")
        expect((await prisma.billingCheckout.findUniqueOrThrow({ where: { id: fixture.checkout.id } })).status).toBe("DISPUTED")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: fixture.account.id } })).toBe(0)
    })

    it("an invoice with only a direct-charge record never grants a subscription", async () => {
        const fixture = await subscriptionFixture("pro")
        fixture.invoice.payments.data[0].payment.type = "charge"
        await reconcilePlatformSubscription(fixture.subscription.id)
        expect((await prisma.platformSubscription.findUniqueOrThrow({ where: { accountId: fixture.account.id } })).planId).toBe("free")
        expect(await prisma.billingCreditGrant.count({ where: { accountId: fixture.account.id } })).toBe(0)
        expect(await prisma.platformInvoice.count({ where: { accountId: fixture.account.id } })).toBe(0)
    })
})
