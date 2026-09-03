"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import {
    DISTRO_LOCATIONS,
    DISTRO_SALESMEN,
    parseDistroMeta,
    writeDistroMeta,
    orderTotalPaise,
    type DistroAccounts,
    type DistroApproval,
    type DistroWarehouse,
} from "@/lib/distribute/meta"

async function ownedProfile(profileId: string) {
    const user = await syncUser()
    if (!user) throw new Error("Sign in")
    const profile = user.profiles.find((p) => p.id === profileId)
    if (!profile) throw new Error("Not your workspace")
    if (profile.roleTemplate !== "DISTRIBUTOR") throw new Error("Not a distributor kit")
    return profile
}

export async function listDistroOrders(profileId: string) {
    await ownedProfile(profileId)
    const rows = await prisma.order.findMany({
        where: { profileId },
        include: { lines: { orderBy: { createdAt: "asc" } } },
        orderBy: { placedAt: "desc" },
        take: 80,
    })
    return rows.map((row) => {
        const meta = parseDistroMeta(row.staffNote, row.guestName, row.tableLabel)
        return {
            id: row.id,
            number: row.number,
            placedAt: row.placedAt.toISOString(),
            totalPaise: row.totalCents,
            currency: row.currency,
            meta,
            lines: row.lines.map((l) => ({
                id: l.id,
                title: l.titleSnapshot,
                qty: l.qty,
                unitPaise: l.unitPriceCents,
                linePaise: l.lineTotalCents,
            })),
        }
    })
}

export async function listDistroCatalog(profileId: string) {
    await ownedProfile(profileId)
    return prisma.digitalProduct.findMany({
        where: { profileId, isActive: true },
        orderBy: { title: "asc" },
        select: { id: true, title: true, category: true, priceCents: true, stock: true, sku: true },
    })
}

export async function placeDistroOrder(input: {
    profileId: string
    dealer: string
    location: string
    salesman: string
    lines: { productId: string; qty: number; unitPaise: number }[]
}) {
    const profile = await ownedProfile(input.profileId)
    const dealer = input.dealer.trim()
    if (!dealer) throw new Error("Name the dealer")
    if (!DISTRO_LOCATIONS.includes(input.location as (typeof DISTRO_LOCATIONS)[number])) throw new Error("Pick a location")
    if (!DISTRO_SALESMEN.includes(input.salesman as (typeof DISTRO_SALESMEN)[number])) throw new Error("Pick a salesman")
    const qtyLines = input.lines.filter((l) => l.qty > 0 && l.unitPaise >= 0)
    if (qtyLines.length === 0) throw new Error("Add at least one item")

    const products = await prisma.digitalProduct.findMany({
        where: { profileId: profile.id, id: { in: qtyLines.map((l) => l.productId) } },
    })
    const byId = new Map(products.map((p) => [p.id, p]))
    const priced = qtyLines.map((l) => {
        const p = byId.get(l.productId)
        if (!p) throw new Error("Unknown item")
        const unit = l.unitPaise || p.priceCents
        return { productId: p.id, title: p.title, qty: l.qty, unitPaise: unit, linePaise: l.qty * unit }
    })
    const total = orderTotalPaise(priced.map((l) => ({ qty: l.qty, unitPaise: l.unitPaise })))
    const last = await prisma.order.findFirst({ where: { profileId: profile.id }, orderBy: { number: "desc" }, select: { number: true } })
    const meta = parseDistroMeta(null, dealer, input.location)
    meta.salesman = input.salesman
    meta.dealer = dealer
    meta.location = input.location

    const order = await prisma.order.create({
        data: {
            profileId: profile.id,
            publicToken: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            number: (last?.number || 0) + 1,
            businessDate: new Date(),
            channel: "TAKEAWAY",
            status: "PLACED",
            guestName: dealer,
            tableLabel: input.location,
            staffNote: writeDistroMeta(meta),
            subtotalCents: total,
            totalCents: total,
            currency: "INR",
            payStatus: "UNPAID",
            lines: {
                create: priced.map((l) => ({
                    productId: l.productId,
                    titleSnapshot: l.title,
                    qty: l.qty,
                    unitPriceCents: l.unitPaise,
                    lineTotalCents: l.linePaise,
                })),
            },
        },
    })
    revalidatePath("/dashboard/orders")
    return { id: order.id, number: order.number }
}

async function patchMeta(profileId: string, orderId: string, patch: Partial<ReturnType<typeof parseDistroMeta>>) {
    await ownedProfile(profileId)
    const row = await prisma.order.findFirst({ where: { id: orderId, profileId } })
    if (!row) throw new Error("Order not found")
    const meta = { ...parseDistroMeta(row.staffNote, row.guestName, row.tableLabel), ...patch }
    const status =
        meta.accounts === "BILLED" ? "PAID"
            : meta.warehouse === "DISPATCHED" ? "READY"
                : meta.approval === "APPROVED" ? "ACCEPTED"
                    : meta.approval === "NOT_APPROVED" ? "CANCELLED"
                        : "PLACED"
    await prisma.order.update({
        where: { id: orderId },
        data: {
            staffNote: writeDistroMeta(meta),
            guestName: meta.dealer,
            tableLabel: meta.location,
            status: status as "PLACED" | "ACCEPTED" | "READY" | "PAID" | "CANCELLED",
            payStatus: meta.accounts === "BILLED" ? "PAID" : "UNPAID",
            paymentRef: meta.invoice || null,
            paidAt: meta.accounts === "BILLED" ? new Date() : null,
        },
    })
    revalidatePath("/dashboard/orders")
}

export async function setDistroApproval(profileId: string, orderId: string, approval: DistroApproval) {
    await patchMeta(profileId, orderId, { approval })
}

export async function setDistroWarehouse(profileId: string, orderId: string, warehouse: DistroWarehouse) {
    await patchMeta(profileId, orderId, { warehouse })
}

export async function setDistroAccounts(profileId: string, orderId: string, accounts: DistroAccounts, invoice?: string) {
    await patchMeta(profileId, orderId, { accounts, invoice: invoice ?? "" })
}
