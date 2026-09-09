import type { Plan, PlanId } from "./catalog"

/** Customer-facing value; prices and entitlements stay in the billing catalog. */
export const PLAN_POSITIONING: Record<PlanId, { audience: string; outcome: string; includes: string }> = {
    free: { audience: "GET YOUR BUSINESS ONLINE", outcome: "Your first page, enquiries and bookings in one place.", includes: "Your everyday essentials" },
    starter: { audience: "MAKE IT YOUR BRAND", outcome: "Your own look, a larger catalog and an assistant you can guide.", includes: "Everything in Free, plus" },
    pro: { audience: "GROW WITH A SMALL TEAM", outcome: "See what converts. Give your team the tools to follow through.", includes: "Everything in Starter, plus" },
    business: { audience: "RUN MULTIPLE BUSINESSES", outcome: "Separate businesses. The right people. One shared plan.", includes: "Everything in Pro, with" },
    scale: { audience: "MANAGE YOUR PORTFOLIO", outcome: "Bring your business group together with room for a larger team.", includes: "Everything in Business, with" },
}

export type PlanBenefit = { label: string; detail?: string }

export function planBenefits(plan: Plan): PlanBenefit[] {
    const number = (value: number) => value.toLocaleString("en-US")
    if (plan.id === "free") return [
        { label: "Your page, links & QR code" },
        { label: "Product & service listings" },
        { label: "Booking requests & availability" },
        { label: "Lead inbox, notes & follow-ups", detail: "Organize enquiries and set follow-up dates" },
        { label: "Visits & activity totals" },
    ]
    if (plan.id === "starter") return [
        ...(plan.features.customBranding ? [{ label: "Custom orb & brand styles" }, { label: "Remove the Introify footer" }] : []),
        ...(plan.features.customInstructions ? [{ label: "Your assistant, your instructions", detail: "Set how it answers about your business" }] : []),
        { label: `${number(plan.limits.offerings)} published offerings` },
        { label: `${number(plan.limits.knowledgeSources)} knowledge sources`, detail: "Give your assistant more business context" },
    ]
    if (plan.id === "pro") return [
        ...(plan.features.advancedAnalytics ? [{ label: "30-day trends & traffic sources" }, { label: "Conversion funnel overview" }] : []),
        ...(plan.features.team ? [{ label: "Individual team roles", detail: "Control who can manage your business" }] : []),
        ...(plan.features.autoMemory ? [{ label: "Private conversation memory", detail: "Short notes within a chat, with visitor consent" }] : []),
        { label: `${number(plan.limits.offerings)} published offerings` },
    ]
    return [
        { label: `${plan.limits.businesses} separate business workspaces` },
        { label: "Assign people by business", detail: "Business access stays separate from billing" },
        { label: "Shared AI & 3D allowances", detail: "Separate balances, used across your businesses" },
        { label: `${number(plan.limits.offerings)} published offerings`, detail: "Shared across your businesses" },
        { label: `${number(plan.limits.knowledgeSources)} knowledge sources` },
    ]
}
