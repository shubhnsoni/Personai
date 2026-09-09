import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
    syncUser: vi.fn(), account: vi.fn(), member: vi.fn(), invitation: vi.fn(), createInvitation: vi.fn(), updateInvitation: vi.fn(),
    txUser: vi.fn(), txMember: vi.fn(), workspaceCount: vi.fn(), workspaceList: vi.fn(), memberUpsert: vi.fn(), workspaceUpsert: vi.fn(),
    cookieSet: vi.fn(), cap: 3, used: 1, delta: -1,
}))
vi.mock("@/lib/auth-sync", () => ({ syncUser: state.syncUser }))
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.cookieSet }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {
    billingAccount: { findUnique: state.account }, billingAccountMember: { findUnique: state.member },
    billingInvitation: { findUnique: state.invitation },
} }))
vi.mock("@/lib/billing/service", () => ({
    getAccountBilling: vi.fn(), getProfileBilling: vi.fn(),
    withAccountLimit: async (_account: string, _kind: string, delta: number | ((tx: unknown) => Promise<number>), work: (tx: unknown) => Promise<unknown>) => {
        const tx = {
            user: { findFirst: state.txUser },
            billingAccountMember: { findUnique: state.txMember, upsert: state.memberUpsert },
            billingInvitation: { findFirst: state.invitation, findUnique: state.invitation, create: state.createInvitation, update: state.updateInvitation },
            workspace: { count: state.workspaceCount, findMany: state.workspaceList },
            membership: { findUnique: vi.fn().mockResolvedValue(null), upsert: state.workspaceUpsert },
            billingAuditEvent: { create: vi.fn().mockResolvedValue({}) },
        }
        state.delta = typeof delta === "number" ? delta : await delta(tx)
        if (state.delta > 0 && state.used + state.delta > state.cap) throw new Error("Seat limit reached")
        return work(tx)
    },
}))

import { acceptTeamInvitation, createTeamInvitation, switchBusiness } from "@/app/actions/billing-team"

beforeEach(() => {
    vi.resetAllMocks()
    state.cap = 3; state.used = 1; state.delta = -1
    state.syncUser.mockResolvedValue({ id: "owner", email: "owner@example.com", accessibleProfiles: [], profileAccess: {} })
    state.account.mockResolvedValue({ id: "payer", ownerUserId: "owner" })
    state.member.mockResolvedValue({ status: "ACTIVE", role: "OWNER" })
    state.workspaceCount.mockResolvedValue(1)
    state.workspaceList.mockResolvedValue([{ id: "business-a", profileId: "profile-a" }])
    state.invitation.mockResolvedValue(null)
    state.txUser.mockResolvedValue(null)
    state.txMember.mockResolvedValue(null)
})

const input = { accountId: "payer", email: "staff@example.com", workspaceIds: ["business-a"], workspaceRole: "STAFF" as const }

describe("account invitations", () => {
    it("refuses an account member pretending to be the account owner", async () => {
        state.syncUser.mockResolvedValue({ id: "staff", email: "staff@example.com" })
        state.member.mockResolvedValue({ status: "ACTIVE", role: "MEMBER" })
        await expect(createTeamInvitation(input)).rejects.toThrow("Only the account owner")
        expect(state.createInvitation).not.toHaveBeenCalled()
    })
    it("reserves one seat for a new normalized email and stores only the token hash", async () => {
        const result = await createTeamInvitation({ ...input, email: " Staff@EXAMPLE.com " })
        expect(state.delta).toBe(1)
        const data = state.createInvitation.mock.calls[0][0].data
        expect(data.emailKey).toBe("staff@example.com")
        expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/)
        expect(result.path).not.toContain(data.tokenHash)
    })
    it("allows another business invitation for an existing active user at the seat cap", async () => {
        state.used = state.cap
        state.txUser.mockResolvedValue({ id: "staff" })
        state.txMember.mockResolvedValue({ status: "ACTIVE", role: "MEMBER" })
        await createTeamInvitation(input)
        expect(state.delta).toBe(0)
        expect(state.createInvitation).toHaveBeenCalledOnce()
    })
    it("deduplicates an outstanding invitation by email and merges business access", async () => {
        state.used = state.cap
        state.invitation.mockResolvedValue({ id: "pending", workspaceIds: ["business-b"] })
        await createTeamInvitation(input)
        expect(state.delta).toBe(0)
        expect(state.createInvitation).not.toHaveBeenCalled()
        expect(state.updateInvitation.mock.calls[0][0].data.workspaceIds.sort()).toEqual(["business-a", "business-b"])
    })
    it("blocks new seats at the cap before creating an invitation", async () => {
        state.used = state.cap
        await expect(createTeamInvitation(input)).rejects.toThrow("Seat limit")
        expect(state.createInvitation).not.toHaveBeenCalled()
    })
    it("rejects a foreign workspace instead of inviting into it", async () => {
        state.workspaceCount.mockResolvedValue(0)
        await expect(createTeamInvitation(input)).rejects.toThrow("does not belong")
        expect(state.createInvitation).not.toHaveBeenCalled()
    })
    it("requires the invited email before accepting any memberships", async () => {
        state.invitation.mockResolvedValue({ id: "invitation", accountId: "payer", emailKey: "someone-else@example.com", status: "PENDING", expiresAt: new Date(Date.now() + 100000), workspaceIds: ["business-a"] })
        await expect(acceptTeamInvitation("a".repeat(43))).rejects.toThrow("email address")
        expect(state.memberUpsert).not.toHaveBeenCalled()
        expect(state.workspaceUpsert).not.toHaveBeenCalled()
    })
    it("denies a revoked invitation without adding a seat or workspace membership", async () => {
        state.invitation.mockResolvedValue({ id: "invitation", accountId: "payer", emailKey: "owner@example.com", status: "REVOKED", expiresAt: new Date(Date.now() + 100000), workspaceIds: ["business-a"] })
        await expect(acceptTeamInvitation("a".repeat(43))).rejects.toThrow("expired or been revoked")
        expect(state.memberUpsert).not.toHaveBeenCalled()
    })
    it("acceptance retries cannot duplicate already accepted memberships", async () => {
        state.invitation.mockResolvedValue({ id: "invitation", accountId: "payer", emailKey: "owner@example.com", status: "ACCEPTED", acceptedBy: "owner" })
        await acceptTeamInvitation("a".repeat(43))
        expect(state.memberUpsert).not.toHaveBeenCalled()
        expect(state.workspaceUpsert).not.toHaveBeenCalled()
    })
    it("does not write an active-business cookie for a forged profile ID", async () => {
        await expect(switchBusiness("foreign-profile")).rejects.toThrow("unavailable")
        expect(state.cookieSet).not.toHaveBeenCalled()
    })
})
