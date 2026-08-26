"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { createRestaurantOrderRecord } from "@/lib/restaurant-order-service"
import {
    assertOrderLineTransition,
    assertOrderTransition,
    nextOrderStatus,
    type CreateRestaurantOrderInput,
    type RestaurantOrderLineStatus,
    type RestaurantOrderStatus,
} from "@/lib/restaurant-orders"

export async function createRestaurantOrder(input: CreateRestaurantOrderInput) {
    const result = await createRestaurantOrderRecord(input)
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return result
}

async function requireOrderOwner() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!user || !profile) throw new Error("Unauthorized")
    return { actorId: user.id, profileId: profile.id }
}

function assertOwned(profileId: string, actualProfileId: string) {
    if (profileId !== actualProfileId) throw new Error("Unauthorized")
}

function statusTimestamp(status: RestaurantOrderStatus, at: Date): Prisma.OrderUpdateInput {
    switch (status) {
        case "ACCEPTED":
            return { acceptedAt: at }
        case "PREPARING":
            return { preparingAt: at }
        case "READY":
            return { readyAt: at }
        case "SERVED":
            return { servedAt: at }
        default:
            return {}
    }
}

export async function advanceOrder(orderId: string) {
    const id = orderId.trim()
    if (!id) throw new Error("Order is required.")
    const owner = await requireOrderOwner()
    const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id }, select: { profileId: true, status: true } })
        if (!order) throw new Error("Order not found.")
        assertOwned(owner.profileId, order.profileId)
        const next = nextOrderStatus(order.status)
        if (!next || next === "PAID") throw new Error("This order cannot be advanced further. Use Mark paid after service.")
        const at = new Date()
        await tx.order.update({
            where: { id },
            data: { status: next, ...statusTimestamp(next, at) },
        })
        await tx.orderEvent.create({
            data: {
                orderId: id,
                kind: "ORDER_STATUS",
                from: order.status,
                to: next,
                actor: "STAFF",
                actorId: owner.actorId,
                at,
            },
        })
        return { id, status: next }
    })
    revalidatePath("/dashboard/orders")
    return result
}

export async function setLineStatus(orderLineId: string, nextStatus: RestaurantOrderLineStatus) {
    const id = orderLineId.trim()
    if (!id) throw new Error("Order line is required.")
    const owner = await requireOrderOwner()
    const result = await prisma.$transaction(async (tx) => {
        const line = await tx.orderLine.findUnique({
            where: { id },
            select: { status: true, order: { select: { id: true, profileId: true, status: true } } },
        })
        if (!line) throw new Error("Order line not found.")
        assertOwned(owner.profileId, line.order.profileId)
        if (line.order.status === "CANCELLED" || line.order.status === "PAID") {
            throw new Error("Lines on a closed order cannot be changed.")
        }
        assertOrderLineTransition(line.status, nextStatus)
        const at = new Date()
        await tx.orderLine.update({ where: { id }, data: { status: nextStatus } })
        await tx.orderEvent.create({
            data: {
                orderId: line.order.id,
                orderLineId: id,
                kind: "LINE_STATUS",
                from: line.status,
                to: nextStatus,
                actor: "STAFF",
                actorId: owner.actorId,
                at,
            },
        })
        return { id, status: nextStatus }
    })
    revalidatePath("/dashboard/orders")
    return result
}

export async function markOrderPaid(orderId: string, paymentRef?: string) {
    const id = orderId.trim()
    if (!id) throw new Error("Order is required.")
    const owner = await requireOrderOwner()
    const cleanRef = paymentRef?.trim() || null
    if (cleanRef && cleanRef.length > 200) throw new Error("Payment reference is too long.")

    const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
            where: { id },
            select: { profileId: true, status: true, payStatus: true },
        })
        if (!order) throw new Error("Order not found.")
        assertOwned(owner.profileId, order.profileId)
        if (order.status === "PAID" && order.payStatus === "PAID") return { id, status: "PAID" as const }
        assertOrderTransition(order.status, "PAID")
        const at = new Date()
        await tx.order.update({
            where: { id },
            data: {
                status: "PAID",
                payStatus: "PAID",
                paidAt: at,
                paidBy: owner.actorId,
                paymentRef: cleanRef,
            },
        })
        await tx.orderEvent.createMany({
            data: [
                {
                    orderId: id,
                    kind: "ORDER_STATUS",
                    from: order.status,
                    to: "PAID",
                    actor: "STAFF",
                    actorId: owner.actorId,
                    at,
                },
                {
                    orderId: id,
                    kind: "PAYMENT_STATUS",
                    from: order.payStatus,
                    to: "PAID",
                    actor: "STAFF",
                    actorId: owner.actorId,
                    at,
                    metadata: cleanRef ? { paymentRef: cleanRef } : undefined,
                },
            ],
        })
        return { id, status: "PAID" as const }
    })
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return result
}

export async function cancelOrder(orderId: string, reason: string) {
    const id = orderId.trim()
    if (!id) throw new Error("Order is required.")
    const cleanReason = reason.trim()
    if (!cleanReason) throw new Error("Cancellation reason is required.")
    if (cleanReason.length > 500) throw new Error("Cancellation reason is too long.")
    const owner = await requireOrderOwner()

    const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id }, select: { profileId: true, status: true } })
        if (!order) throw new Error("Order not found.")
        assertOwned(owner.profileId, order.profileId)
        if (order.status === "PAID") throw new Error("A paid order cannot be cancelled.")
        if (order.status === "CANCELLED") return { id, status: "CANCELLED" as const }
        const at = new Date()
        await tx.order.update({
            where: { id },
            data: { status: "CANCELLED", cancelledAt: at, cancelReason: cleanReason },
        })
        await tx.orderEvent.create({
            data: {
                orderId: id,
                kind: "ORDER_STATUS",
                from: order.status,
                to: "CANCELLED",
                actor: "STAFF",
                actorId: owner.actorId,
                at,
                metadata: { reason: cleanReason },
            },
        })
        return { id, status: "CANCELLED" as const }
    })
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return result
}
