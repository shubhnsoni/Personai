"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { publish } from "@/lib/realtime"
import { createRestaurantOrderRecord } from "@/lib/restaurant-order-service"
import {
    assertOrderLineTransition,
    assertOrderTransition,
    nextOrderStatus,
    type CreateRestaurantOrderInput,
    type RestaurantOrderLineStatus,
    type RestaurantOrderStatus,
} from "@/lib/restaurant-orders"

const EVENT_SELECT = {
    seq: true,
    kind: true,
    from: true,
    to: true,
    at: true,
    orderLineId: true,
} satisfies Prisma.OrderEventSelect

type CreatedEvent = {
    seq: bigint
    kind: string
    from: string | null
    to: string
    at: Date
    orderLineId: string | null
}

/**
 * Fan out committed events. Always called after the transaction returns, never
 * inside it, so a rolled-back write can never be broadcast.
 */
function emitOrderEvents(profileId: string, orderId: string, orderNumber: number, events: CreatedEvent[]) {
    for (const event of events) {
        publish(profileId, {
            seq: event.seq.toString(),
            orderId,
            orderNumber,
            kind: event.kind,
            from: event.from,
            to: event.to,
            at: event.at.toISOString(),
            orderLineId: event.orderLineId,
        })
    }
}

export async function createRestaurantOrder(input: CreateRestaurantOrderInput) {
    const result = await createRestaurantOrderRecord(input)

    // A replay is not a new fact, so it must not re-broadcast.
    if (!result.replayed) {
        const created = await prisma.order.findUnique({
            where: { id: result.id },
            select: {
                profileId: true,
                number: true,
                events: { orderBy: { seq: "asc" }, take: 1, select: EVENT_SELECT },
            },
        })
        if (created) emitOrderEvents(created.profileId, result.id, created.number, created.events)
    }

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
        const order = await tx.order.findUnique({
            where: { id },
            select: { profileId: true, status: true, number: true },
        })
        if (!order) throw new Error("Order not found.")
        assertOwned(owner.profileId, order.profileId)
        const next = nextOrderStatus(order.status)
        if (!next || next === "PAID") throw new Error("This order cannot be advanced further. Use Mark paid after service.")
        const at = new Date()
        await tx.order.update({
            where: { id },
            data: { status: next, ...statusTimestamp(next, at) },
        })
        const event = await tx.orderEvent.create({
            data: {
                orderId: id,
                kind: "ORDER_STATUS",
                from: order.status,
                to: next,
                actor: "STAFF",
                actorId: owner.actorId,
                at,
            },
            select: EVENT_SELECT,
        })
        return { id, status: next, profileId: order.profileId, number: order.number, events: [event] }
    })
    emitOrderEvents(result.profileId, result.id, result.number, result.events)
    revalidatePath("/dashboard/orders")
    return { id: result.id, status: result.status }
}

export async function setLineStatus(orderLineId: string, nextStatus: RestaurantOrderLineStatus) {
    const id = orderLineId.trim()
    if (!id) throw new Error("Order line is required.")
    const owner = await requireOrderOwner()
    const result = await prisma.$transaction(async (tx) => {
        const line = await tx.orderLine.findUnique({
            where: { id },
            select: {
                status: true,
                order: { select: { id: true, profileId: true, status: true, number: true } },
            },
        })
        if (!line) throw new Error("Order line not found.")
        assertOwned(owner.profileId, line.order.profileId)
        if (line.order.status === "CANCELLED" || line.order.status === "PAID") {
            throw new Error("Lines on a closed order cannot be changed.")
        }
        assertOrderLineTransition(line.status, nextStatus)
        const at = new Date()
        await tx.orderLine.update({ where: { id }, data: { status: nextStatus } })
        const event = await tx.orderEvent.create({
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
            select: EVENT_SELECT,
        })
        return {
            id,
            status: nextStatus,
            profileId: line.order.profileId,
            orderId: line.order.id,
            number: line.order.number,
            events: [event],
        }
    })
    emitOrderEvents(result.profileId, result.orderId, result.number, result.events)
    revalidatePath("/dashboard/orders")
    return { id: result.id, status: result.status }
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
            select: { profileId: true, status: true, payStatus: true, number: true },
        })
        if (!order) throw new Error("Order not found.")
        assertOwned(owner.profileId, order.profileId)
        if (order.status === "PAID" && order.payStatus === "PAID") {
            return {
                id,
                status: "PAID" as const,
                profileId: order.profileId,
                number: order.number,
                events: [] as CreatedEvent[],
            }
        }
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
        const statusEvent = await tx.orderEvent.create({
            data: {
                orderId: id,
                kind: "ORDER_STATUS",
                from: order.status,
                to: "PAID",
                actor: "STAFF",
                actorId: owner.actorId,
                at,
            },
            select: EVENT_SELECT,
        })
        const paymentEvent = await tx.orderEvent.create({
            data: {
                orderId: id,
                kind: "PAYMENT_STATUS",
                from: order.payStatus,
                to: "PAID",
                actor: "STAFF",
                actorId: owner.actorId,
                at,
                metadata: cleanRef ? { paymentRef: cleanRef } : undefined,
            },
            select: EVENT_SELECT,
        })
        return {
            id,
            status: "PAID" as const,
            profileId: order.profileId,
            number: order.number,
            events: [statusEvent, paymentEvent],
        }
    })
    emitOrderEvents(result.profileId, result.id, result.number, result.events)
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return { id: result.id, status: result.status }
}

export async function cancelOrder(orderId: string, reason: string) {
    const id = orderId.trim()
    if (!id) throw new Error("Order is required.")
    const cleanReason = reason.trim()
    if (!cleanReason) throw new Error("Cancellation reason is required.")
    if (cleanReason.length > 500) throw new Error("Cancellation reason is too long.")
    const owner = await requireOrderOwner()

    const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
            where: { id },
            select: { profileId: true, status: true, number: true },
        })
        if (!order) throw new Error("Order not found.")
        assertOwned(owner.profileId, order.profileId)
        if (order.status === "PAID") throw new Error("A paid order cannot be cancelled.")
        if (order.status === "CANCELLED") {
            return {
                id,
                status: "CANCELLED" as const,
                profileId: order.profileId,
                number: order.number,
                events: [] as CreatedEvent[],
            }
        }
        const at = new Date()
        await tx.order.update({
            where: { id },
            data: { status: "CANCELLED", cancelledAt: at, cancelReason: cleanReason },
        })
        const event = await tx.orderEvent.create({
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
            select: EVENT_SELECT,
        })
        return {
            id,
            status: "CANCELLED" as const,
            profileId: order.profileId,
            number: order.number,
            events: [event],
        }
    })
    emitOrderEvents(result.profileId, result.id, result.number, result.events)
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return { id: result.id, status: result.status }
}
