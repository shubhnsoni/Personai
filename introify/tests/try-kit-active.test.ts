import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
    syncUser: vi.fn(),
    cookieSet: vi.fn(),
}))

vi.mock("@/lib/auth-sync", () => ({ syncUser: state.syncUser }))
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.cookieSet }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() } } }))
vi.mock("@/lib/try-kit-seed", () => ({ seedRole: vi.fn() }))
vi.mock("@/lib/admin/allowlist", () => ({ userIsAdmin: () => false }))

import { adoptOwnedTryKit } from "@/app/actions/try-kits"

beforeEach(() => {
    vi.resetAllMocks()
    state.syncUser.mockResolvedValue(null)
})

describe("adoptOwnedTryKit", () => {
    it("does nothing for a guest so public try kits stay guest-facing", async () => {
        await expect(adoptOwnedTryKit("try-hotel")).resolves.toEqual({ adopted: false })
        expect(state.cookieSet).not.toHaveBeenCalled()
    })

    it("does nothing when the signed-in user does not own the kit", async () => {
        state.syncUser.mockResolvedValue({
            id: "visitor",
            profiles: [{ id: "neal", slug: "neal" }],
        })
        await expect(adoptOwnedTryKit("try-hotel")).resolves.toEqual({ adopted: false })
        expect(state.cookieSet).not.toHaveBeenCalled()
    })

    it("does nothing for a non-try owned profile", async () => {
        state.syncUser.mockResolvedValue({
            id: "owner",
            profiles: [{ id: "neal", slug: "neal" }],
        })
        await expect(adoptOwnedTryKit("neal")).resolves.toEqual({ adopted: false })
        expect(state.cookieSet).not.toHaveBeenCalled()
    })

    it("sets active + TRY_NOW when the owner visits their try kit", async () => {
        state.syncUser.mockResolvedValue({
            id: "owner",
            profiles: [
                { id: "neal", slug: "neal" },
                { id: "hotel", slug: "try-hotel" },
            ],
        })
        await expect(adoptOwnedTryKit("try-hotel")).resolves.toEqual({ adopted: true })
        expect(state.cookieSet).toHaveBeenCalledWith("pl-active-profile", "hotel", expect.objectContaining({ httpOnly: true, path: "/" }))
        expect(state.cookieSet).toHaveBeenCalledWith("pl-try-now", "1", expect.objectContaining({ httpOnly: true, path: "/" }))
    })
})
