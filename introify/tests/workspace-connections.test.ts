import { describe, expect, it } from "vitest"
import {
    actionNeedsApproval,
    connectionCatalog,
    defaultManifest,
    permissionAllowed,
} from "@/lib/workspace-connections"

describe("Phase 3 connections and safety", () => {
    it("starts with kit-useful cloud connections, not desktop apps", () => {
        const kinds = connectionCatalog().map((item) => item.kind)
        expect(kinds).toEqual(expect.arrayContaining(["FILES", "GITHUB", "CALENDAR", "DRIVE", "SHOP", "POS", "MESSAGING"]))
        expect(kinds.join(" ")).not.toMatch(/photoshop|after effects|autocad/i)
    })

    it("keeps spending and external send behind approval", () => {
        expect(actionNeedsApproval("read")).toBe(false)
        expect(actionNeedsApproval("create_draft")).toBe(false)
        expect(actionNeedsApproval("send_message")).toBe(true)
        expect(actionNeedsApproval("spend_money")).toBe(true)
        expect(actionNeedsApproval("place_order")).toBe(true)
    })

    it("scopes tools per AI instead of sharing every connection", () => {
        expect(permissionAllowed({ scopes: ["read_sales"] }, "read_sales")).toBe(true)
        expect(permissionAllowed({ scopes: ["read_sales"] }, "place_order")).toBe(false)
        const manifest = defaultManifest("Restaurant night report")
        expect(manifest.disallowed).toEqual(expect.arrayContaining(["spend_money", "place_order"]))
        expect(manifest.approvalRequired.length).toBeGreaterThan(0)
    })
})
