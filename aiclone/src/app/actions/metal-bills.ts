"use server"

import { revalidatePath } from "next/cache"
import { requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { prisma } from "@/lib/prisma"
import { goldBoardFromConfig } from "@/lib/metal/board"
import { isJewelryKit, isJewelryRetail, isJewelryWholesale } from "@/lib/metal/math"
import { touchPaise } from "@/lib/metal/touch"
import {
    JEWELLERY_GST_RATE_BPS,
    computeGstBreakup,
    gstReceiptLines,
    resolveBuyerStateCode,
    stampGstInvoice,
    stateCodeFromGstin,
} from "@/lib/billing/gst"
import type { ReceiptData } from "@/lib/receipt"
import {
    acceptLift,
    aging,
    buyStockForStore,
    cashflow,
    chaseHref,
    ensureParty,
    listOpenLots,
    listParties,
    peekSaleToken,
    recordPayment,
    recordPurchase,
    recordSale,
    type BillLineInput,
    type PartyKind,
    type PayMethod,
} from "@/lib/metal/ledger"

function boardK24(config: string | null | undefined) {
    const board = goldBoardFromConfig(config)
    if (!board) throw new Error("Set today's 24K board first")
    return board.k24PaisePer10g
}

function rupees(paise: number) {
    return `₹${(paise / 100).toLocaleString("en-IN")}`
}

function metalSaleReceipt(input: {
    shopName: string
    sellerGstin?: string | null
    buyerName: string
    buyerGstin?: string | null
    invoice: string
    invoiceDate: string
    totalPaise: number
    payStatus: string
    hsnSac: string
    lines: { title: string; qty: number; linePaise: number }[]
}): ReceiptData {
    const stamp = stampGstInvoice({
        gstin: input.sellerGstin,
        totalPaise: input.totalPaise,
        rateBps: JEWELLERY_GST_RATE_BPS,
        buyerStateCode: resolveBuyerStateCode(input.buyerGstin),
    })
    const rateBps = stamp?.rateBps ?? JEWELLERY_GST_RATE_BPS
    const gstLines = stamp
        ? gstReceiptLines(stamp).map((g) => ({ label: g.label, amount: rupees(g.paise) }))
        : []
    return {
        shopName: input.shopName,
        gstin: stamp?.gstin || input.sellerGstin || null,
        buyerName: input.buyerName,
        buyerGstin: input.buyerGstin || null,
        invoice: input.invoice,
        invoiceDate: input.invoiceDate,
        number: input.invoice,
        guestName: input.buyerName,
        status: "SALE",
        payStatus: input.payStatus,
        payMethod: "Metal bill",
        placedAt: input.invoiceDate,
        lines: input.lines.map((l) => {
            const br = computeGstBreakup(l.linePaise, {
                rateBps,
                sellerStateCode: stateCodeFromGstin(input.sellerGstin),
                buyerStateCode: resolveBuyerStateCode(input.buyerGstin),
            })
            return {
                qty: l.qty,
                title: l.title,
                hsn: input.hsnSac || "",
                rate: rupees(Math.round(l.linePaise / Math.max(1, l.qty))),
                taxable: rupees(br.taxablePaise),
                tax: rupees(br.gstPaise),
                lineTotal: rupees(l.linePaise),
            }
        }),
        subtotal: rupees(stamp?.taxablePaise ?? input.totalPaise),
        taxable: stamp ? rupees(stamp.taxablePaise) : null,
        gstLines,
        tax: !gstLines.length && stamp ? rupees(stamp.gstPaise) : null,
        total: rupees(input.totalPaise),
    }
}

export async function saveParty(input: {
    kind: PartyKind
    displayName: string
    phone?: string
    gstin?: string
    termsDays?: number
    creditLimitPaise?: number
}) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryKit(profile.roleTemplate)) throw new Error("Parties are for jewellery kits")
    const party = await ensureParty(profile.id, input)
    const gstin = (input.gstin || "").trim().toUpperCase()
    if (gstin) {
        await prisma.partyAccount.update({ where: { id: party.id }, data: { gstin } })
    }
    revalidatePath("/dashboard/leads")
    return { ...party, gstin: gstin || null }
}

export async function createMetalPurchase(input: {
    partyId: string
    lines: BillLineInput[]
    payNowPaise?: number
    method?: PayMethod
    dueDays?: number
}) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryWholesale(profile.roleTemplate) && !isJewelryRetail(profile.roleTemplate)) {
        throw new Error("Bills are for jewellery kits")
    }
    const dueOn = input.dueDays ? new Date(Date.now() + input.dueDays * 86400000) : null
    const bill = await recordPurchase(profile.id, {
        partyId: input.partyId,
        k24PaisePer10g: boardK24(profile.personalityConfig),
        lines: input.lines,
        payNowPaise: input.payNowPaise,
        method: input.method,
        dueOn,
    })
    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/money")
    revalidatePath("/dashboard/leads")
    return { id: bill.id, token: bill.publicToken }
}

export async function createMetalSale(input: {
    partyId: string
    lines: BillLineInput[]
    payNowPaise?: number
    method?: PayMethod
    dueDays?: number
    buyerGstin?: string
    hsnSac?: string
}) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryWholesale(profile.roleTemplate)) throw new Error("Sales bills are for wholesale")
    const dueOn = input.payNowPaise && input.payNowPaise > 0 && !input.dueDays
        ? null
        : new Date(Date.now() + (input.dueDays ?? 15) * 86400000)
    const k24 = boardK24(profile.personalityConfig)
    const bill = await recordSale(profile.id, {
        partyId: input.partyId,
        k24PaisePer10g: k24,
        lines: input.lines,
        payNowPaise: input.payNowPaise,
        method: input.method,
        dueOn: input.payNowPaise && input.payNowPaise >= 0 && input.dueDays === 0 ? null : dueOn,
    })

    const buyerGstin = (input.buyerGstin || "").trim().toUpperCase()
    const party = await prisma.partyAccount.findFirst({
        where: { id: input.partyId, profileId: profile.id },
        select: { displayName: true, gstin: true },
    })
    if (buyerGstin) {
        await prisma.partyAccount.update({ where: { id: input.partyId }, data: { gstin: buyerGstin } })
    }
    const effectiveBuyerGstin = buyerGstin || party?.gstin || ""
    const hsnSac = (input.hsnSac || "7113").trim()
    const invoice = `MB-${bill.id.slice(-6).toUpperCase()}`
    const invoiceDate = new Date().toLocaleString("en-IN")
    const stamp = stampGstInvoice({
        gstin: profile.gstin,
        totalPaise: bill.totalPaise,
        rateBps: JEWELLERY_GST_RATE_BPS,
        buyerStateCode: resolveBuyerStateCode(effectiveBuyerGstin),
    })
    await prisma.metalBill.update({
        where: { id: bill.id },
        data: {
            note: JSON.stringify({
                invoice,
                invoiceDate,
                sellerGstin: profile.gstin || "",
                buyerGstin: effectiveBuyerGstin,
                hsnSac,
                rateBps: stamp?.rateBps ?? JEWELLERY_GST_RATE_BPS,
                mode: stamp?.mode ?? "",
                taxablePaise: stamp?.taxablePaise ?? bill.totalPaise,
                gstPaise: stamp?.gstPaise ?? 0,
                cgstPaise: stamp?.cgstPaise ?? 0,
                sgstPaise: stamp?.sgstPaise ?? 0,
                igstPaise: stamp?.igstPaise ?? 0,
            }),
        },
    })

    const priced = input.lines.map((line) => ({
        title: line.title.trim() || "Lot",
        qty: line.qty ?? 1,
        linePaise: touchPaise(line.grossMg, line.touchBps, k24) + Math.max(0, line.makingPaise ?? 0),
    }))
    const receipt = metalSaleReceipt({
        shopName: profile.displayName,
        sellerGstin: profile.gstin,
        buyerName: party?.displayName || "Buyer",
        buyerGstin: effectiveBuyerGstin || null,
        invoice,
        invoiceDate,
        totalPaise: bill.totalPaise,
        payStatus: bill.payStatus,
        hsnSac,
        lines: priced,
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/money")
    revalidatePath("/dashboard/leads")
    return { id: bill.id, token: bill.publicToken, receipt }
}

export async function takeMetalPayment(input: { partyId: string; paise: number; method: PayMethod; billIds?: string[] }) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryKit(profile.roleTemplate)) throw new Error("Payments are for jewellery kits")
    await recordPayment(profile.id, input)
    revalidatePath("/dashboard/money")
    revalidatePath("/dashboard/leads")
}

export async function metalCashflow() {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryKit(profile.roleTemplate)) return null
    const [flow, overdue, payables] = await Promise.all([
        cashflow(profile.id),
        aging(profile.id, "SALE"),
        aging(profile.id, "PURCHASE"),
    ])
    return {
        ...flow,
        overdue: overdue.map((row) => ({
            ...row,
            chase: chaseHref({ phone: row.phone, name: row.name, duePaise: row.duePaise, upiId: profile.upiId }),
        })),
        payables: payables.map((row) => ({
            ...row,
            chase: chaseHref({ phone: row.phone, name: row.name, duePaise: row.duePaise, upiId: profile.upiId }),
        })),
    }
}

export async function buyStoreStock(input: {
    supplierName: string
    phone?: string
    title: string
    grossMg: number
    costTouchBps: number
    makingPaise?: number
    payNowPaise?: number
}) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryRetail(profile.roleTemplate)) throw new Error("Buy stock is for jewellery stores")
    const result = await buyStockForStore(profile.id, {
        ...input,
        k24PaisePer10g: boardK24(profile.personalityConfig),
    })
    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/money")
    return { productId: result.product.id, billId: result.bill.id }
}

export async function liftWholesaleBill(token: string) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryRetail(profile.roleTemplate)) throw new Error("Only a store can lift a parcel")
    const result = await acceptLift(profile.id, token.trim())
    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/money")
    return { productId: result.product.id }
}

export async function listMetalParties() {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    const rows = await listParties(profile.id)
    const gstins = await prisma.partyAccount.findMany({
        where: { profileId: profile.id },
        select: { id: true, gstin: true },
    })
    const byId = new Map(gstins.map((g) => [g.id, g.gstin]))
    return rows.map((r) => ({ ...r, gstin: byId.get(r.id) ?? null }))
}

export async function listMetalLots() {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    return listOpenLots(profile.id)
}

export async function peekLift(token: string) {
    return peekSaleToken(token.trim())
}
