import { describe, expect, it } from "vitest"
import { chaseHref } from "@/lib/metal/ledger"
import { metalLine } from "@/lib/metal/product"
import { writeProductMetal } from "@/lib/metal/product"
import { leadsNavLabel, salesNavLabel, shopNavLabel } from "@/lib/surfaces"

describe("wholesale kit nouns", () => {
    it("labels Stock / Parties / Cashflow", () => {
        expect(shopNavLabel("JEWELRY_WHOLESALE")).toBe("Stock")
        expect(leadsNavLabel("JEWELRY_WHOLESALE")).toBe("Parties")
        expect(salesNavLabel("JEWELRY_WHOLESALE")).toBe("Cashflow")
        expect(shopNavLabel("JEWELRY_RETAIL")).toBe("Jewellery")
        expect(salesNavLabel("JEWELRY_RETAIL")).toBe("Cashflow")
        expect(leadsNavLabel("JEWELRY_RETAIL")).toBe("Leads")
    })
})

describe("chase WhatsApp", () => {
    it("builds wa.me with rupees, not paise", () => {
        const href = chaseHref({
            phone: "9876543210",
            name: "Sharma Jewellers",
            duePaise: 1_14_95_900,
            upiId: "shop@upi",
        })
        expect(href).toContain("https://wa.me/9876543210?text=")
        expect(decodeURIComponent(href!)).toContain("₹1,14,959")
        expect(decodeURIComponent(href!)).toContain("UPI shop@upi")
    })

    it("returns null without a phone", () => {
        expect(chaseHref({ phone: null, name: "X", duePaise: 100 })).toBeNull()
    })
})

describe("wholesale catalog line", () => {
    it("prints 70 touch as percent, not 22K", () => {
        const json = writeProductMetal(null, { grossMg: 10000, purityBps: 7000, makingPaise: 0 })
        expect(metalLine(json)).toBe("10 g · 70.0%")
    })
})
