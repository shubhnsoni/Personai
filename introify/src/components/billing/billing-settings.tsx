"use client"

import Link from "@/components/navigation/transition-link"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, CheckCircle2, Clock3, Info } from "lucide-react"
import { cancelPlanRenewal, createBillingPortal, createPackCheckout, createPlanCheckout } from "@/app/actions/billing"
import { AI_MODES, CREDIT_PACKS, getPlan, type BillingCadence, type PlanId } from "@/lib/billing/catalog"
import type { BillingActionResult, BillingDashboard } from "@/lib/billing/types"
import { PlanComparison } from "./plan-comparison"
import { PlanFeatureMatrix } from "./plan-feature-matrix"
import { billingDate, dollars, invoiceAmount, safeInvoiceUrl, storageSize } from "./format"
import "./billing.css"

type Feedback = { message: string; error: boolean }

function UsageCard({ title, available, included, purchased, reserved, note }: { title: string; available: number; included: number; purchased: number; reserved: number; note: string }) {
    const total = Math.max(included, available, 1)
    return <article className="billing-usage"><h3>{title}</h3><p className="billing-usage-value"><strong>{Math.max(0, available).toLocaleString("en-US")}</strong><span>available</span></p><div className="billing-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, available / total * 100))}%` }} /></div><p>{included.toLocaleString("en-US")} included monthly · {purchased.toLocaleString("en-US")} purchased · {reserved.toLocaleString("en-US")} reserved<br />{note}</p></article>
}

export function BillingSettings({ data, initialCadence, checkoutReturn }: { data: BillingDashboard; initialCadence?: BillingCadence; checkoutReturn?: "success" | "cancelled" }) {
    const router = useRouter()
    const plan = getPlan(data.planId)
    const operation = useRef(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<Feedback | null>(null)
    const [confirmCancel, setConfirmCancel] = useState(false)
    const paid = data.planId !== "free"
    // The server resolves the effective plan from verified paid-through coverage.
    const activePaid = paid

    async function perform(key: string, action: () => Promise<BillingActionResult>) {
        if (operation.current) return
        operation.current = true
        setBusy(key)
        setFeedback(null)
        try {
            const result = await action()
            if (result.error) { setFeedback({ message: result.error, error: true }); return }
            if (result.url) {
                const url = new URL(result.url)
                if (url.protocol !== "https:") throw new Error("Secure checkout could not be opened. Please try again from Billing.")
                window.location.assign(url.href)
                return
            }
            if (!result.success) { setFeedback({ message: "The change could not be confirmed. Refresh Billing to check your account before trying again.", error: true }); return }
            setFeedback({ message: result.message || "Your billing settings have been updated.", error: false })
            setConfirmCancel(false)
            router.refresh()
        } catch {
            setFeedback({ message: "We couldn’t confirm this request. Refresh your billing status before trying again.", error: true })
        } finally {
            operation.current = false
            setBusy(null)
        }
    }

    function choosePlan(planId: PlanId, cadence: BillingCadence) {
        if (!data.canManageBilling || !data.availability.billing || planId === "free") return
        void perform(`plan-${planId}`, () => createPlanCheckout({ accountId: data.selectedAccountId, planId, cadence }))
    }

    const aiAvailable = data.balances.ai.monthly + (activePaid ? data.balances.ai.purchased : 0)
    const modelAvailable = data.balances.photoreal.monthly + (activePaid ? data.balances.photoreal.purchased : 0) + data.balances.photoreal.trial

    return <main className="billing-design billing-dashboard">
        <header className="billing-dashboard-header"><div><p className="billing-eyebrow">ROOM FOR YOUR NEXT CHAPTER</p><h1>Plan & usage</h1><p>One billing account. Clear limits across your businesses.</p></div><label className="billing-account-select">Billing account<select value={data.selectedAccountId} disabled={Boolean(busy)} onChange={event => router.push(`/dashboard/billing?accountId=${encodeURIComponent(event.target.value)}`)}>{data.accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></header>
        {checkoutReturn && <div className="billing-note"><Clock3 size={17} aria-hidden="true" /><p>{checkoutReturn === "success" ? "You’ve returned from checkout. Your plan and balances below update only after payment is verified. If the payment is still processing, refresh to check its status." : "Checkout was closed. Check the plan and balances below for your confirmed account status."} <button type="button" className="underline underline-offset-4" disabled={Boolean(busy)} onClick={() => router.refresh()}>Refresh status</button></p></div>}
        {!data.canManageBilling && <div className="billing-note"><Info size={17} aria-hidden="true" /><p>You can view this account’s usage. A billing owner or billing administrator can change the plan, buy packs and manage renewal.</p></div>}
        <section className="billing-current" aria-labelledby="current-plan-title"><div><p className="billing-eyebrow">{data.accountName}</p><h2 id="current-plan-title">{plan.name} <span className="text-base font-normal">· {data.status.replace(/_/g, " ")}</span></h2><p>{paid ? `${data.cadence === "yearly" ? "Annual" : "Monthly"} billing · ${data.cancelAtPeriodEnd ? "Access through" : "Current paid period ends"} ${billingDate(data.paidThrough)}` : "No subscription charge. Your Free allowance is shared across this account."}</p><p>{data.cancelAtPeriodEnd ? "Renewal is off. Your confirmed paid period continues until the date above." : paid ? "Renews automatically unless you turn off renewal." : "The 3D trial is a single eligible-user allowance, not a monthly refill."}</p>{data.pendingPlanId && <p>Pending change: {getPlan(data.pendingPlanId).name}. Your confirmed plan remains shown above.</p>}</div><div className="billing-current-actions">{data.canManageBilling && data.portalAvailable && <button className="billing-button billing-button-secondary" disabled={Boolean(busy)} onClick={() => void perform("portal", () => createBillingPortal({ accountId: data.selectedAccountId }))}>{busy === "portal" ? "Opening…" : "Manage payment & invoices"}<ArrowUpRight size={15} aria-hidden="true" /></button>}{data.canManageBilling && activePaid && !data.cancelAtPeriodEnd && <button className="billing-button billing-button-secondary" disabled={Boolean(busy)} onClick={() => setConfirmCancel(true)}>Turn off renewal</button>}</div></section>
        {confirmCancel && <section className="billing-note" aria-labelledby="cancel-heading"><Info size={17} aria-hidden="true" /><div><p id="cancel-heading"><strong>Turn off renewal for {data.accountName}?</strong></p><p>Your paid plan continues through {billingDate(data.paidThrough)}. After that, Free limits apply and unused purchased packs pause until you reactivate a paid plan. This does not request a refund.</p><div className="billing-current-actions" style={{ marginTop: 14 }}><button type="button" className="billing-button" disabled={Boolean(busy)} onClick={() => void perform("cancel", () => cancelPlanRenewal({ accountId: data.selectedAccountId }))}>{busy === "cancel" ? "Updating…" : "Confirm: turn off renewal"}</button><button type="button" className="billing-button billing-button-secondary" disabled={Boolean(busy)} onClick={() => setConfirmCancel(false)}>Keep renewal on</button></div></div></section>}
        {feedback && <div className="billing-note billing-action-feedback" data-tone={feedback.error ? "error" : "success"} role={feedback.error ? "alert" : "status"}>{feedback.error ? <Info size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}<p>{feedback.message}</p></div>}
        <section className="billing-usage-grid" aria-label="Available allowances"><UsageCard title="AI credits" available={aiAvailable} included={plan.aiCredits} purchased={data.balances.ai.purchased} reserved={data.balances.ai.reserved} note={`Modes: ${plan.aiModes.map(mode => `${AI_MODES[mode].name} (${AI_MODES[mode].credits} ${AI_MODES[mode].credits === 1 ? "credit" : "credits"})`).join(", ")}.`} /><UsageCard title="Photoreal 3D generations" available={modelAvailable} included={plan.photorealGenerations} purchased={data.balances.photoreal.purchased} reserved={data.balances.photoreal.reserved} note={`Trial: ${data.balances.photoreal.trial > 0 ? `${data.balances.photoreal.trial} available` : "no unused trial available"}. One unit per successful standard model.`} /><article className="billing-usage"><h3>Your businesses & team</h3><p className="billing-usage-value"><strong>{data.usage.businesses}</strong><span>of {plan.limits.businesses} businesses</span></p><p>{data.usage.seats} of {plan.limits.seats} staff seats, including the owner.<br />{data.usage.offerings.toLocaleString("en-US")} of {plan.limits.offerings.toLocaleString("en-US")} published offerings.<br />Limits are shared within this billing account.</p></article></section>
        <div className="billing-note"><Info size={17} aria-hidden="true" /><div><p><strong>Service availability:</strong> AI {data.availability.ai ? "ready" : "currently unavailable"} · Photoreal 3D {data.availability.photoreal ? "ready" : "currently unavailable"} · Paid checkout {data.availability.billing ? "ready" : "currently unavailable"}.</p><p>Reserved units belong to work already accepted. AI and 3D balances are separate. {paid ? "Monthly units reset without rollover; purchased units do not expire while your account exists." : "Purchased packs pause on Free and resume with an active paid subscription."}</p><p>Knowledge: {data.usage.knowledgeSources.toLocaleString("en-US")} / {plan.limits.knowledgeSources.toLocaleString("en-US")} sources · {data.usage.knowledgeCharacters.toLocaleString("en-US")} / {plan.limits.knowledgeCharacters.toLocaleString("en-US")} extracted characters.<br />Storage: {storageSize(data.usage.storageBytes)} / {storageSize(plan.limits.storageBytes)}.</p></div></div>
        <section className="billing-section" aria-labelledby="billing-plans"><div className="billing-section-heading"><div><p className="billing-eyebrow">YOUR NEXT STEP</p><h2 id="billing-plans">Choose the room you need.</h2></div><p>Review the price and billing frequency before checkout. Your current plan stays in place until the change is confirmed.</p></div><PlanComparison key={`${data.selectedAccountId}-${data.planId}-${data.cadence}`} currentPlanId={data.planId} currentCadence={data.cadence} initialCadence={initialCadence || data.cadence} billingAvailable={data.availability.billing} canManage={data.canManageBilling} busy={Boolean(busy)} onChoose={choosePlan} /></section>
        <PlanFeatureMatrix />
        <section className="billing-section" id="packs" aria-labelledby="billing-packs"><div className="billing-section-heading"><div><p className="billing-eyebrow">FOR A BUSIER MONTH</p><h2 id="billing-packs">Add a one-time pack.</h2></div><p>Requires an active paid plan. No automatic renewal or automatic top-up.</p></div><div className="billing-pack-grid">{CREDIT_PACKS.map(pack => <article className="billing-pack" key={pack.id}><h3>{pack.name}</h3><div className="billing-pack-price"><strong>{dollars(pack.priceCents)}</strong><span>one time</span></div><p>{pack.unit === "AI" ? "Use with the modes in your plan. Separate from your 3D balance." : "One unit per successfully delivered standard textured model."}</p><button type="button" className="billing-button billing-button-secondary" disabled={Boolean(busy) || !data.canManageBilling || !activePaid || !data.availability.billing || !(pack.unit === "AI" ? data.availability.ai : data.availability.photoreal)} onClick={() => void perform(pack.id, () => createPackCheckout({ accountId: data.selectedAccountId, packId: pack.id }))}>{busy === pack.id ? "Opening…" : `Buy ${pack.name}`}</button></article>)}</div><p className="plan-footnote">Unused purchased units do not expire while the account exists. They pause when your account is on Free and resume after a paid plan is reactivated. Applicable taxes and final purchase terms are shown before payment.</p></section>
        {data.canManageBilling && Boolean(data.invoices?.length) && <section className="billing-section" aria-labelledby="billing-invoices"><div className="billing-section-heading"><h2 id="billing-invoices">Invoices</h2><p>Your confirmed platform billing history.</p></div><div className="billing-invoices">{data.invoices!.map(invoice => { const href = safeInvoiceUrl(invoice.url); return <article key={invoice.id}><div><h3>{billingDate(invoice.createdAt)}</h3><p>{invoice.status.replace(/_/g, " ")}</p></div><strong>{invoiceAmount(invoice.amountCents, invoice.currency)} <span>{invoice.currency.toUpperCase()}</span></strong>{href ? <a href={href} target="_blank" rel="noopener noreferrer">View invoice <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : <span className="billing-invoice-pending">Invoice link pending</span>}</article> })}</div></section>}
        <div className="billing-planned"><strong>Planned features are separate from your working tools.</strong><p>Custom domains, advanced automation, consolidated conversion reports and the platform API are planned. They are not currently live features of your plan.</p></div><nav className="billing-legal" aria-label="Billing help"><Link href="/pricing">Full plan details</Link><Link href="/terms">Terms</Link><Link href="/refund-policy">Cancellation and refunds</Link></nav>
    </main>
}
