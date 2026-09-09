import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { billingMode, requirePlatformCheckout } from "./config"
import { getCreditPack, getPlan, isPlanId, PLAN_VERSION, PLANS, type BillingCadence } from "./catalog"
import { billingTransaction, ensureMonthlyGrants, issueGrant, lockBillingAccount } from "./service"

export function platformStripe() {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key?.startsWith(`sk_${billingMode()}_`)) throw new Error("Billing provider is not configured.")
    return new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 })
}
export const stripeId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id || null
export function billingOrigin() { return "https://introify.com" }

export async function platformPrice(planId: string, cadence: BillingCadence) {
    const plan = getPlan(planId)
    if (plan.id === "free") throw new Error("Free does not require checkout.")
    const stripe = platformStripe()
    const lookup = `introify_${PLAN_VERSION}_${plan.id}_${cadence}`
    const existing = (await stripe.prices.list({ lookup_keys: [lookup], limit: 1 })).data[0]
    if (existing) { validatePrice(existing); return existing }
    const productId = `introify_${PLAN_VERSION}_${plan.id}`
    try { await stripe.products.retrieve(productId) }
    catch (error) {
        if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== "resource_missing") throw error
        await stripe.products.create({ id: productId, name: `Introify ${plan.name}`, metadata: { purpose: "introify-platform", planId: plan.id, planVersion: PLAN_VERSION } }, { idempotencyKey: productId })
    }
    return stripe.prices.create({ product: productId, currency: "usd", unit_amount: cadence === "yearly" ? plan.yearlyCents : plan.monthlyCents, recurring: { interval: cadence === "yearly" ? "year" : "month" }, lookup_key: lookup, metadata: { purpose: "introify-platform", planId: plan.id, planVersion: PLAN_VERSION, cadence } }, { idempotencyKey: lookup })
}

export function validatePrice(price: Stripe.Price) {
    const metadata = price.metadata
    if (metadata.purpose !== "introify-platform" || metadata.planVersion !== PLAN_VERSION || !isPlanId(metadata.planId) || metadata.planId === "free") throw new Error("Unrecognized subscription price.")
    const plan = getPlan(metadata.planId)
    const cadence = metadata.cadence
    if (!["monthly", "yearly"].includes(cadence) || price.currency !== "usd" || price.unit_amount !== (cadence === "yearly" ? plan.yearlyCents : plan.monthlyCents) || price.recurring?.interval !== (cadence === "yearly" ? "year" : "month") || price.recurring.interval_count !== 1) throw new Error("Subscription price does not match the approved catalog.")
    return { planId: plan.id, cadence: cadence as BillingCadence, amountCents: price.unit_amount }
}

/** The hosted portal owns confirmation, authentication, proration and scheduled downgrades. */
export async function platformPortalConfiguration() {
    const stripe = platformStripe()
    const products: { product: string; prices: string[] }[] = []
    for (const plan of PLANS.filter(p => p.id !== "free")) {
        const prices = await Promise.all([platformPrice(plan.id, "monthly"), platformPrice(plan.id, "yearly")])
        products.push({ product: stripeId(prices[0].product)!, prices: prices.map(p => p.id) })
    }
    const config = await stripe.billingPortal.configurations.create({
        name: `Introify ${PLAN_VERSION}`, metadata: { purpose: "introify-platform", planVersion: PLAN_VERSION },
        business_profile: { headline: "Manage your Introify plan", privacy_policy_url: `${billingOrigin()}/privacy`, terms_of_service_url: `${billingOrigin()}/terms` },
        default_return_url: `${billingOrigin()}/dashboard/billing`,
        features: { customer_update: { enabled: true, allowed_updates: ["address", "tax_id"] }, invoice_history: { enabled: true }, payment_method_update: { enabled: true }, subscription_cancel: { enabled: true, mode: "at_period_end" }, subscription_update: { enabled: true, default_allowed_updates: ["price"], products, proration_behavior: "always_invoice", schedule_at_period_end: { conditions: [{ type: "decreasing_item_amount" }, { type: "shortening_interval" }] } } },
    }, { idempotencyKey: `introify-portal-${PLAN_VERSION}-v1` })
    return config.id
}

export async function reconcilePlatformSubscription(subscriptionId: string, invoiceId?: string) {
    const observationStartedAt = new Date()
    const [{ token: observationId }] = await prisma.$queryRaw<{ token: bigint }[]>`SELECT nextval('"BillingObservationSequence"') AS token`
    const stripe = platformStripe()
    const remote = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice.payments"] })
    if (remote.metadata.purpose !== "introify-platform") return
    if (remote.livemode !== (billingMode() === "live")) throw new Error("Billing environment mismatch.")
    const checkout = await prisma.billingCheckout.findUnique({ where: { id: remote.metadata.checkoutId || "" } })
    if (!checkout || checkout.kind !== "PLAN" || checkout.accountId !== remote.metadata.accountId) throw new Error("Subscription purchase could not be matched.")
    const customerId = stripeId(remote.customer)!
    const item = remote.items.data[0]
    if (!item || remote.items.data.length !== 1 || item.quantity !== 1) throw new Error("Unexpected subscription items.")
    const currentPrice = validatePrice(item.price)
    const invoice = invoiceId ? await stripe.invoices.retrieve(invoiceId, { expand: ["payments"] }) : typeof remote.latest_invoice === "object" ? remote.latest_invoice : null
    const hasProviderPayment = invoice?.payments?.data.some(payment => payment.status === "paid" && payment.payment.type === "payment_intent")
    const paid = invoice?.status === "paid" && invoice.amount_remaining === 0 && (hasProviderPayment || (invoice.amount_due === 0 && invoice.billing_reason !== "subscription_create")) && invoice.currency === "usd" && stripeId(invoice.customer) === customerId && stripeId(invoice.parent?.subscription_details?.subscription) === remote.id
    let confirmed: { planId: string; cadence: BillingCadence; end: Date; start: Date; priceId: string } | null = null
    if (paid && invoice) {
        for (const invoicePayment of invoice.payments?.data || []) {
            const paymentId = stripeId(invoicePayment.payment.payment_intent)
            if (!paymentId || invoicePayment.status !== "paid") continue
            const payment = await stripe.paymentIntents.retrieve(paymentId)
            const chargeId = stripeId(payment.latest_charge)
            const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null
            if (charge && (charge.amount_refunded > 0 || charge.disputed)) { await reconcileReversal(charge.id, charge.disputed); return }
        }
        const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 })
        const positive = lines.data.filter(line => line.amount >= 0 && stripeId(line.parent?.subscription_item_details?.subscription || line.parent?.invoice_item_details?.subscription || line.subscription) === remote.id && line.pricing?.price_details?.price)
        const line = positive.sort((a, b) => b.period.end - a.period.end || b.period.start - a.period.start)[0]
        if (!line) throw new Error("Paid invoice has no matching subscription period.")
        const priceId = stripeId(line.pricing!.price_details!.price)!
        const price = await stripe.prices.retrieve(priceId)
        const offer = validatePrice(price)
        if (invoice.billing_reason === "subscription_create" && (invoice.subtotal !== checkout.amountCents || invoice.amount_paid < checkout.amountCents)) throw new Error("Initial invoice amount does not match the purchase.")
        confirmed = { ...offer, priceId, start: new Date(line.period.start * 1000), end: new Date(line.period.end * 1000) }
    }
    let scheduledPlan: string | null = null
    const scheduleId = stripeId(remote.schedule)
    if (scheduleId) {
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
        const next = schedule.phases.find(phase => phase.start_date >= item.current_period_end)
        if (next?.items[0]) { const price = await stripe.prices.retrieve(stripeId(next.items[0].price)!); scheduledPlan = validatePrice(price).planId }
    }
    await billingTransaction(async tx => {
        await lockBillingAccount(tx, checkout.accountId)
        const local = await tx.platformSubscription.findUnique({ where: { accountId: checkout.accountId } })
        if (local?.providerSubscriptionId && local.providerSubscriptionId !== remote.id) {
            const latestPaidCheckout = await tx.billingCheckout.findFirst({ where: { accountId: checkout.accountId, kind: "PLAN", status: "PAID" }, orderBy: { createdAt: "desc" } })
            if (latestPaidCheckout && checkout.createdAt <= latestPaidCheckout.createdAt) return
            // Replacements must be newer verified purchases, even after the old paid term expires.
            if (!paid || !confirmed) return
            if (local.paidThrough && local.paidThrough > new Date()) throw new Error("Another subscription is already active for this account.")
        }
        if (local?.providerCustomerId && local.providerCustomerId !== customerId) throw new Error("Subscription customer mismatch.")
        const staleSnapshot = Boolean(local && local.lastObservationId > observationId)
        const status = remote.status === "active" ? "ACTIVE" : remote.status === "canceled" ? "CANCELED" : remote.status === "past_due" ? "PAST_DUE" : remote.status.toUpperCase()
        const canAdvance = confirmed && (!local?.paidThrough || confirmed.end > local.paidThrough || (!staleSnapshot && confirmed.end.getTime() === local.paidThrough.getTime() && confirmed.priceId === item.price.id))
        const newSubscription = !local?.allowanceAnchor || local.providerSubscriptionId !== remote.id
        const activation = canAdvance ? { planId: confirmed!.planId, cadence: confirmed!.cadence, providerPriceId: confirmed!.priceId, paidThrough: confirmed!.end, periodStart: confirmed!.start, periodEnd: confirmed!.end, allowanceAnchor: newSubscription ? new Date(remote.billing_cycle_anchor * 1000) : local!.allowanceAnchor } : {}
        const providerState = staleSnapshot ? {} : { providerSubscriptionId: remote.id, providerCustomerId: customerId, providerScheduleId: scheduleId, status, cancelAtPeriodEnd: remote.cancel_at_period_end, lastProviderEventAt: observationStartedAt, lastObservationId: observationId, pendingPlanId: scheduledPlan || (currentPrice.planId !== (activation.planId || local?.planId) ? currentPrice.planId : null) }
        await tx.platformSubscription.upsert({ where: { accountId: checkout.accountId }, create: { accountId: checkout.accountId, providerSubscriptionId: remote.id, providerCustomerId: customerId, status, cancelAtPeriodEnd: remote.cancel_at_period_end, lastProviderEventAt: observationStartedAt, lastObservationId: observationId, ...activation }, update: { ...providerState, ...activation } })
        if (paid && invoice && confirmed) {
            const paymentId = stripeId(invoice.payments?.data.find(payment => payment.status === "paid")?.payment.payment_intent)
            await tx.platformInvoice.upsert({ where: { providerInvoiceId: invoice.id }, create: { accountId: checkout.accountId, providerInvoiceId: invoice.id, providerPaymentId: paymentId, providerSubscriptionId: remote.id, amountCents: invoice.amount_paid, currency: invoice.currency, status: "PAID", hostedUrl: invoice.hosted_invoice_url, periodStart: confirmed.start, periodEnd: confirmed.end }, update: {} })
            await tx.billingCheckout.updateMany({ where: { id: checkout.id, status: { notIn: ["REFUNDED", "DISPUTED"] } }, data: { status: "PAID" } })
            const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: checkout.accountId } })
            if (newSubscription) await tx.billingCreditGrant.updateMany({ where: { accountId: account.id, kind: "MONTHLY", revokedAt: null }, data: { remaining: 0, revokedAt: new Date() } })
            await tx.billingTrialClaim.upsert({ where: { userId: account.ownerUserId }, create: { userId: account.ownerUserId, accountId: account.id, status: "ABSORBED" }, update: { status: "ABSORBED" } })
            await tx.billingCreditGrant.updateMany({ where: { accountId: account.id, kind: "FREE_TRIAL", revokedAt: null }, data: { remaining: 0, revokedAt: new Date() } })
            if (canAdvance && account.status === "ACTIVE") await ensureMonthlyGrants(tx, account.id)
        }
    })
}

async function fulfillPack(sessionId: string) {
    const stripe = platformStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] })
    if (session.metadata?.purpose !== "introify-platform-pack") return
    const checkout = await prisma.billingCheckout.findUnique({ where: { id: session.metadata.checkoutId || "" } })
    if (!checkout || checkout.kind !== "PACK" || checkout.accountId !== session.metadata.accountId || checkout.providerSessionId !== session.id) throw new Error("Pack purchase could not be matched.")
    const pack = getCreditPack(checkout.offerId)
    const payment = typeof session.payment_intent === "object" ? session.payment_intent : null
    if (session.livemode !== (billingMode() === "live") || session.currency !== "usd" || session.amount_total !== checkout.amountCents || checkout.amountCents !== pack.priceCents || session.payment_status !== "paid" || !payment || payment.status !== "succeeded" || payment.amount_received !== checkout.amountCents) throw new Error("Pack payment has not been confirmed.")
    const chargeId = stripeId(payment.latest_charge)
    const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null
    if (!charge) throw new Error("Pack charge has not been confirmed.")
    if (charge.amount_refunded > 0 || charge.disputed) { await reconcileReversal(charge.id, charge.disputed); return }
    await billingTransaction(async tx => {
        await lockBillingAccount(tx, checkout.accountId)
        const current = await tx.billingCheckout.findUniqueOrThrow({ where: { id: checkout.id } })
        if (["REFUNDED", "DISPUTED"].includes(current.status)) return
        const subscription = await tx.platformSubscription.findUnique({ where: { accountId: checkout.accountId } })
        if (stripeId(session.customer) !== subscription?.providerCustomerId) throw new Error("Pack customer mismatch.")
        await issueGrant(tx, { accountId: checkout.accountId, unit: pack.unit, kind: "PURCHASED", quantity: pack.amount, sourceKey: `pack:${checkout.id}` })
        await tx.billingCheckout.update({ where: { id: checkout.id }, data: { status: "PAID", providerPaymentId: payment.id } })
    })
}

async function reconcileReversal(chargeId: string, disputed: boolean) {
    const stripe = platformStripe()
    const charge = await stripe.charges.retrieve(chargeId)
    if (charge.livemode !== (billingMode() === "live")) throw new Error("Reversal environment mismatch.")
    if (!disputed && !charge.amount_refunded) return
    const paymentId = stripeId(charge.payment_intent)
    if (!paymentId) return
    let checkout = await prisma.billingCheckout.findUnique({ where: { providerPaymentId: paymentId } })
    const invoice = await prisma.platformInvoice.findFirst({ where: { providerPaymentId: paymentId } })
    let remoteInvoice: Stripe.Invoice | null = null
    if (!checkout && !invoice) {
        const payment = await stripe.paymentIntents.retrieve(paymentId)
        if (payment.metadata.purpose === "introify-platform-pack") {
            checkout = await prisma.billingCheckout.findUnique({ where: { id: payment.metadata.checkoutId || "" } })
            if (!checkout || checkout.kind !== "PACK" || checkout.accountId !== payment.metadata.accountId) throw new Error("Reversed pack cannot be matched.")
        } else {
            const invoices = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentId }, limit: 10 })
            for (const item of invoices.data) {
                const candidate = await stripe.invoices.retrieve(stripeId(item.invoice)!)
                const subId = stripeId(candidate.parent?.subscription_details?.subscription)
                if (!subId) continue
                const subscription = await stripe.subscriptions.retrieve(subId)
                if (subscription.metadata.purpose !== "introify-platform") continue
                checkout = await prisma.billingCheckout.findUnique({ where: { id: subscription.metadata.checkoutId || "" } })
                if (!checkout || checkout.kind !== "PLAN" || checkout.accountId !== subscription.metadata.accountId) throw new Error("Reversed subscription cannot be matched.")
                remoteInvoice = candidate
                break
            }
        }
    }
    const accountId = checkout?.accountId || invoice?.accountId
    if (!accountId) return
    await billingTransaction(async tx => {
        await lockBillingAccount(tx, accountId)
        if (checkout) {
            const grant = await tx.billingCreditGrant.findUnique({ where: { sourceKey: `pack:${checkout.id}` } })
            if (grant && !grant.revokedAt) {
                await tx.billingCreditGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date(), remaining: 0 } })
                await tx.billingLedgerEntry.upsert({ where: { operationKey: `reversal:${charge.id}` }, create: { accountId, unit: grant.unit, kind: "REVOKE", amount: -grant.remaining, grantId: grant.id, operationKey: `reversal:${charge.id}` }, update: {} })
            }
            await tx.billingCheckout.update({ where: { id: checkout.id }, data: { status: disputed ? "DISPUTED" : "REFUNDED", ...(checkout.kind === "PACK" ? { providerPaymentId: paymentId } : {}) } })
        }
        if (invoice) await tx.platformInvoice.update({ where: { id: invoice.id }, data: { status: disputed ? "DISPUTED" : "REFUNDED" } })
        else if (remoteInvoice) await tx.platformInvoice.upsert({ where: { providerInvoiceId: remoteInvoice.id }, create: { accountId, providerInvoiceId: remoteInvoice.id, providerPaymentId: paymentId, providerSubscriptionId: stripeId(remoteInvoice.parent?.subscription_details?.subscription), amountCents: remoteInvoice.amount_paid, currency: remoteInvoice.currency, status: disputed ? "DISPUTED" : "REFUNDED", hostedUrl: remoteInvoice.hosted_invoice_url }, update: { status: disputed ? "DISPUTED" : "REFUNDED" } })
        // Partial refunds and consumed credits need reconciliation, never a negative spendable balance.
        await tx.billingAccount.update({ where: { id: accountId }, data: { status: disputed ? "DISPUTED" : "SUSPENDED" } })
        await tx.billingAuditEvent.upsert({ where: { id: `reversal:${chargeId}` }, create: { id: `reversal:${chargeId}`, accountId, kind: "PAYMENT_REVERSAL", metadata: { chargeId, disputed, amountRefunded: charge.amount_refunded } }, update: { metadata: { chargeId, disputed, amountRefunded: charge.amount_refunded } } })
    })
}

export async function processBillingEvent(id: string) {
    const claimed = await prisma.billingProviderEvent.updateMany({ where: { id, status: { not: "DONE" }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 } } })
    if (!claimed.count) return
    const row = await prisma.billingProviderEvent.findUniqueOrThrow({ where: { id } })
    try {
        const event = row.payload as unknown as Stripe.Event
        const object = event.data.object as unknown as { id: string; metadata?: Record<string, string>; parent?: { subscription_details?: { subscription?: string } }; charge?: string }
        if (event.type.startsWith("customer.subscription.")) await reconcilePlatformSubscription(object.id)
        else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
            if (object.metadata?.purpose === "introify-platform-pack") await fulfillPack(object.id)
            else if (object.metadata?.purpose === "introify-platform") {
                const session = await platformStripe().checkout.sessions.retrieve(object.id)
                const subscriptionId = stripeId(session.subscription)
                if (subscriptionId) await reconcilePlatformSubscription(subscriptionId)
            }
        } else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
            const invoice = await platformStripe().invoices.retrieve(object.id)
            const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription)
            if (subscriptionId) await reconcilePlatformSubscription(subscriptionId, event.type === "invoice.paid" ? invoice.id : undefined)
        } else if (event.type === "charge.refunded") await reconcileReversal(object.id, false)
        else if (event.type === "charge.dispute.created" && object.charge) await reconcileReversal(object.charge, true)
        await prisma.billingProviderEvent.update({ where: { id }, data: { status: "DONE", processedAt: new Date(), leaseUntil: null, error: null } })
    } catch (error) {
        await prisma.billingProviderEvent.update({ where: { id }, data: { status: "FAILED", leaseUntil: new Date(Date.now() + 60_000), error: "Provider reconciliation failed; retry required." } })
        throw error
    }
}

export async function retryBillingEvents() {
    if (!process.env.INTROIFY_STRIPE_WEBHOOK_SECRET) return
    const rows = await prisma.billingProviderEvent.findMany({ where: { status: { not: "DONE" }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true } })
    for (const row of rows) { try { await processBillingEvent(row.id) } catch { /* Durable inbox will retry on the next worker pass. */ } }
}

export function checkoutIsEnabled() { requirePlatformCheckout() }
