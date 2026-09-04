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
    type DistroMeta,
    type DistroWarehouse,
} from "@/lib/distribute/meta"
import {
    stampGstInvoice,
    stateCodeFromDistroLocation,
} from "@/lib/billing/gst"
import {
    DISTRO_ASSIGNABLE_DESKS,
    assertDistroPermission,
    membershipRoleForDesk,
    membershipRoleToDesk,
    resolveDistroDeskPermissions,
    type DistroAssignableDesk,
    type DistroDesk,
    type DistroDeskPermissions,
} from "@/lib/distribute/desks"

type DistroActor = {
    profileId: string
    userId: string
    workspaceId: string | null
    role: string
    desk: DistroDesk | null
    perms: DistroDeskPermissions
    gstin: string | null
}

/**
 * Resolve the caller's workspace Membership for this distributor profile.
 * Profile ownership alone is not enough once invited seats exist — desk
 * permissions come from Membership.role (OWNER → admin by default).
 */
async function distroActor(profileId: string): Promise<DistroActor> {
    const user = await syncUser()
    if (!user) throw new Error("Sign in")

    const profile = await prisma.profile.findFirst({
        where: { id: profileId },
        select: { id: true, userId: true, roleTemplate: true, personalityConfig: true, gstin: true },
    })
    if (!profile) throw new Error("Not your workspace")
    if (profile.roleTemplate !== "DISTRIBUTOR") throw new Error("Not a distributor kit")

    const workspace = await prisma.workspace.findFirst({
        where: { profileId: profile.id },
        select: { id: true },
    })

    let role: string | null = null
    if (workspace) {
        const membership = await prisma.membership.findUnique({
            where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
            select: { role: true },
        })
        role = membership?.role ?? null
    }

    // Legacy / try-kit: profile owner without a membership row still gets OWNER.
    if (!role && profile.userId === user.id) role = "OWNER"
    if (!role) throw new Error("Not a workspace member")

    const perms = resolveDistroDeskPermissions(role, profile.personalityConfig)
    assertDistroPermission(perms, "read")

    return {
        profileId: profile.id,
        userId: user.id,
        workspaceId: workspace?.id ?? null,
        role,
        desk: perms.desk,
        perms,
        gstin: profile.gstin ?? null,
    }
}

export async function getDistroSeat(profileId: string) {
    const actor = await distroActor(profileId)
    const members = actor.perms.canInvite && actor.workspaceId
        ? await listMembers(actor.workspaceId)
        : []
    return {
        role: actor.role,
        desk: actor.desk,
        canCreate: actor.perms.canCreate,
        canApprove: actor.perms.canApprove,
        canWarehouse: actor.perms.canWarehouse,
        canAccounts: actor.perms.canAccounts,
        canInvite: actor.perms.canInvite,
        members,
    }
}

async function listMembers(workspaceId: string) {
    const rows = await prisma.membership.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
        select: { id: true, userId: true, role: true },
    })
    const users = rows.length
        ? await prisma.user.findMany({
            where: { id: { in: rows.map((m) => m.userId) } },
            select: { id: true, email: true, name: true },
        })
        : []
    const byId = new Map(users.map((u) => [u.id, u]))
    return rows.map((m) => {
        const u = byId.get(m.userId)
        return {
            id: m.id,
            userId: m.userId,
            email: u?.email || "",
            name: u?.name || "",
            role: m.role,
            desk: membershipRoleToDesk(m.role),
        }
    })
}

export async function assignDistroDesk(profileId: string, email: string, desk: DistroAssignableDesk) {
    const actor = await distroActor(profileId)
    if (!actor.perms.canInvite) throw new Error("Admin desk required to assign seats")
    if (!actor.workspaceId) throw new Error("No workspace")
    if (!DISTRO_ASSIGNABLE_DESKS.includes(desk)) throw new Error("Pick a desk")

    const cleaned = email.trim().toLowerCase()
    if (!cleaned || !cleaned.includes("@")) throw new Error("Enter their email")

    const target = await prisma.user.findUnique({ where: { email: cleaned }, select: { id: true } })
    if (!target) throw new Error("They need to sign in once first, then you can assign a desk")
    if (target.id === actor.userId) throw new Error("You already have a desk")

    const existing = await prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: target.id } },
        select: { role: true },
    })
    if (existing?.role === "OWNER") throw new Error("Cannot reassign the owner")

    const role = membershipRoleForDesk(desk)
    // Desk roles live on MembershipRole (SALES/WAREHOUSE/ACCOUNTS/ADMIN).
    await prisma.membership.upsert({
        where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: target.id } },
        create: { workspaceId: actor.workspaceId, userId: target.id, role: role as never },
        update: { role: role as never },
    })
    revalidatePath("/dashboard/orders")
    return { ok: true as const, desk, role }
}

export async function listDistroOrders(profileId: string) {
    await distroActor(profileId)
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
    await distroActor(profileId)
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
    const actor = await distroActor(input.profileId)
    assertDistroPermission(actor.perms, "create")

    const dealer = input.dealer.trim()
    if (!dealer) throw new Error("Name the dealer")
    if (!DISTRO_LOCATIONS.includes(input.location as (typeof DISTRO_LOCATIONS)[number])) throw new Error("Pick a location")
    if (!DISTRO_SALESMEN.includes(input.salesman as (typeof DISTRO_SALESMEN)[number])) throw new Error("Pick a salesman")
    const qtyLines = input.lines.filter((l) => l.qty > 0 && l.unitPaise >= 0)
    if (qtyLines.length === 0) throw new Error("Add at least one item")

    const products = await prisma.digitalProduct.findMany({
        where: { profileId: actor.profileId, id: { in: qtyLines.map((l) => l.productId) } },
    })
    const byId = new Map(products.map((p) => [p.id, p]))
    const priced = qtyLines.map((l) => {
        const p = byId.get(l.productId)
        if (!p) throw new Error("Unknown item")
        const unit = l.unitPaise || p.priceCents
        return { productId: p.id, title: p.title, qty: l.qty, unitPaise: unit, linePaise: l.qty * unit }
    })
    const total = orderTotalPaise(priced.map((l) => ({ qty: l.qty, unitPaise: l.unitPaise })))
    const last = await prisma.order.findFirst({ where: { profileId: actor.profileId }, orderBy: { number: "desc" }, select: { number: true } })
    const meta = parseDistroMeta(null, dealer, input.location)
    meta.salesman = input.salesman
    meta.dealer = dealer
    meta.location = input.location

    const order = await prisma.order.create({
        data: {
            profileId: actor.profileId,
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

function applyGstStamp(meta: DistroMeta, totalPaise: number, sellerGstin: string | null): DistroMeta {
    if (meta.accounts !== "BILLED") return meta
    const stamp = stampGstInvoice({
        gstin: sellerGstin,
        totalPaise,
        buyerStateCode: stateCodeFromDistroLocation(meta.location),
    })
    if (!stamp) {
        return {
            ...meta,
            gstin: "",
            taxablePaise: totalPaise,
            gstRateBps: 0,
            gstMode: "",
            gstPaise: 0,
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: 0,
        }
    }
    return {
        ...meta,
        gstin: stamp.gstin,
        taxablePaise: stamp.taxablePaise,
        gstRateBps: stamp.rateBps,
        gstMode: stamp.mode,
        gstPaise: stamp.gstPaise,
        cgstPaise: stamp.cgstPaise,
        sgstPaise: stamp.sgstPaise,
        igstPaise: stamp.igstPaise,
    }
}

async function patchMeta(
    profileId: string,
    orderId: string,
    patch: Partial<ReturnType<typeof parseDistroMeta>>,
    action: "approve" | "warehouse" | "accounts",
) {
    const actor = await distroActor(profileId)
    assertDistroPermission(actor.perms, action)

    const row = await prisma.order.findFirst({ where: { id: orderId, profileId: actor.profileId } })
    if (!row) throw new Error("Order not found")
    let meta = { ...parseDistroMeta(row.staffNote, row.guestName, row.tableLabel), ...patch }
    if (action === "accounts") {
        meta = applyGstStamp(meta, row.totalCents, actor.gstin)
    }
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
            // Persist GST amount on the order row for shared receipt views.
            taxCents: meta.accounts === "BILLED" ? meta.gstPaise : row.taxCents,
            subtotalCents: meta.accounts === "BILLED" && meta.taxablePaise > 0 ? meta.taxablePaise : row.subtotalCents,
        },
    })
    revalidatePath("/dashboard/orders")
}

export async function setDistroApproval(profileId: string, orderId: string, approval: DistroApproval) {
    await patchMeta(profileId, orderId, { approval }, "approve")
}

export async function setDistroWarehouse(profileId: string, orderId: string, warehouse: DistroWarehouse) {
    await patchMeta(profileId, orderId, { warehouse }, "warehouse")
}

export async function setDistroAccounts(profileId: string, orderId: string, accounts: DistroAccounts, invoice?: string) {
    await patchMeta(profileId, orderId, { accounts, invoice: invoice ?? "" }, "accounts")
}
