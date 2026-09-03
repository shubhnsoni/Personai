"use server"

import { revalidatePath } from "next/cache"
import { requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { goldBoardFromConfig } from "@/lib/metal/board"
import { isJewelryKit, isJewelryRetail, isJewelryWholesale } from "@/lib/metal/math"
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

export async function saveParty(input: {
    kind: PartyKind
    displayName: string
    phone?: string
    termsDays?: number
    creditLimitPaise?: number
}) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryKit(profile.roleTemplate)) throw new Error("Parties are for jewellery kits")
    const party = await ensureParty(profile.id, input)
    revalidatePath("/dashboard/leads")
    return party
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
}) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    if (!isJewelryWholesale(profile.roleTemplate)) throw new Error("Sales bills are for wholesale")
    const dueOn = input.payNowPaise && input.payNowPaise > 0 && !input.dueDays
        ? null
        : new Date(Date.now() + (input.dueDays ?? 15) * 86400000)
    const bill = await recordSale(profile.id, {
        partyId: input.partyId,
        k24PaisePer10g: boardK24(profile.personalityConfig),
        lines: input.lines,
        payNowPaise: input.payNowPaise,
        method: input.method,
        dueOn: input.payNowPaise && input.payNowPaise >= 0 && input.dueDays === 0 ? null : dueOn,
    })
    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/money")
    revalidatePath("/dashboard/leads")
    return { id: bill.id, token: bill.publicToken }
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
    return listParties(profile.id)
}

export async function listMetalLots() {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    return listOpenLots(profile.id)
}

export async function peekLift(token: string) {
    return peekSaleToken(token.trim())
}
