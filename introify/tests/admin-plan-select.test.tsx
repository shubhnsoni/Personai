import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PLANS } from "@/lib/billing/catalog"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/app/actions/admin", () => ({
    publishShop: vi.fn(),
    setShopAiOverride: vi.fn(),
    setUserPlan: vi.fn(),
    setUserRole: vi.fn(),
    startImpersonate: vi.fn(),
    stopImpersonate: vi.fn(),
    suspendShop: vi.fn(),
    suspendUser: vi.fn(),
    unpublishShop: vi.fn(),
    unsuspendShop: vi.fn(),
    unsuspendUser: vi.fn(),
}))

const { UserPlanSelect } = await import("@/components/admin/admin-actions")

describe("admin plan picker", () => {
    it("lets an admin assign Free, Pro or any catalog plan", () => {
        render(<UserPlanSelect userId="user_1" planId="free" />)
        const select = screen.getByLabelText("Assign plan")
        for (const plan of PLANS) {
            expect(select.querySelector(`option[value="${plan.id}"]`)?.textContent).toBe(plan.name)
        }
        expect(PLANS.map((plan) => plan.id)).toEqual(["free", "starter", "pro", "business", "scale"])
    })
})
