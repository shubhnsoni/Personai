import { describe, expect, it } from "vitest"
import { distroTab, lineAmountPaise, orderTotalPaise, parseDistroMeta, writeDistroMeta } from "@/lib/distribute/meta"

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

        const billed = parseDistroMeta(writeDistroMeta({
            ...dispatch,
            accounts: "BILLED",
            invoice: "INV-104",
            gstin: "20AABCU9603R1ZM",
            taxablePaise: 10000,
            gstRateBps: 1800,
            gstMode: "cgst_sgst",
            gstPaise: 1800,
            cgstPaise: 900,
            sgstPaise: 900,
            igstPaise: 0,
        }))
        expect(billed.invoice).toBe("INV-104")
        expect(billed.gstin).toBe("20AABCU9603R1ZM")
        expect(billed.taxablePaise).toBe(10000)
        expect(billed.gstMode).toBe("cgst_sgst")
        expect(distroTab(billed)).toBe("billed")
    })
})
