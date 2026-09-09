"use client"

import Link from "@/components/navigation/transition-link"
import { useId, useState } from "react"
import { ArrowUpRight, Check, Info } from "lucide-react"
import { AI_MODES, PLANS, type BillingCadence, type PlanId } from "@/lib/billing/catalog"
import { dollars, storageSize } from "./format"
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
}

export function PlanComparison({ initialCadence = "monthly", currentPlanId, currentCadence, billingAvailable = false, canManage = true, busy = false, onChoose, compact = false }: PlanComparisonProps) {
    const [cadence, setCadence] = useState<BillingCadence>(initialCadence)
    const id = useId()
    return <div className="billing-design plan-comparison">
        <div className="plan-controls">
            <div className="plan-interval" role="group" aria-label="Billing frequency">
                <button type="button" aria-pressed={cadence === "monthly"} onClick={() => setCadence("monthly")}>Monthly</button>
                <button type="button" aria-pressed={cadence === "yearly"} onClick={() => setCadence("yearly")}>Annual <small>Save 10%</small></button>
            </div>
        </div>
        <div className="plan-grid">
            {PLANS.map(plan => {
                const free = plan.id === "free"
                const samePlan = currentPlanId === plan.id
                const current = samePlan && (free || !currentCadence || currentCadence === cadence)
                const price = cadence === "yearly" ? plan.yearlyCents / 12 : plan.monthlyCents
                const disabled = busy || !canManage || !billingAvailable || current || free
                const actionLabel = current ? "Current plan" : free ? "Switch to Free" : `Choose ${plan.name}`
                const message = onChoose ? (current ? "Your current subscription" : !canManage ? "Billing permission required" : free ? "Manage cancellation above" : !billingAvailable ? "Checkout is not available yet" : samePlan ? "Review billing frequency" : "Review before you pay") : free ? "No card required" : billingAvailable ? "Review before you pay" : "Check availability in billing"
                return <article className="plan-card" data-featured={plan.id === "pro"} key={plan.id} aria-labelledby={`${id}-${plan.id}`}>
                    <div className="plan-card-topline"><h3 id={`${id}-${plan.id}`}>{plan.name}</h3>{plan.id === "pro" && <span className="plan-badge">Room to grow</span>}</div>
                    <p className="plan-description">{plan.description}</p>
                    <div className="plan-price"><strong>{dollars(price)}</strong><span>/ month</span></div>
                    <p className="plan-bill">{free ? "Free. No subscription charge." : cadence === "yearly" ? `${dollars(plan.yearlyCents)} billed annually` : `${dollars(plan.monthlyCents)} billed monthly`}</p>
                    <hr />
                    <ul className="plan-benefits">
                        <li><Check aria-hidden="true" /><span><strong>{plan.aiCredits.toLocaleString("en-US")} AI credits</strong> / month<small>{plan.aiModes.map(mode => AI_MODES[mode].name).join(" + ")}</small></span></li>
                        <li><Check aria-hidden="true" /><span><strong>{free ? `${plan.freeTrialGenerations} trial 3D generation` : `${plan.photorealGenerations} 3D generations`}</strong><small>{free ? "Once per eligible user, not monthly" : "Every month, including annual plans"}</small></span></li>
                        <li><Check aria-hidden="true" /><span><strong>{plan.limits.businesses} {plan.limits.businesses === 1 ? "business" : "businesses"}</strong> · {plan.limits.seats} {plan.limits.seats === 1 ? "seat" : "seats"}<small>{plan.limits.businesses > 1 ? "Allowances shared across businesses" : "The owner counts as one seat"}</small></span></li>
                        {!compact && <><li><Check aria-hidden="true" /><span><strong>{plan.limits.offerings.toLocaleString("en-US")}</strong> published offerings</span></li><li><Check aria-hidden="true" /><span><strong>{plan.limits.knowledgeSources.toLocaleString("en-US")}</strong> knowledge sources<small>{plan.limits.knowledgeCharacters.toLocaleString("en-US")} extracted characters</small></span></li><li><Check aria-hidden="true" /><span><strong>{storageSize(plan.limits.storageBytes)}</strong> storage</span></li></>}
                    </ul>
                    {onChoose ? <button className="billing-button" type="button" disabled={disabled} onClick={() => onChoose(plan.id, cadence)}>{actionLabel}{!current && !free && <ArrowUpRight size={15} aria-hidden="true" />}</button> : <Link className="billing-button" href={free ? "/sign-up" : `/dashboard/billing?plan=${plan.id}&cadence=${cadence}`}>{free ? "Start free" : `Explore ${plan.name}`}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
                    <p className="plan-card-message">{message}</p>
                </article>
            })}
        </div>
        <p className="plan-footnote">Prices in USD. Applicable taxes are shown before payment. AI and 3D use separate allowances. Monthly included units reset without rollover; annual billing keeps a monthly allowance. No automatic overage purchases.</p>
        {!compact && !billingAvailable && <div className="billing-note" style={{ marginTop: 22 }}><Info size={17} aria-hidden="true" /><p><strong>Start with Free today.</strong> Paid checkout is not available yet. You can compare plans here; your billing dashboard shows when purchases and generation services are ready for your account.</p></div>}
    </div>
}
