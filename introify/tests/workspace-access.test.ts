import { describe, expect, it, vi } from "vitest"
import { canAccessProfile, type ProfileAccess } from "@/lib/workspace-access"
import { createOwnershipFoundation } from "@/lib/security/ownership"

const access = (role: string): ProfileAccess => ({ workspaceId: "shop-one", owner: false, role, locationIds: [] })

describe("business role boundary", () => {
    it("lets viewers read without any mutation capability", () => {
        expect(canAccessProfile(access("VIEWER"), "read")).toBe(true)
        for (const permission of ["content.write", "inbox.write", "operations.write", "settings.write"] as const) expect(canAccessProfile(access("VIEWER"), permission)).toBe(false)
    })
    it("staff can serve customers but cannot publish content or change business settings", () => {
        expect(canAccessProfile(access("STAFF"), "inbox.write")).toBe(true)
        expect(canAccessProfile(access("STAFF"), "operations.write")).toBe(true)
        expect(canAccessProfile(access("STAFF"), "content.write")).toBe(false)
        expect(canAccessProfile(access("STAFF"), "settings.write")).toBe(false)
    })
    it("a manager can edit content but settings require an administrator", () => {
        expect(canAccessProfile(access("MANAGER"), "content.write")).toBe(true)
        expect(canAccessProfile(access("MANAGER"), "settings.write")).toBe(false)
        expect(canAccessProfile(access("ADMIN"), "settings.write")).toBe(true)
    })
    it("denies unknown and location-limited roles in the whole-business dashboard", () => {
        expect(canAccessProfile(access("SUPERADMIN"), "read")).toBe(false)
        expect(canAccessProfile({ ...access("MANAGER"), locationIds: ["location-a"] }, "read")).toBe(false)
    })
    it("an invited active profile cannot make owner-only writes silently target the user's other business", async () => {
        const write = vi.fn()
        const security = createOwnershipFoundation({ resolve: async () => ({ id: "user-a", activeProfileId: "invited-business", profiles: [{ id: "personally-owned-business" }] }) })
        expect((await security.executeOwnedResourceWrite({ resourceId: "product-a", writeOwned: write })).ok).toBe(false)
        expect(write).not.toHaveBeenCalled()
        expect((await security.requireOwnedProfile({ claimedProfileId: "invited-business" })).ok).toBe(false)
    })
    it("a cross-tenant resource ID remains constrained to the explicitly authorized business", async () => {
        const security = createOwnershipFoundation({ resolve: async () => ({ id: "staff-a", activeProfileId: "shop-a", profiles: [{ id: "shop-a" }] }) })
        const foreignProduct = { id: "product-b", profileId: "shop-b" }
        const result = await security.executeOwnedResourceWrite({ resourceId: foreignProduct.id, writeOwned: async ({ resourceId, profile }) => resourceId === foreignProduct.id && profile.id === foreignProduct.profileId ? foreignProduct : null })
        expect(result.ok).toBe(false)
    })
})
