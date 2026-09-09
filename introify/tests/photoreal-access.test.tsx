import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
    access: vi.fn(), products: vi.fn(), jobs: vi.fn(), enqueue: vi.fn(), list: vi.fn(), billing: vi.fn(), balances: vi.fn(),
    enabled: false, writable: true,
}))
vi.mock("@/lib/security", () => ({
    requireProfileAccess: mocks.access,
    unwrapOwnershipResult: (result: { ok: boolean; value?: unknown }) => { if (!result.ok) throw new Error("access_refused"); return result.value },
}))
vi.mock("@/lib/prisma", () => ({ prisma: { digitalProduct: { findMany: mocks.products }, arBuild: { findMany: mocks.jobs } } }))
vi.mock("@/lib/billing/config", () => ({ photorealAvailable: () => mocks.enabled }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: mocks.billing, getAccountBalances: mocks.balances }))
vi.mock("@/lib/ar-builds", () => ({ enqueueArBatch: mocks.enqueue, listBatch: mocks.list, photoForProduct: () => "/uploads/owned/photo.jpg", isOwnedProductPhoto: () => true, publicBuild: (row: unknown) => row }))

import { getArBatch, pollArBatch, startArCheckout } from "@/app/actions/ar-builds"
import { PHOTOREAL_UNAVAILABLE_MESSAGE } from "@/lib/billing/photoreal-access"
import { ArBuildSheet } from "@/components/dashboard/ar-build-sheet"

const requestKey = "00000000-0000-4000-8000-000000000001"
beforeEach(() => {
    vi.clearAllMocks()
    mocks.enabled = false
    mocks.writable = true
    mocks.access.mockImplementation(async ({ permission }: { permission: string }) => ({ ok: permission === "read" || mocks.writable, value: { profile: { id: "profile" }, actor: { userId: "actor" } } }))
    mocks.products.mockResolvedValue([{ id: "product", title: "Ceramic cup", arModelUrl: null, isActive: true }])
    mocks.jobs.mockResolvedValue([])
    mocks.list.mockResolvedValue([])
    mocks.enqueue.mockResolvedValue({ batchId: "queued-batch", replayed: false })
    mocks.billing.mockResolvedValue({ accountId: "account", planId: "free", plan: { name: "Free" } })
    mocks.balances.mockResolvedValue({ photoreal: { monthly: 0, purchased: 0, trial: 1, reserved: 0 } })
})

describe("photoreal generation access and interface", () => {
    it("checks content permission and availability before reading billing state or reserving a generation", async () => {
        await expect(startArCheckout({ productIds: ["product"], requestKey })).rejects.toThrow(PHOTOREAL_UNAVAILABLE_MESSAGE)
        expect(mocks.access).toHaveBeenCalledWith({ permission: "content.write" })
        expect(mocks.billing).not.toHaveBeenCalled()
        expect(mocks.enqueue).not.toHaveBeenCalled()
    })

    it("rejects a read-only member before queueing any work", async () => {
        mocks.enabled = true
        mocks.writable = false
        await expect(startArCheckout({ productIds: ["product"], requestKey })).rejects.toThrow("access_refused")
        expect(mocks.enqueue).not.toHaveBeenCalled()
    })

    it("uses the server-selected business and payer and never forwards client photo overrides", async () => {
        mocks.enabled = true
        const input = { productIds: ["product"], requestKey, photos: { product: "http://127.0.0.1/private" } }
        await startArCheckout(input)
        expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith({ productIds: ["product"], requestKey, profileId: "profile", accountId: "account", actorId: "actor" })
    })

    it("keeps status reads scoped to a readable business and does not dispatch", async () => {
        mocks.writable = false
        mocks.list.mockResolvedValue([{ id: "old-job", status: "READY" }])
        expect(await getArBatch("old-batch")).toEqual({ batchId: "old-batch", items: [{ id: "old-job", status: "READY" }] })
        await pollArBatch("old-batch")
        expect(mocks.list).toHaveBeenCalledWith("old-batch", "profile")
        expect(mocks.enqueue).not.toHaveBeenCalled()
    })

    it("shows unavailable service with the current allowance and a real Billing link", async () => {
        const { baseElement } = render(<ArBuildSheet open onOpenChange={() => {}} initialIds={["product"]} />)
        await waitFor(() => expect(screen.getByText(PHOTOREAL_UNAVAILABLE_MESSAGE)).toBeTruthy())
        expect(screen.getByText("1 available")).toBeTruthy()
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Generate 1 model" }).disabled).toBe(true)
        expect(screen.getByRole("link", { name: "Plan, usage & extra packs" }).getAttribute("href")).toBe("/dashboard/billing")
        expect(baseElement.querySelector('input[type="file"]')).toBeNull()
        expect(mocks.enqueue).not.toHaveBeenCalled()
    })

    it("retries an uncertain request with its original UUID instead of reserving a new request", async () => {
        mocks.enabled = true
        mocks.enqueue.mockRejectedValueOnce(new Error("database unavailable"))
        render(<ArBuildSheet open onOpenChange={() => {}} initialIds={["product"]} />)
        const generate = await screen.findByRole<HTMLButtonElement>("button", { name: "Generate 1 model" })
        await waitFor(() => expect(generate.disabled).toBe(false))
        fireEvent.click(generate)
        await screen.findByRole("alert")
        fireEvent.click(screen.getByRole("button", { name: "Generate 1 model" }))
        await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(2))
        expect(mocks.enqueue.mock.calls[0][0].requestKey).toBe(mocks.enqueue.mock.calls[1][0].requestKey)
        expect(mocks.enqueue.mock.calls[0][0].requestKey).toMatch(/^[0-9a-f-]{36}$/)
    })

    it("keeps existing completed models visible when new generation is unavailable", async () => {
        mocks.list.mockResolvedValue([{ id: "old-job", productId: "product", status: "READY", error: null, title: "Existing vase" }])
        render(<ArBuildSheet open onOpenChange={() => {}} batchId="old-batch" />)
        expect(await screen.findByText("Model ready")).toBeTruthy()
        expect(screen.getByText("Existing vase")).toBeTruthy()
        expect(mocks.enqueue).not.toHaveBeenCalled()
    })
})
