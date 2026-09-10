import { isPlanId, type PlanId } from "@/lib/billing/catalog"

const COMPLIMENTARY_MS = 365 * 24 * 60 * 60 * 1000

export type AdminPlanWrite = {
    provider: "admin"
    planId: PlanId
    status: "FREE" | "ACTIVE"
    cadence: "monthly"
    paidThrough: Date | null
    periodStart: Date | null
    periodEnd: Date | null
    allowanceAnchor: Date
    cancelAtPeriodEnd: false
    pendingPlanId: null
    providerSubscriptionId: null
    providerPriceId: null
}

export function adminPlanWrite(planId: PlanId, now: Date): AdminPlanWrite {
    if (!isPlanId(planId)) throw new Error("Unknown Introify plan")
    if (planId === "free") {
        return {
            provider: "admin",
            planId,
            status: "FREE",
            cadence: "monthly",
            paidThrough: null,
            periodStart: null,
            periodEnd: null,
            allowanceAnchor: now,
            cancelAtPeriodEnd: false,
            pendingPlanId: null,
            providerSubscriptionId: null,
            providerPriceId: null,
        }
    }
    const paidThrough = new Date(now.getTime() + COMPLIMENTARY_MS)
    return {
        provider: "admin",
        planId,
        status: "ACTIVE",
        cadence: "monthly",
        paidThrough,
        periodStart: now,
        periodEnd: paidThrough,
        allowanceAnchor: now,
        cancelAtPeriodEnd: false,
        pendingPlanId: null,
        providerSubscriptionId: null,
        providerPriceId: null,
    }
}
