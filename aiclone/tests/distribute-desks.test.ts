import { describe, expect, it } from "vitest"
import {
    assertDistroPermission,
    membershipRoleForDesk,
    membershipRoleToDesk,
    parseStaffDeskFromPersonalityConfig,
    resolveDistroDeskPermissions,
} from "@/lib/distribute/desks"

describe("membership → distro desk", () => {
    it("OWNER and ADMIN map to admin (full seat)", () => {
        expect(membershipRoleToDesk("OWNER")).toBe("admin")
        expect(membershipRoleToDesk("ADMIN")).toBe("admin")
        expect(resolveDistroDeskPermissions("OWNER")).toMatchObject({
            desk: "admin",
            canCreate: true,
            canApprove: true,
            canWarehouse: true,
            canAccounts: true,
            canInvite: true,
        })
    })

    it("MANAGER maps to admin", () => {
        expect(membershipRoleToDesk("MANAGER")).toBe("admin")
    })

    it("SALES / WAREHOUSE / ACCOUNTS map to their desks only", () => {
        expect(resolveDistroDeskPermissions("SALES")).toMatchObject({
            desk: "sales",
            canCreate: true,
            canApprove: false,
            canWarehouse: false,
            canAccounts: false,
            canInvite: false,
        })
        expect(resolveDistroDeskPermissions("WAREHOUSE")).toMatchObject({
            desk: "warehouse",
            canCreate: false,
            canWarehouse: true,
            canApprove: false,
            canAccounts: false,
        })
        expect(resolveDistroDeskPermissions("ACCOUNTS")).toMatchObject({
            desk: "accounts",
            canAccounts: true,
            canApprove: false,
            canWarehouse: false,
            canCreate: false,
        })
    })

    it("STAFF uses personalityConfig staff desk; otherwise denied", () => {
        expect(membershipRoleToDesk("STAFF")).toBeNull()
        expect(resolveDistroDeskPermissions("STAFF").canRead).toBe(false)
        expect(membershipRoleToDesk("STAFF", '{"staffDesk":"warehouse"}')).toBe("warehouse")
        expect(resolveDistroDeskPermissions("STAFF", '{"distroDesk":"accounts"}').canAccounts).toBe(true)
    })

    it("VIEWER without desk is read-only; with desk gets that seat", () => {
        expect(resolveDistroDeskPermissions("VIEWER")).toMatchObject({
            desk: null,
            canRead: true,
            canApprove: false,
        })
        expect(resolveDistroDeskPermissions("VIEWER", "sales").canCreate).toBe(true)
    })

    it("unknown role is denied", () => {
        expect(resolveDistroDeskPermissions("HACKER").canRead).toBe(false)
        expect(membershipRoleToDesk(null)).toBeNull()
    })

    it("parseStaffDeskFromPersonalityConfig reads staffDesk | distroDesk | desk", () => {
        expect(parseStaffDeskFromPersonalityConfig('{"staffDesk":"sales"}')).toBe("sales")
        expect(parseStaffDeskFromPersonalityConfig('{"distroDesk":"accounts"}')).toBe("accounts")
        expect(parseStaffDeskFromPersonalityConfig("nope")).toBeNull()
    })

    it("assertDistroPermission blocks wrong-desk mutations", () => {
        const sales = resolveDistroDeskPermissions("SALES")
        expect(() => assertDistroPermission(sales, "create")).not.toThrow()
        expect(() => assertDistroPermission(sales, "approve")).toThrow(/Admin desk/)
        expect(() => assertDistroPermission(sales, "warehouse")).toThrow(/Warehouse desk/)
        expect(() => assertDistroPermission(sales, "accounts")).toThrow(/Accounts desk/)

        const warehouse = resolveDistroDeskPermissions("WAREHOUSE")
        expect(() => assertDistroPermission(warehouse, "warehouse")).not.toThrow()
        expect(() => assertDistroPermission(warehouse, "approve")).toThrow(/Admin desk/)
    })

    it("membershipRoleForDesk writes enum roles for assign", () => {
        expect(membershipRoleForDesk("admin")).toBe("ADMIN")
        expect(membershipRoleForDesk("sales")).toBe("SALES")
        expect(membershipRoleForDesk("warehouse")).toBe("WAREHOUSE")
        expect(membershipRoleForDesk("accounts")).toBe("ACCOUNTS")
    })
})
