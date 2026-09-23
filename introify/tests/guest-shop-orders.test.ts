// @vitest-environment node
import { describe, expect, it, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { formatCheckoutPrice } from "@/lib/pricing"
import {
    guestOrderReference,
    nextStepCopy,
    payMethodLabel,
    readGuestShopOrders,
    writeGuestShopOrder,
} from "@/lib/guest-shop-orders"

function memoryStore(seed?: Record<string, string>) {
    const data = new Map<string, string>(Object.entries(seed || {}))
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value) },
        removeItem: (key: string) => { data.delete(key) },
    }
}

describe("guest shop order confirmation helpers (P1-1)", () => {
    it("builds a stable short reference from the purchase id", () => {
        expect(guestOrderReference("cmtvxy40n003h6z2mw65rmly5")).toBe("#W65RMLY5")
        expect(guestOrderReference("abc")).toBe("#ABC")
    })

    it("labels payment methods honestly for COD / card / WhatsApp", () => {
        expect(payMethodLabel("COD")).toMatch(/cash on delivery/i)
        expect(payMethodLabel("CARD")).toMatch(/card/i)
        expect(payMethodLabel("WHATSAPP")).toMatch(/whatsapp/i)
        expect(nextStepCopy("COD")).toMatch(/pay cash/i)
        expect(nextStepCopy("WHATSAPP")).toMatch(/whatsapp/i)
        expect(nextStepCopy("CARD")).toMatch(/card/i)
    })
})

describe("guest shop order history write/read", () => {
    let storage: ReturnType<typeof memoryStore>

    beforeEach(() => {
        storage = memoryStore()
    })

    it("round-trips a COD confirmation for Raghu-style grocery", () => {
        const saved = writeGuestShopOrder({
            id: "cmtvxy40n003h6z2mw65rmly5",
            slug: "raghuvanshi-stores",
            title: "Toor dal 1kg",
            itemNames: ["Toor dal 1kg"],
            totalCents: 16_800,
            currency: "INR",
            payMethod: "COD",
        }, storage, 1_700_000_000_000)

        expect(saved.reference).toBe("#W65RMLY5")
        expect(saved.status).toBe("PLACED")
        expect(saved.nextStep).toMatch(/pay cash/i)

        const list = readGuestShopOrders("raghuvanshi-stores", storage)
        expect(list).toHaveLength(1)
        expect(list[0]).toMatchObject({
            id: "cmtvxy40n003h6z2mw65rmly5",
            reference: "#W65RMLY5",
            payMethod: "COD",
            totalCents: 16_800,
            currency: "INR",
            itemNames: ["Toor dal 1kg"],
        })
        expect(readGuestShopOrders("mk-jewellers", storage)).toEqual([])
    })

    it("keeps newest first and de-dupes by id", () => {
        writeGuestShopOrder({
            id: "one",
            slug: "raghuvanshi-stores",
            title: "Toor dal",
            itemNames: ["Toor dal"],
            totalCents: 16_800,
            currency: "INR",
            payMethod: "COD",
        }, storage, 1000)
        writeGuestShopOrder({
            id: "two",
            slug: "raghuvanshi-stores",
            title: "Mustard oil",
            itemNames: ["Mustard oil"],
            totalCents: 22_000,
            currency: "INR",
            payMethod: "WHATSAPP",
            status: "HANDOFF",
        }, storage, 2000)
        writeGuestShopOrder({
            id: "one",
            slug: "raghuvanshi-stores",
            title: "Toor dal",
            itemNames: ["Toor dal"],
            totalCents: 16_800,
            currency: "INR",
            payMethod: "COD",
        }, storage, 3000)

        expect(readGuestShopOrders("raghuvanshi-stores", storage).map((o) => o.id)).toEqual(["one", "two"])
    })
})

describe("confirmation total stays INR for jewellery-like amounts", () => {
    it("formats MK-style confirmation total as ₹1,56,600 not $1800", () => {
        const storage = memoryStore()
        const saved = writeGuestShopOrder({
            id: "mk-bangle-order-001",
            slug: "mk-jewellers",
            title: "22K light bangle",
            itemNames: ["22K light bangle"],
            totalCents: 15_660_000,
            currency: "INR",
            payMethod: "COD",
        }, storage)

        const total = formatCheckoutPrice(saved.totalCents, saved.currency, "USD")
        expect(total).toBe("₹1,56,600")
        expect(total).not.toMatch(/\$/)
        expect(saved.reference).toMatch(/^#/)
    })
})

describe("CheckoutSheet confirmation wiring (source)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/checkout/checkout-sheet.tsx"), "utf8")
    const header = readFileSync(join(process.cwd(), "src/components/shop/catalog-header.tsx"), "utf8")
    const pdp = readFileSync(join(process.cwd(), "src/components/shop/pdp-light.tsx"), "utf8")

    it("shows order reference after COD success and writes guest history", () => {
        expect(src).toMatch(/writeGuestShopOrder/)
        expect(src).toMatch(/checkout-order-ref/)
        expect(src).toMatch(/persistGuestOrder/)
        expect(src).toMatch(/payMethod:\s*"COD"|method:\s*"COD"/)
        expect(src).not.toMatch(/setDone\("Order placed\. Pay cash when you receive it\."\)/)
    })

    it("exposes guest-accessible Your orders from shop header and PDP", () => {
        expect(header).toMatch(/GuestShopOrdersButton/)
        expect(pdp).toMatch(/GuestShopOrdersButton/)
        expect(pdp).not.toMatch(/Cart · 0/)
    })
})
