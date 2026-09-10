import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BillingActionResult, BillingDashboard } from "@/lib/billing/types"

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), plan: vi.fn(), pack: vi.fn(), portal: vi.fn(), cancel: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock("@/app/actions/billing", () => ({ createPlanCheckout: mocks.plan, createPackCheckout: mocks.pack, createBillingPortal: mocks.portal, cancelPlanRenewal: mocks.cancel }))
import { BillingSettings } from "@/components/billing/billing-settings"

function account(overrides: Partial<BillingDashboard> = {}): BillingDashboard {
    return {
        accounts: [{ id: "account-one", name: "Studio account", planId: "free" }, { id: "account-two", name: "Cafe account", planId: "pro" }],
        selectedAccountId: "account-one", accountName: "Studio account", role: "OWNER", canManageBilling: true,
        planId: "free", cadence: "monthly", status: "active", paidThrough: null, cancelAtPeriodEnd: false,
        balances: { ai: { monthly: 43, purchased: 0, reserved: 2 }, photoreal: { monthly: 0, purchased: 0, reserved: 0, trial: 1 } },
        usage: { businesses: 1, seats: 1, offerings: 2, knowledgeSources: 1, knowledgeCharacters: 200, storageBytes: 0 },
        availability: { billing: true, ai: true, photoreal: true }, portalAvailable: false,
        ...overrides,
    }
}

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.plan.mockResolvedValue({ error: "Checkout is temporarily unavailable. Your plan has not changed." })
    mocks.pack.mockResolvedValue({ error: "The purchase could not be started." })
    mocks.portal.mockResolvedValue({ error: "The payment portal is unavailable." })
    mocks.cancel.mockResolvedValue({ success: true, message: "Renewal is now off." })
})

describe("billing account settings", () => {
    it("shows confirmed Free balances after a checkout return without granting a plan or spending anything", () => {
        render(<BillingSettings data={account()} checkoutReturn="success" />)
        expect(screen.getByRole("heading", { name: /Free · active/ })).toBeTruthy()
        const ai = screen.getByRole("heading", { name: "AI credits" }).closest("article")!
        expect(within(ai).getByText("43")).toBeTruthy()
        expect(screen.getByText(/update only after payment is verified/)).toBeTruthy()
        expect(mocks.plan).not.toHaveBeenCalled()
        expect(mocks.pack).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
        expect(mocks.refresh).toHaveBeenCalledOnce()
    })

    it("keeps a member read-only even when checkout and an active paid plan exist", () => {
        render(<BillingSettings data={account({ planId: "pro", canManageBilling: false, role: "MEMBER", portalAvailable: true })} />)
        expect(screen.queryByRole("button", { name: "Turn off renewal" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Manage payment & invoices" })).toBeNull()
        for (const button of screen.getAllByRole<HTMLButtonElement>("button", { name: /^(Choose|Buy)/ })) expect(button.disabled).toBe(true)
        expect(screen.getByText(/A billing owner or billing administrator can change the plan/)).toBeTruthy()
    })

    it("sends the selected account and annual cadence, prevents duplicate clicks and preserves the confirmed plan on error", async () => {
        let finish!: (value: BillingActionResult) => void
        mocks.plan.mockReturnValue(new Promise<BillingActionResult>(resolve => { finish = resolve }))
        render(<BillingSettings data={account()} />)
        fireEvent.click(screen.getByRole("button", { name: /Annual/ }))
        const choose = screen.getByRole<HTMLButtonElement>("button", { name: "Choose Pro" })
        fireEvent.click(choose)
        fireEvent.click(choose)
        expect(mocks.plan).toHaveBeenCalledExactlyOnceWith({ accountId: "account-one", planId: "pro", cadence: "yearly" })
        expect(choose.disabled).toBe(true)
        await act(async () => finish({ error: "Payment setup is unavailable. Your plan has not changed." }))
        expect(screen.getByRole("alert").textContent).toContain("Your plan has not changed")
        expect(screen.getByRole("heading", { name: /Free · active/ })).toBeTruthy()
        expect(mocks.refresh).not.toHaveBeenCalled()
    })

    it("requires an explicit review before switching off renewal and sends only the current account", async () => {
        render(<BillingSettings data={account({ planId: "pro", paidThrough: "2026-10-09T00:00:00.000Z" })} />)
        fireEvent.click(screen.getByRole("button", { name: "Turn off renewal" }))
        expect(mocks.cancel).not.toHaveBeenCalled()
        const review = screen.getByRole("region", { name: "Turn off renewal for Studio account?" })
        expect(within(review).getByText(/This does not request a refund/)).toBeTruthy()
        fireEvent.click(within(review).getByRole("button", { name: "Keep renewal on" }))
        expect(screen.queryByRole("region", { name: "Turn off renewal for Studio account?" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Turn off renewal" }))
        fireEvent.click(screen.getByRole("button", { name: "Confirm: turn off renewal" }))
        await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Renewal is now off"))
        expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith({ accountId: "account-one" })
        expect(mocks.refresh).toHaveBeenCalledOnce()
    })

    it("shows a cancelled renewal without offering to cancel it again", () => {
        render(<BillingSettings data={account({ planId: "pro", cancelAtPeriodEnd: true, paidThrough: "2026-10-09T00:00:00.000Z" })} />)
        expect(screen.getByText(/Renewal is off/)).toBeTruthy()
        expect(screen.queryByRole("button", { name: "Turn off renewal" })).toBeNull()
    })

    it("pauses purchased units on Free and prevents pack purchases while service is unavailable", () => {
        const balances = { ai: { monthly: 10, purchased: 1000, reserved: 0 }, photoreal: { monthly: 0, purchased: 10, reserved: 0, trial: 0 } }
        const view = render(<BillingSettings data={account({ balances })} />)
        const ai = screen.getByRole("heading", { name: "AI credits" }).closest("article")!
        expect(within(ai).getByText("10")).toBeTruthy()
        expect(within(ai).queryByText("1,010")).toBeNull()
        expect(screen.getByText(/Purchased packs pause on Free/)).toBeTruthy()
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Buy 10 photoreal generations" }).disabled).toBe(true)
        view.rerender(<BillingSettings data={account({ planId: "pro", availability: { billing: true, ai: true, photoreal: false } })} />)
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Buy 10 photoreal generations" }).disabled).toBe(true)
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Buy 1,000 AI credits" }).disabled).toBe(false)
    })

    it("uses catalog pack identifiers without sending a client-controlled price", async () => {
        render(<BillingSettings data={account({ planId: "pro" })} />)
        fireEvent.click(screen.getByRole("button", { name: "Buy 10 photoreal generations" }))
        await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy())
        expect(mocks.pack).toHaveBeenCalledExactlyOnceWith({ accountId: "account-one", packId: "3d-10" })
    })

    it("navigates to the selected account without mutating billing", () => {
        render(<BillingSettings data={account()} />)
        fireEvent.change(screen.getByRole("combobox", { name: "Billing account" }), { target: { value: "account-two" } })
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/dashboard/billing?accountId=account-two")
        expect(mocks.plan).not.toHaveBeenCalled()
        expect(mocks.cancel).not.toHaveBeenCalled()
    })

    it("shows invoice history only to billing managers and accepts only secure invoice links", () => {
        const invoices = [
            { id: "invoice-one", amountCents: 1200, currency: "jpy", status: "PAID", createdAt: "2026-09-09T00:00:00Z", url: "https://invoice.stripe.com/example" },
            { id: "invoice-two", amountCents: 1000, currency: "usd", status: "OPEN", createdAt: "2026-09-08T00:00:00Z", url: "javascript:alert(1)" },
        ]
        const view = render(<BillingSettings data={account({ invoices })} />)
        const region = screen.getByRole("region", { name: "Invoices" })
        expect(within(region).getAllByRole("link")).toHaveLength(1)
        expect(within(region).getByRole("link").getAttribute("href")).toBe("https://invoice.stripe.com/example")
        expect(within(region).getByText(/¥1,200/)).toBeTruthy()
        expect(within(region).getByText("Invoice link pending")).toBeTruthy()
        view.rerender(<BillingSettings data={account({ invoices, canManageBilling: false })} />)
        expect(screen.queryByRole("region", { name: "Invoices" })).toBeNull()
    })
})
