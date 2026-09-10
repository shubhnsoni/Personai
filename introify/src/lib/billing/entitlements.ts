import { prisma } from "@/lib/prisma"
import { getPlan, isPlanId, type Plan, type PlanId } from "./catalog"
import { effectivePaidPlan } from "./periods"

export type PublicEntitlement = {
    planId: PlanId
    features: Plan["features"]
}

export async function lookupProfileEntitlement(profileId: string, now = new Date()): Promise<PublicEntitlement> {
    const free = { planId: "free" as const, features: getPlan("free").features }
    const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { billingAccountId: true } })
    if (!profile?.billingAccountId) return free
    const account = await prisma.billingAccount.findUnique({
        where: { id: profile.billingAccountId },
        select: { status: true, subscription: true },
    })
    if (!account || account.status !== "ACTIVE") return free
    const paid = effectivePaidPlan(account.subscription, now)
    const planId = paid && isPlanId(account.subscription?.planId) ? account.subscription.planId : "free"
    return { planId, features: getPlan(planId).features }
}
