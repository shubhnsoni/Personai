// @vitest-environment node
import { describe, expect, it } from "vitest"
import { adminPlanWrite } from "@/lib/admin/plan-grant"
import { PLAN_CATALOG } from "@/lib/billing/catalog"

describe("admin complimentary plan assignment", () => {
    const now = new Date("2026-09-10T12:00:00.000Z")

    it("demotes to Free without inventing a paid-through date", () => {
        expect(adminPlanWrite("free", now)).toEqual({
            provider: "admin",
            planId: "free",
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
        })
    })

    it("can promote to every catalog plan including retired and custom ones", () => {
        for (const plan of Object.values(PLAN_CATALOG)) {
            if (plan.id === "free") continue
            const write = adminPlanWrite(plan.id, now)
            expect(write.provider).toBe("admin")
            expect(write.planId).toBe(plan.id)
            expect(write.status).toBe("ACTIVE")
            expect(write.paidThrough?.toISOString()).toBe("2027-09-10T12:00:00.000Z")
            expect(write.allowanceAnchor).toEqual(now)
        }
    })
})
