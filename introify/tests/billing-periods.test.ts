import { describe, expect, it } from "vitest"
import { AI_MODES, CREDIT_PACKS, getPlan, PLANS } from "@/lib/billing/catalog"
import { allowanceWindow, anniversary, effectivePaidPlan } from "@/lib/billing/periods"

describe("subscription catalog and allowance boundaries", () => {
    it("includes Free and the four requested prices with 10% annual savings", () => {
        expect(PLANS.map(plan => plan.monthlyCents)).toEqual([0, 1000, 2000, 4000, 10000])
        for (const plan of PLANS) expect(plan.yearlyCents).toBe(plan.monthlyCents * 12 * 0.9)
        expect(getPlan("free").freeTrialGenerations).toBe(1)
        expect(getPlan("starter").photorealGenerations).toBe(3)
        expect(getPlan("pro").photorealGenerations).toBe(10)
        expect(getPlan("free").aiModes).toEqual(["fast"])
        expect(getPlan("starter").aiModes).toEqual(["fast", "smart"])
        expect(Object.values(AI_MODES).map(mode => mode.credits)).toEqual([1, 20, 40])
        expect(CREDIT_PACKS.find(pack => pack.id === "3d-100")?.amount).toBe(100)
        expect(() => getPlan("enterprise-free-unlimited")).toThrow()
    })
    it("restores the 31st after February without anniversary drift", () => {
        const anchor = new Date("2026-01-31T12:30:45.000Z")
        expect(anniversary(anchor, 1).toISOString()).toBe("2026-02-28T12:30:45.000Z")
        expect(anniversary(anchor, 2).toISOString()).toBe("2026-03-31T12:30:45.000Z")
        expect(allowanceWindow(anchor, new Date("2026-03-30T12:00:00Z")).start.toISOString()).toBe("2026-02-28T12:30:45.000Z")
    })
    it("handles leap years and caps the final monthly grant at paid-through", () => {
        const anchor = new Date("2024-02-29T00:00:00Z")
        expect(anniversary(anchor, 12).toISOString()).toBe("2025-02-28T00:00:00.000Z")
        const end = new Date("2026-09-15T12:00:00Z")
        expect(allowanceWindow(new Date("2026-01-31T00:00:00Z"), new Date("2026-09-09T00:00:00Z"), end).end).toEqual(end)
    })
    it("annual billing gives the current monthly window rather than a year of credits", () => {
        const window = allowanceWindow(new Date("2026-01-09T10:00:00Z"), new Date("2026-09-09T11:00:00Z"), new Date("2027-01-09T10:00:00Z"))
        expect(window.start.toISOString()).toBe("2026-09-09T10:00:00.000Z")
        expect(window.end.toISOString()).toBe("2026-10-09T10:00:00.000Z")
    })
    it("keeps paid cancellation access only through confirmed coverage", () => {
        const now = new Date("2026-09-09T00:00:00Z")
        const subscription = { planId: "pro", status: "CANCELED", paidThrough: new Date("2026-09-10T00:00:00Z") }
        expect(effectivePaidPlan(subscription, now)).toBe(true)
        expect(effectivePaidPlan(subscription, subscription.paidThrough)).toBe(false)
        expect(effectivePaidPlan({ ...subscription, status: "INCOMPLETE" }, now)).toBe(false)
    })
})
