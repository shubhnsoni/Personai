"use client"

import Link from "@/components/navigation/transition-link"
import { useId, useState } from "react"
import { ArrowUpRight, Check, Info } from "lucide-react"
import { highestPublicLimit, PLANS, PUBLIC_PLANS, type BillingCadence, type Plan, type PlanId } from "@/lib/billing/catalog"
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

function planActionLabel(plan: Plan, current: boolean, billingAvailable: boolean, managed: boolean, copy: ReturnType<typeof messagesFor>["pricing"]) {
    if (current) return copy.currentPlan
    if (plan.id === "free") return managed ? copy.switchToFree : copy.startFree
    if (!billingAvailable) return fill(copy.viewPlan, { name: plan.name })
    return fill(copy.choosePlan, { name: plan.name })
}

export function PlanComparison({ initialCadence = "monthly", currentPlanId, currentCadence, billingAvailable = false, canManage = true, busy = false, onChoose, compact = false, locale = "en" }: PlanComparisonProps) {
    const [cadence, setCadence] = useState<BillingCadence>(initialCadence)
    const id = useId()
    const copy = messagesFor(locale).pricing
    const digits = locale === "hi" ? "hi-IN" : "en-US"
    const scale = PLANS.find(plan => plan.customPricing && !plan.public)
    const publicBusinessCap = highestPublicLimit("businesses")
    return <div className="billing-design plan-comparison">
        {!compact && !billingAvailable && <div className="billing-note plan-launch-note"><Info size={17} aria-hidden="true" /><div><p><strong>{copy.startFreeToday}</strong></p><p>{copy.checkoutNote}</p></div></div>}
        <div className="plan-controls">
            <div className="plan-interval" role="group" aria-label={copy.frequency}>
                <button type="button" aria-pressed={cadence === "monthly"} onClick={() => setCadence("monthly")}>{copy.monthly}</button>
                <button type="button" aria-pressed={cadence === "yearly"} onClick={() => setCadence("yearly")}>{copy.annual} <small>{copy.save}</small></button>
            </div>
        </div>
        <p className="plan-save-hint">{copy.saveHint}</p>
        <div className="plan-grid">
            {PUBLIC_PLANS.map(plan => {
                const positioning = planPositioning(plan.id, locale)
                const free = plan.id === "free"
                const samePlan = currentPlanId === plan.id
                const current = samePlan && (free || !currentCadence || currentCadence === cadence)
                const displayCents = cadence === "yearly" ? plan.yearlyCents / 12 : plan.monthlyCents
                const disabled = busy || !canManage || !billingAvailable || current || free
                const actionLabel = planActionLabel(plan, current, billingAvailable, Boolean(onChoose), copy)
                const message = onChoose ? (current ? copy.currentSub : !canManage ? copy.billingPermission : free ? copy.manageCancel : !billingAvailable ? copy.checkoutSoon : samePlan ? copy.reviewFrequency : copy.reviewPay) : free ? copy.noCard : billingAvailable ? copy.reviewPay : copy.checkBilling
                const bill = free ? copy.freeBill : cadence === "yearly" ? fill(copy.equivalentMonthly, { price: dollars(plan.yearlyCents / 12) }) : fill(copy.billedMonthly, { price: dollars(plan.monthlyCents) })
                return <article className="plan-card" data-featured={plan.recommended} data-plan={plan.id} key={plan.id} aria-labelledby={`${id}-${plan.id}`}>
                    <p className="plan-audience">{positioning.audience}</p>
                    <div className="plan-card-topline"><h3 id={`${id}-${plan.id}`}>{plan.name}</h3>{plan.recommended && <span className="plan-badge">{copy.badge}</span>}</div>
                    <p className="plan-description">{positioning.outcome}</p>
                    <div className="plan-price"><strong>{dollars(displayCents)}</strong><span>{copy.perMonth}</span></div>
                    <p className="plan-bill">{bill}</p>
                    <hr />
                    <p className="plan-includes">{positioning.includes}</p>
                    <ul className="plan-benefits plan-value-benefits" aria-label={`${plan.name} features`}>
                        {planBenefits(plan, locale).map(benefit => <li key={benefit.label}><Check aria-hidden="true" /><span><span>{benefit.label}</span>{benefit.detail && <small>{benefit.detail}</small>}</span></li>)}
                        {!compact && <li><Check aria-hidden="true" /><span><strong>{storageSize(plan.limits.storageBytes)}</strong> {copy.storage}<small>{fill(copy.knowledgeLine, { sources: plan.limits.knowledgeSources.toLocaleString(digits), chars: plan.limits.knowledgeCharacters.toLocaleString(digits) })}</small></span></li>}
                    </ul>
                    {onChoose ? <button className="billing-button" type="button" disabled={disabled} onClick={() => onChoose(plan.id, cadence)}>{actionLabel}{!current && !free && <ArrowUpRight size={15} aria-hidden="true" />}</button> : <Link className="billing-button" href={free ? "/sign-up" : `/dashboard/billing?plan=${plan.id}&cadence=${cadence}`}>{actionLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
                    <p className="plan-card-message">{message}</p>
                </article>
            })}
        </div>
        {scale && <aside className="plan-scale-cta" aria-label={scale.name}>
            <p><strong>{copy.scaleNeedMore}</strong> {fill(copy.scaleBody, { n: publicBusinessCap })} <Link href="/contact">{copy.scaleCta}</Link></p>
        </aside>}
        <div className="plan-ai-help">
            <details>
                <summary>{copy.aiUsageLink}</summary>
                <p>{copy.aiUsageHelp}</p>
            </details>
        </div>
        <p className="plan-footnote">{copy.footnote}</p>
    </div>
}
