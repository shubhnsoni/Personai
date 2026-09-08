import { describe, expect, it } from "vitest"
import { ROLE_ALIAS, resolveKitRole } from "@/lib/role-alias"
import { TRY_KITS } from "@/lib/try-kits"
import { surfacesFor, shopNavLabel } from "@/lib/surfaces"
import { needByRole } from "@/lib/onboarding-needs"

describe("QA flavor roles", () => {
    it("aliases cafe to the restaurant kit", () => {
        expect(resolveKitRole("CAFE")).toBe("RESTAURANT")
        expect(surfacesFor("CAFE")).toEqual(surfacesFor("RESTAURANT"))
        expect(shopNavLabel("CAFE")).toBe("Menu")
        expect(needByRole("CAFE").role).toBe("RESTAURANT")
    })

    it("keeps clinic on appointments, not a custom catch-all", () => {
        expect(resolveKitRole("CLINIC")).toBe("CONSULTANT")
        expect(surfacesFor("CLINIC")).toEqual(surfacesFor("CONSULTANT"))
        expect(surfacesFor("CLINIC")).not.toEqual(surfacesFor("CUSTOM"))
    })

    it("lists every flavor role as a try kit", () => {
        const kitRoles = new Set(TRY_KITS.map((k) => k.role))
        for (const flavor of Object.keys(ROLE_ALIAS)) {
            expect(kitRoles.has(flavor)).toBe(true)
        }
    })

    it("gives every more-trade kit a unique slug", () => {
        const slugs = TRY_KITS.map((k) => k.slug)
        expect(new Set(slugs).size).toBe(slugs.length)
        expect(TRY_KITS.filter((k) => k.category === "more").length).toBeGreaterThan(20)
    })
})
