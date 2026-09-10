import type { Plan, PlanId } from "./catalog"
import { fill, type UiLocale } from "../ui-locale"
import { messagesFor } from "../ui-messages"

/** Customer-facing value; prices and entitlements stay in the billing catalog. */
export const PLAN_POSITIONING: Record<PlanId, { audience: string; outcome: string; includes: string }> = {
    free: { audience: "FOR TRYING INTROIFY", outcome: "A first page, enquiries and bookings without a card.", includes: "Your everyday essentials" },
    starter: { audience: "RETIRED PLAN", outcome: "Existing Starter subscriptions keep their recorded entitlements.", includes: "Recorded Starter allowance" },
    pro: { audience: "FOR CREATORS, PROFESSIONALS AND SOLO BUSINESSES", outcome: "The default home for a professional page, team seats and full AI.", includes: "Everything in Free, plus" },
    business: { audience: "FOR TEAMS AND MULTIPLE BRANDS", outcome: "Several businesses, more seats and higher AI and 3D room.", includes: "Everything in Pro, with" },
    scale: { audience: "NEED MORE?", outcome: "More than five businesses, larger teams or higher AI usage.", includes: "Custom pricing" },
}

export function planPositioning(planId: PlanId, locale: UiLocale = "en") {
    return messagesFor(locale).pricing.positioning[planId]
}

export type PlanBenefit = { label: string; detail?: string }

export function planBenefits(plan: Plan, locale: UiLocale = "en"): PlanBenefit[] {
    const number = (value: number) => value.toLocaleString(locale === "hi" ? "hi-IN" : "en-US")
    const copy = messagesFor(locale).pricing
    const b = copy.benefits
    const aiModes = plan.aiModes.map(mode => mode[0].toUpperCase() + mode.slice(1)).join(" + ")
    return [
        { label: fill(plan.limits.businesses === 1 ? copy.businessOne : copy.businessMany, { n: plan.limits.businesses }) },
        { label: fill(plan.limits.seats === 1 ? copy.seatOne : copy.seatMany, { n: plan.limits.seats }) },
        { label: fill(copy.creditsMonthFull, { n: number(plan.aiCredits) }), detail: plan.aiUsageHint },
        { label: fill(b.offerings, { n: number(plan.limits.offerings) }) },
        { label: fill(copy.aiModesLine, { modes: aiModes }) },
        plan.freeTrialGenerations
            ? { label: fill(copy.trial3d, { n: plan.freeTrialGenerations }), detail: copy.trialOnce }
            : { label: fill(copy.gens3d, { n: plan.photorealGenerations }), detail: copy.gensMonthly },
    ]
}
