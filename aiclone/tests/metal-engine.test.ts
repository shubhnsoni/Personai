import { afterAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { gramsToMg, rupeesPerGramToPaisePer10g } from "@/lib/metal/math"
import { touchPaise } from "@/lib/metal/touch"
import {
    acceptLift,
    buyStockForStore,
    cashflow,
    ensureParty,
    peekSaleToken,
    recordPayment,
    recordPurchase,
    recordSale,
} from "@/lib/metal/ledger"

const K24 = rupeesPerGramToPaisePer10g(15535)
const BUY_10 = touchPaise(gramsToMg(10), 7000, K24)
const SELL_10 = touchPaise(gramsToMg(10), 7400, K24)

const ids: string[] = []

async function wipe(profileId: string) {
    await prisma.$executeRaw`DELETE FROM "MetalBill" WHERE "profileId" = ${profileId}`
    await prisma.$executeRaw`DELETE FROM "MetalPayment" WHERE "profileId" = ${profileId}`
    await prisma.$executeRaw`DELETE FROM "MetalLot" WHERE "profileId" = ${profileId}`
    await prisma.$executeRaw`ALTER TABLE "PartyLedgerEntry" DISABLE TRIGGER "PartyLedgerEntry_append_only"`
    try {
        await prisma.$executeRaw`DELETE FROM "PartyAccount" WHERE "profileId" = ${profileId}`
        await prisma.digitalProduct.deleteMany({ where: { profileId } })
        await prisma.profile.delete({ where: { id: profileId } }).catch(() => undefined)
    } finally {
        await prisma.$executeRaw`ALTER TABLE "PartyLedgerEntry" ENABLE TRIGGER "PartyLedgerEntry_append_only"`
    }
}

afterAll(async () => {
    for (const id of ids) await wipe(id)
})

describe("metal engine against postgres", () => {
    it("purchases on 70 touch, sells 74, collects, and lifts into a store", async () => {
        const user = await prisma.user.findFirst({ select: { id: true } })
        if (!user) throw new Error("Need a User row to attach throwaway profiles")

        const stamp = Date.now().toString(36)
        const wholesale = await prisma.profile.create({
            data: {
                userId: user.id,
                slug: `w0-${stamp}`,
                displayName: "Engine wholesale",
                roleTemplate: "JEWELRY_WHOLESALE",
                isPublic: false,
            },
        })
        ids.push(wholesale.id)
        const retail = await prisma.profile.create({
            data: {
                userId: user.id,
                slug: `r0-${stamp}`,
                displayName: "Engine store",
                roleTemplate: "JEWELRY_RETAIL",
                isPublic: false,
            },
        })
        ids.push(retail.id)

        const gujarat = await ensureParty(wholesale.id, { kind: "SUPPLIER", displayName: "Gujarat House", phone: "07900000000" })
        const sharma = await ensureParty(wholesale.id, { kind: "RETAILER", displayName: "Sharma", phone: "9000000000" })

        const purchase = await recordPurchase(wholesale.id, {
            partyId: gujarat.id,
            k24PaisePer10g: K24,
            lines: [{ title: "Bangles", grossMg: gramsToMg(20), touchBps: 7000, qty: 2 }],
            payNowPaise: 0,
        })
        expect(purchase.totalPaise).toBe(BUY_10 * 2)
        expect(purchase.payStatus).toBe("UNPAID")

        const lots = await prisma.$queryRaw<{ id: string; remainingGrossMg: number }[]>`
            SELECT id, "remainingGrossMg" FROM "MetalLot" WHERE "profileId" = ${wholesale.id}`
        expect(lots[0]?.remainingGrossMg).toBe(gramsToMg(20))

        const sale = await recordSale(wholesale.id, {
            partyId: sharma.id,
            k24PaisePer10g: K24,
            lines: [{ title: "Bangle", grossMg: gramsToMg(10), touchBps: 7400, lotId: lots[0]!.id }],
            payNowPaise: 0,
        })
        expect(sale.totalPaise).toBe(SELL_10)
        expect(sale.payStatus).toBe("UNPAID")

        const afterSale = await prisma.$queryRaw<{ remainingGrossMg: number }[]>`
            SELECT "remainingGrossMg" FROM "MetalLot" WHERE id = ${lots[0]!.id}`
        expect(afterSale[0]?.remainingGrossMg).toBe(gramsToMg(10))

        const flowOpen = await cashflow(wholesale.id)
        expect(flowOpen.shopsOwe).toBe(SELL_10)
        expect(flowOpen.weOwe).toBe(BUY_10 * 2)
        expect(flowOpen.remainingMg).toBe(gramsToMg(10))

        await recordPayment(wholesale.id, {
            partyId: sharma.id,
            paise: SELL_10,
            method: "UPI",
            billIds: [sale.id],
        })
        const paid = await prisma.$queryRaw<{ payStatus: string; paidPaise: number }[]>`
            SELECT "payStatus", "paidPaise" FROM "MetalBill" WHERE id = ${sale.id}`
        expect(paid[0]?.payStatus).toBe("PAID")
        expect(paid[0]?.paidPaise).toBe(SELL_10)

        const liftSale = await recordSale(wholesale.id, {
            partyId: sharma.id,
            k24PaisePer10g: K24,
            lines: [{ title: "Bangle", grossMg: gramsToMg(10), touchBps: 7400, lotId: lots[0]!.id }],
            payNowPaise: SELL_10,
        })
        const peek = await peekSaleToken(liftSale.publicToken)
        expect(peek?.lifted).toBe(false)
        expect(peek?.grams).toBe(10)
        expect(peek?.touch).toBe(7400)

        const lifted = await acceptLift(retail.id, liftSale.publicToken)
        expect(lifted.product.title).toBe("Bangle")
        const peek2 = await peekSaleToken(liftSale.publicToken)
        expect(peek2?.lifted).toBe(true)
        await expect(acceptLift(retail.id, liftSale.publicToken)).rejects.toThrow(/already lifted/)

        const typed = await buyStockForStore(retail.id, {
            supplierName: "Off-platform house",
            title: "Rope chain",
            grossMg: gramsToMg(20),
            costTouchBps: 7500,
            k24PaisePer10g: K24,
            makingPaise: 80_000,
            payNowPaise: 0,
        })
        expect(typed.bill.kind).toBe("PURCHASE")
        expect(typed.product.title).toBe("Rope chain")

        const leftover = await prisma.$queryRaw<{ remainingGrossMg: number }[]>`
            SELECT "remainingGrossMg" FROM "MetalLot" WHERE id = ${lots[0]!.id}`
        expect(leftover[0]?.remainingGrossMg).toBe(0)
    }, 30_000)
})
