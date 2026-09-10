import type { Plan, PlanId } from "./catalog"
import { fill, type UiLocale } from "../ui-locale"
import { messagesFor } from "../ui-messages"

/** Customer-facing value; prices and entitlements stay in the billing catalog. */
export const PLAN_POSITIONING: Record<PlanId, { audience: string; outcome: string; includes: string }> = {
    free: { audience: "GET YOUR BUSINESS ONLINE", outcome: "Your first page, enquiries and bookings in one place.", includes: "Your everyday essentials" },
    starter: { audience: "MAKE IT YOUR BRAND", outcome: "Your own look, a larger catalog and an assistant you can guide.", includes: "Everything in Free, plus" },
    pro: { audience: "GROW WITH A SMALL TEAM", outcome: "See what converts. Give your team the tools to follow through.", includes: "Everything in Starter, plus" },
    business: { audience: "RUN MULTIPLE BUSINESSES", outcome: "Separate businesses. The right people. One shared plan.", includes: "Everything in Pro, with" },
    scale: { audience: "MANAGE YOUR PORTFOLIO", outcome: "Bring your business group together with room for a larger team.", includes: "Everything in Business, with" },
}

export function planPositioning(planId: PlanId, locale: UiLocale = "en") {
    return messagesFor(locale).pricing.positioning[planId]
}

export type PlanBenefit = { label: string; detail?: string }

export function planBenefits(plan: Plan, locale: UiLocale = "en"): PlanBenefit[] {
    const number = (value: number) => value.toLocaleString(locale === "hi" ? "hi-IN" : "en-US")
    const b = messagesFor(locale).pricing.benefits
    if (plan.id === "free") return [
        { label: b.pageLinksQr },
        { label: b.listings },
        { label: b.bookingRequests },
        { label: b.leadInbox, detail: b.leadInboxDetail },
        { label: b.visitTotals },
    ]
    if (plan.id === "starter") return [
        ...(plan.features.customBranding ? [{ label: b.customOrb }, { label: b.removeFooter }] : []),
        ...(plan.features.customInstructions ? [{ label: b.assistant, detail: b.assistantDetail }] : []),
        { label: fill(b.offerings, { n: number(plan.limits.offerings) }) },
        { label: fill(b.knowledge, { n: number(plan.limits.knowledgeSources) }), detail: b.knowledgeDetail },
    ]
    if (plan.id === "pro") return [
        ...(plan.features.advancedAnalytics ? [{ label: b.trends }, { label: b.funnel }] : []),
        ...(plan.features.team ? [{ label: b.teamRoles, detail: b.teamRolesDetail }] : []),
        ...(plan.features.autoMemory ? [{ label: b.memory, detail: b.memoryDetail }] : []),
        { label: fill(b.offerings, { n: number(plan.limits.offerings) }) },
    ]
    return [
        { label: fill(b.workspaces, { n: plan.limits.businesses }) },
        { label: b.assignPeople, detail: b.assignDetail },
        { label: b.sharedAi, detail: b.sharedAiDetail },
        { label: fill(b.offerings, { n: number(plan.limits.offerings) }), detail: b.offeringsSharedDetail },
        { label: fill(b.knowledge, { n: number(plan.limits.knowledgeSources) }) },
    ]
}
