// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
    profile: { findUnique: vi.fn() },
    billingAccount: { findUnique: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma: db }))
vi.mock("@/lib/billing/service", () => ({
    ensureDefaultBillingAccount: vi.fn(async () => { throw new Error("public pages must not create billing accounts") }),
    getProfileBilling: vi.fn(async () => { throw new Error("public pages must not initialize billing") }),
    getAccountBilling: vi.fn(async () => { throw new Error("public pages must not backfill storage") }),
}))

const { lookupProfileEntitlement } = await import("@/lib/billing/entitlements")
const service = await import("@/lib/billing/service")

describe("read-only public entitlement lookup", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns Free without creating an account when no billing row is linked", async () => {
        db.profile.findUnique.mockResolvedValue({ billingAccountId: null })
        const entitlement = await lookupProfileEntitlement("shop")
        expect(entitlement.planId).toBe("free")
        expect(entitlement.features.customBranding).toBe(false)
        expect(db.billingAccount.findUnique).not.toHaveBeenCalled()
        expect(service.ensureDefaultBillingAccount).not.toHaveBeenCalled()
        expect(service.getProfileBilling).not.toHaveBeenCalled()
        expect(service.getAccountBilling).not.toHaveBeenCalled()
    })

    it("reads an existing paid plan without storage backfill", async () => {
        db.profile.findUnique.mockResolvedValue({ billingAccountId: "acct" })
        db.billingAccount.findUnique.mockResolvedValue({
            status: "ACTIVE",
            subscription: { planId: "pro", status: "ACTIVE", paidThrough: new Date("2099-01-01T00:00:00.000Z") },
        })
        const entitlement = await lookupProfileEntitlement("shop")
        expect(entitlement.planId).toBe("pro")
        expect(entitlement.features.customBranding).toBe(true)
        expect(service.getAccountBilling).not.toHaveBeenCalled()
    })
})
