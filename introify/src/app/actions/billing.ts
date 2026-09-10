"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuthenticatedUser, unwrapOwnershipResult } from "@/lib/security"
import { canSelfServeCheckout, getCreditPack, getPlan, isPlanId, PLAN_VERSION, type BillingCadence } from "@/lib/billing/catalog"
import { getPublicBillingAvailability, requirePlatformCheckout } from "@/lib/billing/config"
import { accountUsage, billingTransaction, ensureDefaultBillingAccount, getAccountBalances, getAccountBilling, lockBillingAccount } from "@/lib/billing/service"
import { billingOrigin, platformPortalConfiguration, platformPrice, platformStripe, reconcilePlatformSubscription, stripeId } from "@/lib/billing/stripe-platform"
import type { BillingActionResult, BillingDashboard } from "@/lib/billing/types"

async function accountAccess(accountId: string, manage = false) {
    const actor = unwrapOwnershipResult(await requireAuthenticatedUser())
    if (typeof accountId !== "string" || accountId.length > 100) throw new Error("Invalid billing account.")
    const member = await prisma.billingAccountMember.findUnique({ where: { accountId_userId: { accountId, userId: actor.userId } }, include: { account: { include: { subscription: true } } } })
    if (!member || member.status !== "ACTIVE" || (manage && !["OWNER", "BILLING_ADMIN"].includes(member.role))) throw new Error("You do not have permission to manage this billing account.")
    return { actor, member }
}

export async function getBillingDashboard(input?: { accountId?: string }): Promise<BillingDashboard> {
    const actor = unwrapOwnershipResult(await requireAuthenticatedUser())
    const defaultAccount = await ensureDefaultBillingAccount(actor.userId)
    const members = await prisma.billingAccountMember.findMany({ where: { userId: actor.userId, status: "ACTIVE" }, include: { account: true }, orderBy: { createdAt: "asc" } })
    const active = actor.activeProfileId ? await prisma.profile.findUnique({ where: { id: actor.activeProfileId }, select: { billingAccountId: true } }) : null
    const activeAccountId = members.some(m => m.accountId === active?.billingAccountId) ? active!.billingAccountId : null
    const selectedAccountId = input?.accountId || activeAccountId || defaultAccount.id
    const { member } = await accountAccess(selectedAccountId)
    const canManageBilling = ["OWNER", "BILLING_ADMIN"].includes(member.role)
    const [context, balances, usage, invoices, accounts] = await Promise.all([
        getAccountBilling(selectedAccountId), getAccountBalances(selectedAccountId), accountUsage(prisma, selectedAccountId),
        canManageBilling ? prisma.platformInvoice.findMany({ where: { accountId: selectedAccountId }, orderBy: { createdAt: "desc" }, take: 20 }) : Promise.resolve([]),
        Promise.all(members.map(async m => ({ id: m.accountId, name: m.account.name, planId: (await getAccountBilling(m.accountId)).planId }))),
    ])
    const subscription = member.account.subscription
    return { accounts, selectedAccountId, accountName: member.account.name, role: member.role, canManageBilling: ["OWNER", "BILLING_ADMIN"].includes(member.role), planId: context.planId, cadence: subscription?.cadence === "yearly" ? "yearly" : "monthly", status: context.subscriptionStatus, paidThrough: context.paidThrough?.toISOString() || null, cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false, pendingPlanId: isPlanId(subscription?.pendingPlanId) ? subscription.pendingPlanId : null, balances, usage, availability: getPublicBillingAvailability(), portalAvailable: Boolean(subscription?.providerCustomerId && getPublicBillingAvailability().billing), invoices: invoices.map(i => ({ id: i.id, amountCents: i.amountCents, currency: i.currency, status: i.status, createdAt: i.createdAt.toISOString(), url: i.hostedUrl })) }
}

async function respond(work: () => Promise<BillingActionResult>): Promise<BillingActionResult> {
    try { const result = await work(); revalidatePath("/dashboard/billing"); return result }
    catch (error) {
        // Provider responses can contain customer/payment details; expose only application refusals.
        if (error && typeof error === "object" && "type" in error) return { error: "The billing provider could not complete this request. Please try again shortly." }
        return { error: error instanceof Error && !error.message.includes("prisma") ? error.message : "Billing is temporarily unavailable. Please try again shortly." }
    }
}

async function beginCheckout(input: { accountId: string; actorId: string; kind: "PLAN" | "PACK"; offerId: string; cadence?: BillingCadence; amountCents: number }) {
    return billingTransaction(async tx => {
        await lockBillingAccount(tx, input.accountId)
        const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: input.accountId } })
        if (account.status !== "ACTIVE") throw new Error("This billing account is on hold.")
        const existing = await tx.billingCheckout.findFirst({ where: { accountId: input.accountId, kind: input.kind, status: "PENDING", expiresAt: { gt: new Date() } } })
        if (existing) {
            if (existing.offerId !== input.offerId || existing.cadence !== (input.cadence || null)) throw new Error("Another checkout is already open for this account. Complete it or wait for it to expire before changing the selection.")
            return existing
        }
        if (input.kind === "PLAN") {
            const subscription = await tx.platformSubscription.findUnique({ where: { accountId: input.accountId } })
            if (subscription?.providerSubscriptionId && !["CANCELED", "INCOMPLETE_EXPIRED"].includes(subscription.status)) throw new Error("Manage the existing subscription instead of starting a second one.")
        }
        return tx.billingCheckout.create({ data: { ...input, planVersion: PLAN_VERSION, expiresAt: new Date(Date.now() + 60 * 60_000) } })
    })
}

export async function createPlanCheckout(input: { accountId: string; planId: string; cadence: BillingCadence }): Promise<BillingActionResult> {
    return respond(async () => {
        const { actor } = await accountAccess(input.accountId, true)
        const plan = getPlan(input.planId)
        if (plan.id === "free") throw new Error("Choose Turn off renewal to return to Free after your paid period.")
        if (!canSelfServeCheckout(plan)) throw new Error("This plan is not available for self-serve checkout.")
        if (!["monthly", "yearly"].includes(input.cadence)) throw new Error("Choose monthly or yearly billing.")
        requirePlatformCheckout()
        const stripe = platformStripe()
        // A missed webhook must not let a second checkout double-subscribe the payer.
        const pending = await prisma.billingCheckout.findMany({ where: { accountId: input.accountId, kind: "PLAN", status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 10 })
        for (const checkout of pending) {
            if (!checkout.providerSessionId) {
                if (checkout.expiresAt <= new Date()) throw new Error("An earlier checkout has an unconfirmed provider outcome. It needs billing review before another subscription can start.")
                continue
            }
            const previous = await stripe.checkout.sessions.retrieve(checkout.providerSessionId)
            if (previous.status === "complete" && stripeId(previous.subscription)) await reconcilePlatformSubscription(stripeId(previous.subscription)!)
            else if (previous.status === "expired") await prisma.billingCheckout.update({ where: { id: checkout.id }, data: { status: "EXPIRED" } })
        }
        const subscription = await prisma.platformSubscription.findUnique({ where: { accountId: input.accountId } })
        if (subscription?.providerSubscriptionId && (!subscription.paidThrough || subscription.paidThrough > new Date() || !["CANCELED", "INCOMPLETE_EXPIRED"].includes(subscription.status))) {
            const remote = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId)
            if (stripeId(remote.customer) !== subscription.providerCustomerId || remote.metadata.accountId !== input.accountId) throw new Error("Subscription customer mismatch.")
            if (remote.pending_update || remote.schedule) throw new Error("A subscription change is already pending. Review it in Manage payment & invoices.")
            const price = await platformPrice(plan.id, input.cadence)
            const session = await stripe.billingPortal.sessions.create({ customer: subscription.providerCustomerId!, configuration: await platformPortalConfiguration(), return_url: `${billingOrigin()}/dashboard/billing`, flow_data: { type: "subscription_update_confirm", subscription_update_confirm: { subscription: remote.id, items: [{ id: remote.items.data[0].id, price: price.id, quantity: 1 }] }, after_completion: { type: "redirect", redirect: { return_url: `${billingOrigin()}/dashboard/billing?checkout=success` } } } })
            return { url: session.url }
        }
        const checkout = await beginCheckout({ accountId: input.accountId, actorId: actor.userId, kind: "PLAN", offerId: plan.id, cadence: input.cadence, amountCents: input.cadence === "yearly" ? plan.yearlyCents : plan.monthlyCents })
        if (checkout.providerUrl) return { url: checkout.providerUrl }
        const metadata = { purpose: "introify-platform", checkoutId: checkout.id, accountId: input.accountId, planId: plan.id, planVersion: PLAN_VERSION, cadence: input.cadence }
        const price = await platformPrice(plan.id, input.cadence)
        const session = await stripe.checkout.sessions.create({ mode: "subscription", ...(subscription?.providerCustomerId ? { customer: subscription.providerCustomerId } : {}), client_reference_id: checkout.id, line_items: [{ price: price.id, quantity: 1 }], metadata, subscription_data: { metadata }, allow_promotion_codes: false, billing_address_collection: "required", consent_collection: { terms_of_service: "required" }, expires_at: Math.floor(checkout.expiresAt.getTime() / 1000), success_url: `${billingOrigin()}/dashboard/billing?checkout=success`, cancel_url: `${billingOrigin()}/dashboard/billing?checkout=cancelled` }, { idempotencyKey: `platform-checkout:${checkout.id}` })
        await prisma.billingCheckout.update({ where: { id: checkout.id }, data: { providerSessionId: session.id, providerUrl: session.url } })
        if (!session.url) throw new Error("Checkout did not return a payment page.")
        return { url: session.url }
    })
}

export async function createPackCheckout(input: { accountId: string; packId: string }): Promise<BillingActionResult> {
    return respond(async () => {
        const { actor, member } = await accountAccess(input.accountId, true)
        const context = await getAccountBilling(input.accountId)
        if (context.planId === "free") throw new Error("A paid plan is required to purchase or use credit packs.")
        requirePlatformCheckout()
        const pack = getCreditPack(input.packId)
        const availability = getPublicBillingAvailability()
        if (!(pack.unit === "AI" ? availability.ai : availability.photoreal)) throw new Error("This generation service is currently unavailable. Please wait until it is connected before buying a pack.")
        const checkout = await beginCheckout({ accountId: input.accountId, actorId: actor.userId, kind: "PACK", offerId: pack.id, amountCents: pack.priceCents })
        if (checkout.providerUrl) return { url: checkout.providerUrl }
        const metadata = { purpose: "introify-platform-pack", checkoutId: checkout.id, accountId: input.accountId, packId: pack.id, planVersion: PLAN_VERSION }
        const session = await platformStripe().checkout.sessions.create({ mode: "payment", customer: member.account.subscription!.providerCustomerId!, client_reference_id: checkout.id, line_items: [{ price_data: { currency: "usd", unit_amount: pack.priceCents, product_data: { name: `Introify · ${pack.name}` } }, quantity: 1 }], metadata, payment_intent_data: { metadata }, allow_promotion_codes: false, expires_at: Math.floor(checkout.expiresAt.getTime() / 1000), success_url: `${billingOrigin()}/dashboard/billing?checkout=success`, cancel_url: `${billingOrigin()}/dashboard/billing?checkout=cancelled` }, { idempotencyKey: `platform-checkout:${checkout.id}` })
        await prisma.billingCheckout.update({ where: { id: checkout.id }, data: { providerSessionId: session.id, providerUrl: session.url } })
        if (!session.url) throw new Error("Checkout did not return a payment page.")
        return { url: session.url }
    })
}

export async function createBillingPortal(input: { accountId: string }): Promise<BillingActionResult> {
    return respond(async () => {
        const { member } = await accountAccess(input.accountId, true)
        requirePlatformCheckout()
        const customer = member.account.subscription?.providerCustomerId
        if (!customer) throw new Error("No billing customer is connected to this account yet.")
        const session = await platformStripe().billingPortal.sessions.create({ customer, configuration: await platformPortalConfiguration(), return_url: `${billingOrigin()}/dashboard/billing` })
        return { url: session.url }
    })
}

export async function cancelPlanRenewal(input: { accountId: string }): Promise<BillingActionResult> {
    return respond(async () => {
        const { member } = await accountAccess(input.accountId, true)
        const subscription = member.account.subscription
        if (!subscription?.providerSubscriptionId) throw new Error("There is no subscription to cancel.")
        const stripe = platformStripe()
        const remote = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId)
        if (remote.metadata.accountId !== input.accountId || stripeId(remote.customer) !== subscription.providerCustomerId) throw new Error("Subscription customer mismatch.")
        if (remote.schedule) await stripe.subscriptionSchedules.release(stripeId(remote.schedule)!)
        await stripe.subscriptions.update(remote.id, { cancel_at_period_end: true }, { idempotencyKey: `cancel-renewal:${remote.id}:${remote.items.data[0].current_period_end}` })
        await reconcilePlatformSubscription(remote.id)
        return { success: true, message: "Renewal is off. Your confirmed paid benefits continue until the end of your paid period." }
    })
}
