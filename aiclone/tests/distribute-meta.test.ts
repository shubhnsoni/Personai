import { describe, expect, it } from "vitest"
import {
    distroDeskActions,
    distroTab,
    lineAmountPaise,
    orderTotalPaise,
    parseDistroMeta,
    writeDistroMeta,
} from "@/lib/distribute/meta"

describe("distributor order math", () => {
    it("line amount is qty times unit price", () => {
        expect(lineAmountPaise(3, 12500)).toBe(37500)
    })
    it("order total sums line amounts", () => {
        expect(orderTotalPaise([
            { qty: 2, unitPaise: 10000 },
            { qty: 1, unitPaise: 4500 },
        ])).toBe(24500)
    })
})

describe("distributor workflow tabs", () => {
    it("round-trips meta and buckets like Suneja", () => {
        const pending = parseDistroMeta(null, "Sharma Traders", "Ranchi")
        expect(pending.dealer).toBe("Sharma Traders")
        expect(pending.location).toBe("Ranchi")
        expect(distroTab(pending)).toBe("pending")

        const approved = parseDistroMeta(writeDistroMeta({ ...pending, approval: "APPROVED" }))
        expect(distroTab(approved)).toBe("approved")

        const dispatch = parseDistroMeta(writeDistroMeta({ ...approved, warehouse: "DISPATCHED" }))
        expect(distroTab(dispatch)).toBe("dispatch")

        const billed = parseDistroMeta(writeDistroMeta({ ...dispatch, accounts: "BILLED", invoice: "INV-104" }))
        expect(billed.invoice).toBe("INV-104")
        expect(distroTab(billed)).toBe("billed")
    })

    it("keeps hold and reject in pending until approved", () => {
        const base = parseDistroMeta(null, "Gupta Store", "Jamshedpur")
        expect(distroTab(parseDistroMeta(writeDistroMeta({ ...base, approval: "ON_HOLD" })))).toBe("pending")
        expect(distroTab(parseDistroMeta(writeDistroMeta({ ...base, approval: "NOT_APPROVED" })))).toBe("pending")
    })

    it("buckets no-stock under dispatch", () => {
        const approved = { ...parseDistroMeta(null, "Sharma Traders", "Ranchi"), approval: "APPROVED" as const }
        expect(distroTab(parseDistroMeta(writeDistroMeta({ ...approved, warehouse: "NO_STOCK" })))).toBe("dispatch")
    })
})

describe("real distributor desk actions (no preview toggle)", () => {
    it("gates approve / dispatch / bill by pipeline tab only", () => {
        expect(distroDeskActions("pending")).toEqual({ showApprove: true, showDispatch: false, showBill: false })
        expect(distroDeskActions("approved")).toEqual({ showApprove: false, showDispatch: true, showBill: true })
        expect(distroDeskActions("dispatch")).toEqual({ showApprove: false, showDispatch: false, showBill: true })
        expect(distroDeskActions("billed")).toEqual({ showApprove: false, showDispatch: false, showBill: false })
    })
})
