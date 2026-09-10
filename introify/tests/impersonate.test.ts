// @vitest-environment node
import { describe, expect, it } from "vitest"
import { impersonationScope } from "@/lib/admin/impersonate"

describe("admin impersonation scope", () => {
    const aura = { id: "aura", userId: "owner-a", slug: "aura-fitness-ranchi" }
    const fit = { id: "fit", userId: "owner-a", slug: "fit24-ranchi" }
    const adminShop = { id: "admin-shop", userId: "admin", slug: "ops" }

    it("limits the dashboard to the impersonated account shops so writes land on that account", () => {
        const scope = impersonationScope({
            isAdmin: true,
            impersonateProfileId: aura.id,
            targetUserProfiles: [aura, fit],
            adminProfiles: [adminShop],
        })
        expect(scope?.profiles.map((p) => p.id)).toEqual(["aura", "fit"])
        expect(scope?.activeId).toBe("aura")
        expect(scope?.profiles.some((p) => p.id === "admin-shop")).toBe(false)
    })

    it("does nothing for a non-admin even if the cookie is present", () => {
        expect(impersonationScope({
            isAdmin: false,
            impersonateProfileId: aura.id,
            targetUserProfiles: [aura],
            adminProfiles: [],
        })).toBeNull()
    })
})
