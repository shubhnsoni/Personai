"use client"

import Link from "@/components/navigation/transition-link"
import { useId, useState } from "react"
import { ArrowUpRight, Check, Info } from "lucide-react"
import { AI_MODES, PLANS, type BillingCadence, type PlanId } from "@/lib/billing/catalog"
import { planBenefits, planPositioning } from "@/lib/billing/presentation"
import { dollars, storageSize } from "./format"
import { fill, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"
import "./billing.css"

type PlanComparisonProps = {
    initialCadence?: BillingCadence
    currentPlanId?: PlanId
    currentCadence?: BillingCadence | null
    billingAvailable?: boolean
    canManage?: boolean
    busy?: boolean
    onChoose?: (planId: PlanId, cadence: BillingCadence) => void
    compact?: boolean
    locale?: UiLocale
}

export function PlanComparison({ initialCadence = "monthly", currentPlanId, currentCadence, billingAvailable = false, canManage = true, busy = false, onChoose, compact = false, locale = "en" }: PlanComparisonProps) {
    const [cadence, setCadence] = useState<BillingCadence>(initialCadence)
    const id = useId()
    const copy = messagesFor(locale).pricing
    const digits = locale === "hi" ? "hi-IN" : "en-US"
    return <div className="billing-design plan-comparison">
        <div className="plan-controls">
            <div className="plan-interval" role="group" aria-label={copy.frequency}>
                <button type="button" aria-pressed={cadence === "monthly"} onClick={() => setCadence("monthly")}>{copy.monthly}</button>
                <button type="button" aria-pressed={cadence === "yearly"} onClick={() => setCadence("yearly")}>{copy.annual} <small>{copy.save}</small></button>
            </div>
        </div>
        <div className="plan-grid">
            {PLANS.map(plan => {
                const positioning = planPositioning(plan.id, locale)
                const free = plan.id === "free"
                const samePlan = currentPlanId === plan.id
                const current = samePlan && (free || !currentCadence || currentCadence === cadence)
                const price = cadence === "yearly" ? plan.yearlyCents / 12 : plan.monthlyCents
                const disabled = busy || !canManage || !billingAvailable || current || free
                const actionLabel = current ? copy.currentPlan : free ? copy.switchToFree : fill(copy.choosePlan, { name: plan.name })
                const message = onChoose ? (current ? copy.currentSub : !canManage ? copy.billingPermission : free ? copy.manageCancel : !billingAvailable ? copy.checkoutSoon : samePlan ? copy.reviewFrequency : copy.reviewPay) : free ? copy.noCard : billingAvailable ? copy.reviewPay : copy.checkBilling
                return <article className="plan-card" data-featured={plan.id === "pro"} key={plan.id} aria-labelledby={`${id}-${plan.id}`}>
                    <p className="plan-audience">{positioning.audience}</p>
                    <div className="plan-card-topline"><h3 id={`${id}-${plan.id}`}>{plan.name}</h3>{plan.id === "pro" && <span className="plan-badge">{copy.badge}</span>}</div>
                    <p className="plan-description">{positioning.outcome}</p>
                    <div className="plan-price"><strong>{dollars(price)}</strong><span>{copy.perMonth}</span></div>
                    <p className="plan-bill">{free ? copy.freeBill : cadence === "yearly" ? fill(copy.billedAnnually, { price: dollars(plan.yearlyCents) }) : fill(copy.billedMonthly, { price: dollars(plan.monthlyCents) })}</p>
                    <hr />
                    <p className="plan-includes">{positioning.includes}</p>
                    <ul className="plan-benefits plan-value-benefits" aria-label={`${plan.name} features`}>
                        {planBenefits(plan, locale).map(benefit => <li key={benefit.label}><Check aria-hidden="true" /><span>{benefit.label}{benefit.detail && <small>{benefit.detail}</small>}</span></li>)}
                    </ul>
                    <div className="plan-allowance-heading">{copy.capacity}</div>
                    <ul className="plan-benefits plan-allowances" aria-label={`${plan.name} allowances`}>
                        <li><Check aria-hidden="true" /><span><strong>{fill(copy.creditsMonth, { n: plan.aiCredits.toLocaleString(digits) })}</strong> {copy.perMonthWord}<small>{plan.aiModes.map(mode => AI_MODES[mode].name).join(" + ")}</small></span></li>
                        <li><Check aria-hidden="true" /><span><strong>{free ? fill(copy.trial3d, { n: plan.freeTrialGenerations }) : fill(copy.gens3d, { n: plan.photorealGenerations })}</strong><small>{free ? copy.trialOnce : copy.gensMonthly}</small></span></li>
                        <li><Check aria-hidden="true" /><span><strong>{fill(plan.limits.businesses === 1 ? copy.businessOne : copy.businessMany, { n: plan.limits.businesses })}</strong> · {fill(plan.limits.seats === 1 ? copy.seatOne : copy.seatMany, { n: plan.limits.seats })}<small>{plan.limits.businesses > 1 ? copy.sharedAllow : copy.ownerSeat}</small></span></li>
                        {!compact && <li><Check aria-hidden="true" /><span><strong>{storageSize(plan.limits.storageBytes)}</strong> {copy.storage}<small>{fill(copy.knowledgeLine, { sources: plan.limits.knowledgeSources.toLocaleString(digits), chars: plan.limits.knowledgeCharacters.toLocaleString(digits) })}</small></span></li>}
                    </ul>
                    {plan.id === "free" && <p className="plan-limit-note">{fill(copy.publishUpTo, { n: plan.limits.offerings })}</p>}
                    {onChoose ? <button className="billing-button" type="button" disabled={disabled} onClick={() => onChoose(plan.id, cadence)}>{actionLabel}{!current && !free && <ArrowUpRight size={15} aria-hidden="true" />}</button> : <Link className="billing-button" href={free ? "/sign-up" : `/dashboard/billing?plan=${plan.id}&cadence=${cadence}`}>{free ? copy.startFree : fill(copy.explorePlan, { name: plan.name })}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
                    <p className="plan-card-message">{message}</p>
                </article>
            })}
        </div>
        <p className="plan-footnote">{copy.footnote}</p>
        {!compact && !billingAvailable && <div className="billing-note" style={{ marginTop: 22 }}><Info size={17} aria-hidden="true" /><p><strong>{copy.startFreeToday}</strong> {copy.checkoutNote}</p></div>}
    </div>
}
