import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }))
vi.mock("@/app/actions/admin", () => ({ createAdminAccount: mocks.create }))

const { AdminCreateAccountForm } = await import("@/components/admin/admin-create-account-form")

beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockResolvedValue({
        ok: true,
        userId: "user-1",
        profileId: "prof-1",
        slug: "ada-labs",
        email: "ada@example.com",
        createdUser: true,
        createdProfile: true,
        publicPath: "/ada-labs",
    })
})

describe("AdminCreateAccountForm", () => {
    it("submits a new email with profile fields and optional import", async () => {
        render(<AdminCreateAccountForm />)
        fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } })
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } })
        fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Ada Labs" } })
        fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+15551212" } })
        fireEvent.change(screen.getByLabelText("About"), { target: { value: "Builds computing machines." } })
        fireEvent.change(screen.getByLabelText("Profile links"), { target: { value: "https://ada.dev" } })
        fireEvent.click(screen.getByLabelText(/Run profile import now/i))
        fireEvent.click(screen.getByRole("button", { name: /Create account/i }))
        await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
            email: "ada@example.com",
            name: "Ada Lovelace",
            displayName: "Ada Labs",
            phone: "+15551212",
            bio: "Builds computing machines.",
            runImport: true,
            importLinks: ["https://ada.dev"],
        }))
        expect(screen.getByText(/Account ready/i)).toBeTruthy()
        expect(screen.getByRole("link", { name: /Admin record/i }).getAttribute("href")).toBe("/admin/users/user-1")
        expect(screen.getByRole("link", { name: /Public page/i }).getAttribute("href")).toBe("/ada-labs")
    })

    it("requires an email before submit", async () => {
        render(<AdminCreateAccountForm />)
        fireEvent.click(screen.getByRole("button", { name: /Create account/i }))
        expect(mocks.create).not.toHaveBeenCalled()
        expect(screen.getByRole("alert").textContent).toMatch(/email/i)
    })
})
