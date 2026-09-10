import { describe, expect, it } from "vitest"
import { AI_MODES, canSelfServeCheckout, CREDIT_PACKS, getPlan, PUBLIC_PLANS } from "@/lib/billing/catalog"
import { allowanceWindow, anniversary, effectivePaidPlan } from "@/lib/billing/periods"

describe("subscription catalog and allowance boundaries", () => {
    it("publishes Free, Pro and Business, keeps historical Starter, and holds Scale for custom pricing", () => {
        expect(PUBLIC_PLANS.map(plan => plan.id)).toEqual(["free", "pro", "business"])
        expect(PUBLIC_PLANS.filter(plan => plan.recommended).map(plan => plan.id)).toEqual(["pro"])
        expect(getPlan("pro")).toMatchObject({ monthlyCents: 1900, yearlyCents: 19_000, aiCredits: 2000, photorealGenerations: 10, public: true })
        expect(getPlan("business")).toMatchObject({ monthlyCents: 4900, yearlyCents: 49_000, aiCredits: 7500, photorealGenerations: 30, public: true })
        for (const plan of PUBLIC_PLANS.filter(item => item.monthlyCents > 0)) expect(plan.yearlyCents).toBe(plan.monthlyCents * 10)
        expect(getPlan("free").yearlyCents).toBe(0)
        expect(getPlan("starter")).toMatchObject({ public: false, customPricing: false, monthlyCents: 1000, yearlyCents: 10_800, photorealGenerations: 3, aiModes: ["fast", "smart"] })
        expect(getPlan("scale")).toMatchObject({ public: false, customPricing: true })
        expect(canSelfServeCheckout(getPlan("pro"))).toBe(true)
        expect(canSelfServeCheckout(getPlan("business"))).toBe(true)
        expect(canSelfServeCheckout(getPlan("free"))).toBe(false)
        expect(canSelfServeCheckout(getPlan("starter"))).toBe(false)
        expect(canSelfServeCheckout(getPlan("scale"))).toBe(false)
        expect(getPlan("free").freeTrialGenerations).toBe(1)
        expect(getPlan("free").aiModes).toEqual(["fast"])
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
