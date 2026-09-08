import { prisma } from "@/lib/prisma"
import { goldBoardFromConfig } from "@/lib/metal/board"
import { K22_BPS, type ProductMetal } from "@/lib/metal/math"
import { writeProductMetal } from "@/lib/metal/product"
import { touchPaise } from "@/lib/metal/touch"
import { createHash, randomBytes } from "node:crypto"
import {
    metalId,
    sqlAging,
    sqlBillByToken,
    sqlCashSums,
    sqlConsumeLot,
    sqlInsertAlloc,
    sqlInsertBill,
    sqlInsertLedger,
    sqlInsertLine,
    sqlInsertLot,
    sqlInsertParty,
    sqlInsertPayment,
    sqlLastLedger,
    sqlListLots,
    sqlListParties,
    sqlLotById,
    sqlLotBySourceBill,
    sqlMarkBillPaid,
    sqlMarkLifted,
    sqlOpenBills,
    sqlOpenBillsByIds,
    sqlPartyById,
    sqlPartyByPhone,
    sqlSetLotProduct,
    sqlUpdateParty,
    type BillRow,
    type PartyRow,
} from "@/lib/metal/db"

export type PartyKind = "SUPPLIER" | "RETAILER" | "CUSTOMER"
export type PayMethod = "CASH" | "UPI" | "BANK" | "GOLD"
export type PayStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID"

export type BillLineInput = {
    title: string
    grossMg: number
    touchBps: number
    makingPaise?: number
    qty?: number
    lotId?: string
}

function token() {
    return randomBytes(9).toString("base64url")
}

function payStatus(total: number, paid: number): PayStatus {
    if (paid <= 0) return "UNPAID"
    if (paid >= total) return "PAID"
    return "PARTIAL"
}

async function appendLedger(input: {
    partyAccountId: string
    kind: string
    paiseDelta: number
    billId?: string
    paymentId?: string
    key: string
}) {
    const prev = await sqlLastLedger(input.partyAccountId)
    await sqlInsertLedger({
        id: metalId(),
        partyAccountId: input.partyAccountId,
        kind: input.kind,
        paiseDelta: input.paiseDelta,
        paiseAfter: prev.paiseAfter + input.paiseDelta,
        billId: input.billId,
        paymentId: input.paymentId,
        key: input.key,
    })
}

export async function ensureParty(
    profileId: string,
    input: { kind: PartyKind; displayName: string; phone?: string | null; termsDays?: number; creditLimitPaise?: number },
) {
    const phone = input.phone?.replace(/\D/g, "") || null
    if (phone) {
        const existing = await sqlPartyByPhone(profileId, input.kind, phone)
        if (existing) {
            await sqlUpdateParty(
                existing.id,
                input.displayName,
                input.termsDays ?? existing.termsDays,
                input.creditLimitPaise ?? existing.creditLimitPaise,
            )
            return { ...existing, displayName: input.displayName }
        }
    }
    const row: PartyRow = {
        id: metalId(),
        profileId,
        kind: input.kind,
        displayName: input.displayName.trim(),
        phone,
        termsDays: input.termsDays ?? (input.kind === "RETAILER" ? 15 : 0),
        creditLimitPaise: input.creditLimitPaise ?? 0,
    }
    return sqlInsertParty(row)
}

export async function recordPurchase(
    profileId: string,
    input: {
        partyId: string
        k24PaisePer10g: number
        lines: BillLineInput[]
        payNowPaise?: number
        method?: PayMethod
        dueOn?: Date | null
        note?: string
    },
) {
    if (input.k24PaisePer10g <= 0) throw new Error("Set today's 24K board first")
    if (!input.lines.length) throw new Error("Add at least one lot")
    const priced = input.lines.map((line) => {
        const linePaise = touchPaise(line.grossMg, line.touchBps, input.k24PaisePer10g) + Math.max(0, line.makingPaise ?? 0)
        return { ...line, qty: line.qty ?? 1, linePaise }
    })
    const totalPaise = priced.reduce((s, l) => s + l.linePaise, 0)
    const payNow = Math.min(Math.max(0, input.payNowPaise ?? 0), totalPaise)
    const party = await sqlPartyById(input.partyId, profileId)
    if (!party) throw new Error("Unknown supplier")

    const bill: BillRow = {
        id: metalId(),
        profileId,
        partyAccountId: party.id,
        kind: "PURCHASE",
        k24PaisePer10g: input.k24PaisePer10g,
        totalPaise,
        paidPaise: payNow,
        payStatus: payStatus(totalPaise, payNow),
        dueOn: input.dueOn ?? null,
        publicToken: token(),
        liftedAt: null,
        createdAt: new Date(),
    }
    await sqlInsertBill(bill)
    for (const line of priced) {
        const lot = await sqlInsertLot({
            id: metalId(),
            profileId,
            productId: null,
            title: line.title.trim(),
            grossMg: line.grossMg,
            remainingGrossMg: line.grossMg,
            remainingQty: line.qty,
            purityBps: line.touchBps,
            costTouchBps: line.touchBps,
            sourceBillId: bill.id,
        })
        await sqlInsertLine({
            id: metalId(),
            billId: bill.id,
            lotId: lot.id,
            title: line.title.trim(),
            grossMg: line.grossMg,
            touchBpsBilled: line.touchBps,
            makingPaise: line.makingPaise ?? 0,
            linePaise: line.linePaise,
            qty: line.qty,
        })
    }
    await appendLedger({
        partyAccountId: party.id,
        kind: "PURCHASE",
        paiseDelta: -(totalPaise - payNow),
        billId: bill.id,
        key: `bill:${bill.id}`,
    })
    if (payNow > 0) {
        const paymentId = metalId()
        await sqlInsertPayment(paymentId, profileId, party.id, input.method ?? "CASH", payNow)
        await sqlInsertAlloc(metalId(), paymentId, bill.id, payNow)
    }
    return bill
}

export async function recordSale(
    profileId: string,
    input: {
        partyId: string
        k24PaisePer10g: number
        lines: BillLineInput[]
        payNowPaise?: number
        method?: PayMethod
        dueOn?: Date | null
        note?: string
    },
) {
    if (input.k24PaisePer10g <= 0) throw new Error("Set today's 24K board first")
    if (!input.lines.length) throw new Error("Add at least one line")
    const party = await sqlPartyById(input.partyId, profileId)
    if (!party) throw new Error("Unknown shop")
    const priced = input.lines.map((line) => ({
        ...line,
        qty: line.qty ?? 1,
        linePaise: touchPaise(line.grossMg, line.touchBps, input.k24PaisePer10g) + Math.max(0, line.makingPaise ?? 0),
    }))
    const totalPaise = priced.reduce((s, l) => s + l.linePaise, 0)
    const payNow = Math.min(Math.max(0, input.payNowPaise ?? 0), totalPaise)

    const bill: BillRow = {
        id: metalId(),
        profileId,
        partyAccountId: party.id,
        kind: "SALE",
        k24PaisePer10g: input.k24PaisePer10g,
        totalPaise,
        paidPaise: payNow,
        payStatus: payStatus(totalPaise, payNow),
        dueOn: input.dueOn ?? null,
        publicToken: token(),
        liftedAt: null,
        createdAt: new Date(),
    }
    await sqlInsertBill(bill)
    for (const line of priced) {
        let lotId = line.lotId ?? null
        if (lotId) {
            const lot = await sqlLotById(lotId, profileId)
            if (!lot || lot.remainingGrossMg < line.grossMg) throw new Error(`Not enough stock for ${line.title}`)
            await sqlConsumeLot(lot.id, line.grossMg, line.qty)
        }
        await sqlInsertLine({
            id: metalId(),
            billId: bill.id,
            lotId,
            title: line.title.trim(),
            grossMg: line.grossMg,
            touchBpsBilled: line.touchBps,
            makingPaise: line.makingPaise ?? 0,
            linePaise: line.linePaise,
            qty: line.qty,
        })
    }
    await appendLedger({
        partyAccountId: party.id,
        kind: "SALE",
        paiseDelta: totalPaise - payNow,
        billId: bill.id,
        key: `bill:${bill.id}`,
    })
    if (payNow > 0) {
        const paymentId = metalId()
        await sqlInsertPayment(paymentId, profileId, party.id, input.method ?? "CASH", payNow)
        await sqlInsertAlloc(metalId(), paymentId, bill.id, payNow)
    }
    return bill
}

export async function recordPayment(
    profileId: string,
    input: { partyId: string; paise: number; method: PayMethod; billIds?: string[]; ref?: string },
) {
    if (input.paise <= 0) throw new Error("Payment must be more than zero")
    const party = await sqlPartyById(input.partyId, profileId)
    if (!party) throw new Error("Unknown party")
    const open = input.billIds?.length
        ? await sqlOpenBillsByIds(profileId, party.id, input.billIds)
        : await sqlOpenBills(profileId, party.id)
    if (!open.length) throw new Error("Nothing open to allocate")
    const paymentId = metalId()
    await sqlInsertPayment(paymentId, profileId, party.id, input.method, input.paise, input.ref)
    let left = input.paise
    for (const bill of open) {
        if (left <= 0) break
        const need = bill.totalPaise - bill.paidPaise
        if (need <= 0) continue
        const take = Math.min(need, left)
        await sqlInsertAlloc(metalId(), paymentId, bill.id, take)
        const paidPaise = bill.paidPaise + take
        await sqlMarkBillPaid(bill.id, paidPaise, payStatus(bill.totalPaise, paidPaise))
        left -= take
    }
    const sale = open.some((b) => b.kind === "SALE")
    await appendLedger({
        partyAccountId: party.id,
        kind: sale ? "PAYMENT_IN" : "PAYMENT_OUT",
        paiseDelta: sale ? -input.paise : input.paise,
        paymentId,
        key: `pay:${paymentId}`,
    })
    return { id: paymentId }
}

export async function cashflow(profileId: string) {
    const [recv, pay, lots, profile] = await Promise.all([
        sqlCashSums(profileId, "SALE"),
        sqlCashSums(profileId, "PURCHASE"),
        sqlListLots(profileId),
        prisma.profile.findUnique({ where: { id: profileId }, select: { personalityConfig: true } }),
    ])
    const rates = goldBoardFromConfig(profile?.personalityConfig)
    const metalOnHandPaise = lots.reduce((s, lot) => {
        if (!rates) return s
        return s + touchPaise(lot.remainingGrossMg, lot.costTouchBps || lot.purityBps, rates.k24PaisePer10g)
    }, 0)
    return {
        shopsOwe: recv.total - recv.paid,
        weOwe: pay.total - pay.paid,
        metalOnHandPaise,
        remainingMg: lots.reduce((s, lot) => s + lot.remainingGrossMg, 0),
        boxPaise: 0,
    }
}

export async function aging(profileId: string, kind: "SALE" | "PURCHASE" = "SALE") {
    const bills = await sqlAging(profileId, kind)
    const now = Date.now()
    return bills.map((bill) => {
        const due = bill.dueOn ? new Date(bill.dueOn).getTime() : new Date(bill.createdAt).getTime() + 15 * 86400000
        return {
            id: bill.id,
            token: bill.publicToken,
            partyId: bill.partyAccountId,
            name: bill.name,
            phone: bill.phone,
            totalPaise: bill.totalPaise,
            duePaise: bill.totalPaise - bill.paidPaise,
            dueOn: bill.dueOn,
            daysOverdue: Math.max(0, Math.floor((now - due) / 86400000)),
        }
    })
}

export function chaseHref(input: { phone: string | null; name: string; duePaise: number; upiId?: string | null }) {
    const n = (input.phone || "").replace(/\D/g, "")
    if (!n) return null
    const rupees = Math.round(input.duePaise / 100).toLocaleString("en-IN")
    const text = `Hi ${input.name}, ₹${rupees} is still open with us.${input.upiId ? ` UPI ${input.upiId}` : ""}`
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

export async function buyStockForStore(
    profileId: string,
    input: {
        supplierName: string
        phone?: string | null
        title: string
        grossMg: number
        costTouchBps: number
        makingPaise?: number
        k24PaisePer10g: number
        payNowPaise?: number
        dueOn?: Date | null
        thumbnailUrl?: string | null
    },
) {
    const party = await ensureParty(profileId, {
        kind: "SUPPLIER",
        displayName: input.supplierName,
        phone: input.phone,
    })
    const costPaise = touchPaise(input.grossMg, input.costTouchBps, input.k24PaisePer10g) + Math.max(0, input.makingPaise ?? 0)
    const metal: ProductMetal = {
        grossMg: input.grossMg,
        purityBps: K22_BPS,
        makingPaise: input.makingPaise ?? 0,
        costTouchBps: input.costTouchBps,
        costPaise,
    }
    const bill = await recordPurchase(profileId, {
        partyId: party.id,
        k24PaisePer10g: input.k24PaisePer10g,
        lines: [{ title: input.title, grossMg: input.grossMg, touchBps: input.costTouchBps, makingPaise: input.makingPaise }],
        payNowPaise: input.payNowPaise,
        dueOn: input.dueOn,
    })
    const product = await prisma.digitalProduct.create({
        data: {
            profileId,
            title: input.title.trim(),
            type: "PHYSICAL",
            fulfillment: "PHYSICAL",
            currency: "INR",
            priceCents: 0,
            weightGrams: Math.round(input.grossMg / 1000),
            stock: 1,
            isActive: true,
            thumbnailUrl: input.thumbnailUrl || null,
            variantsJson: writeProductMetal(null, { ...metal, sourceBillId: bill.id }),
        },
    })
    const lot = await sqlLotBySourceBill(bill.id)
    if (lot) await sqlSetLotProduct(lot.id, product.id)
    return { bill, product, party }
}

export async function acceptLift(storeProfileId: string, token: string) {
    const found = await sqlBillByToken(token)
    if (!found || found.bill.kind !== "SALE") throw new Error("That lift code is not a sale bill")
    if (found.bill.liftedAt) throw new Error("This parcel was already lifted")
    const board = goldBoardFromConfig(
        (await prisma.profile.findUnique({ where: { id: storeProfileId }, select: { personalityConfig: true } }))?.personalityConfig,
    )
    const first = found.lines[0]
    if (!first) throw new Error("Empty bill")
    const result = await buyStockForStore(storeProfileId, {
        supplierName: found.profile?.displayName || "Wholesaler",
        title: first.title,
        grossMg: found.lines.reduce((s, l) => s + l.grossMg, 0),
        costTouchBps: first.touchBpsBilled,
        makingPaise: found.lines.reduce((s, l) => s + l.makingPaise, 0),
        k24PaisePer10g: board?.k24PaisePer10g || found.bill.k24PaisePer10g,
    })
    await sqlMarkLifted(found.bill.id, storeProfileId)
    return { ...result, source: found.bill }
}

export function liftFingerprint(token: string) {
    return createHash("sha256").update(token).digest("hex").slice(0, 12)
}

export async function listParties(profileId: string) {
    return sqlListParties(profileId)
}

export async function listOpenLots(profileId: string) {
    return sqlListLots(profileId)
}

export async function peekSaleToken(token: string) {
    const found = await sqlBillByToken(token)
    if (!found || found.bill.kind !== "SALE") return null
    return {
        token: found.bill.publicToken,
        lifted: Boolean(found.bill.liftedAt),
        from: found.profile?.displayName || "Wholesaler",
        slug: found.profile?.slug || "",
        grams: found.lines.reduce((s, l) => s + l.grossMg, 0) / 1000,
        touch: found.lines[0]?.touchBpsBilled ?? 0,
        titles: found.lines.map((l) => l.title),
        public: found.profile?.isPublic,
    }
}
