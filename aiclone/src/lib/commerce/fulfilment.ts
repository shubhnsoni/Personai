import type { InventoryService } from "@/lib/inventory/engine"

import {
    ALLOCATING_FULFILMENT_STATES,
    FULFILMENT_TIMESTAMP_FIELD,
    ITEMS_REQUIRED_FULFILMENT_STATES,
    STOCK_CONSUMING_FULFILMENT_STATES,
    fulfilmentFlow,
    remainingToFulfil,
    type FulfilmentStateValue,
} from "./lifecycle"
import type { CommerceActor, CommerceContext } from "./shared"

/**
 * Fulfilment: what physically shipped, and when.
 *
 * This service does NOT keep its own stock balances. Reservations and movements stay in
 * src/lib/inventory, and a shipment reaching SHIPPED consumes the holds on its order lines
 * through InventoryService. That is why stock leaves at SHIPPED and not at pack time, when
 * the goods are still on the shelf, nor at delivery, when they left days ago.
 *
 * Carrier, trackingNumber and trackingUrl are owner-entered strings. Nothing here contacts a
 * carrier, and the UI says so, so a tracking number means "the owner typed this".
 */

export type LineAllocation = Readonly<{
    orderLineId: string
    title: string
    ordered: number
    allocated: number
    remaining: number
    fulfilled: number
}>

export class FulfilmentService {
    constructor(
        private readonly ctx: CommerceContext,
        private readonly inventory: InventoryService,
    ) {}

    // ---- reads ---------------------------------------------------------

    /**
     * The owner's orders, so a console can pick one to ship or accept a return against.
     * Read-only and profile-scoped; nothing else in the platform exposes this list.
     */
    async listOrders(workspaceId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const rows = await this.ctx.db.order.findMany({
            where: { profileId },
            select: {
                id: true,
                number: true,
                status: true,
                payStatus: true,
                channel: true,
                totalCents: true,
                currency: true,
                guestName: true,
                placedAt: true,
                _count: { select: { lines: true, Fulfilment: true, ReturnRequest: true } },
            },
            orderBy: [{ placedAt: "desc" }, { id: "asc" }],
            take: 200,
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    id: r.id,
                    number: Number(r.number),
                    status: r.status,
                    payStatus: r.payStatus,
                    channel: r.channel,
                    totalCents: Number(r.totalCents),
                    currency: r.currency,
                    guestName: r.guestName,
                    placedAt: r.placedAt,
                    lineCount: r._count.lines,
                    fulfilmentCount: r._count.Fulfilment,
                    returnCount: r._count.ReturnRequest,
                }),
            ),
        )
    }

    async list(workspaceId: string, orderId?: string | null) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const scoped = orderId?.trim() || null
        if (scoped) await this.ctx.ownedOrder(profileId, scoped)
        const rows = await this.ctx.db.fulfilment.findMany({
            where: { profileId, ...(scoped ? { orderId: scoped } : {}) },
            include: { items: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        for (const r of rows) if (r.profileId !== profileId) this.ctx.denied()
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    ...r,
                    allowedTransitions: fulfilmentFlow.allowedFrom(r.state as FulfilmentStateValue),
                }),
            ),
        )
    }

    async get(workspaceId: string, fulfilmentId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const row = await this.ctx.ownedFulfilment(profileId, fulfilmentId)
        return Object.freeze({
            ...row,
            allowedTransitions: fulfilmentFlow.allowedFrom(row.state as FulfilmentStateValue),
        })
    }

    /**
     * How much of each order line is still shippable, and how much has actually shipped.
     * Derived on every read from the fulfilment lines themselves — a stored counter would go
     * stale the moment a shipment was cancelled.
     */
    async allocations(workspaceId: string, orderId: string): Promise<readonly LineAllocation[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const order = await this.ctx.ownedOrder(profileId, orderId)
        const lines = await this.ctx.db.orderLine.findMany({
            where: { orderId: order.id },
            select: { id: true, qty: true, titleSnapshot: true },
            orderBy: { createdAt: "asc" },
        })
        const items = await this.ctx.db.fulfilmentItem.findMany({
            where: { fulfilment: { orderId: order.id } },
            select: { orderLineId: true, qty: true, fulfilment: { select: { state: true } } },
        })
        return Object.freeze(
            lines.map((line) => {
                const mine = items.filter((i) => i.orderLineId === line.id)
                const allocated = mine
                    .filter((i) => (ALLOCATING_FULFILMENT_STATES as readonly string[]).includes(i.fulfilment.state))
                    .reduce((sum, i) => sum + Number(i.qty), 0)
                const fulfilled = mine
                    .filter((i) => i.fulfilment.state === "SHIPPED" || i.fulfilment.state === "DELIVERED")
                    .reduce((sum, i) => sum + Number(i.qty), 0)
                return Object.freeze({
                    orderLineId: line.id,
                    title: line.titleSnapshot,
                    ordered: Number(line.qty),
                    allocated,
                    remaining: remainingToFulfil(Number(line.qty), allocated),
                    fulfilled,
                })
            }),
        )
    }

    // ---- writes --------------------------------------------------------

    async create(
        workspaceId: string,
        input: Readonly<{
            orderId: string
            reference: string
            locationId?: string | null
            carrier?: string | null
            trackingNumber?: string | null
            trackingUrl?: string | null
            idempotencyKey?: string | null
        }>,
        actor: CommerceActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const order = await this.ctx.ownedOrder(profileId, input.orderId)
        const reference = this.ctx.required(input.reference, "reference")
        const locationId = await this.ctx.assertLocation(profileId, input.locationId?.trim() || null)
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.fulfilment.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
                include: { items: true },
            })
            if (existing) return { fulfilment: existing, replayed: true }
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.fulfilment.create({
                    data: {
                        profileId,
                        orderId: order.id,
                        locationId,
                        reference,
                        carrier: input.carrier?.trim() || null,
                        trackingNumber: input.trackingNumber?.trim() || null,
                        trackingUrl: input.trackingUrl?.trim() || null,
                        idempotencyKey,
                    },
                    include: { items: true },
                })
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "FULFILMENT",
                    subjectType: "FULFILMENT",
                    subjectId: row.id,
                    to: "DRAFT",
                    actor,
                    orderId: order.id,
                })
                return row
            })
            return { fulfilment: created, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, `A shipment with reference ${reference} already exists`)
        }
    }

    /**
     * Adds part or all of an order line to a draft shipment.
     *
     * Refuses more than the line has left, naming the remaining quantity — a storefront needs
     * that number, not just a no. Only a DRAFT shipment can gain lines: adding to something
     * already packed or shipped would describe a box that has been sealed.
     */
    async addItem(
        workspaceId: string,
        fulfilmentId: string,
        input: Readonly<{ orderLineId: string; variantId?: string | null; qty?: number | null }>,
        actor: CommerceActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const fulfilment = await this.ctx.ownedFulfilment(profileId, fulfilmentId)
        const line = await this.ctx.ownedOrderLine(profileId, input.orderLineId)

        if (fulfilment.state !== "DRAFT") {
            this.ctx.conflict(`A ${fulfilment.state.toLowerCase()} shipment cannot gain new lines`)
        }
        if (line.orderId !== fulfilment.orderId) {
            this.ctx.conflict("That order line belongs to a different order")
        }

        const variantId = input.variantId?.trim() || null
        let resolvedVariantId: string
        if (variantId) {
            const variant = await this.ctx.ownedVariant(profileId, variantId)
            if (line.productId && variant.productId !== line.productId) {
                this.ctx.conflict("That variant belongs to a different product than the order line")
            }
            resolvedVariantId = variant.id
        } else {
            if (!line.productId) {
                this.ctx.conflict("This order line has no product, so a variant must be named explicitly")
            }
            resolvedVariantId = await this.inventory.ensureDefaultVariant(profileId, line.productId)
        }

        const allocations = await this.allocations(workspaceId, fulfilment.orderId)
        const allocation = allocations.find((a) => a.orderLineId === line.id)
        const remaining = allocation?.remaining ?? 0
        const qty = input.qty ?? remaining
        this.ctx.positiveInt(qty, "qty")
        if (qty > remaining) {
            this.ctx.conflict(`Only ${remaining} units of that line are still unshipped; ${qty} were requested`, {
                remaining,
                requested: qty,
                ordered: allocation?.ordered ?? 0,
                allocated: allocation?.allocated ?? 0,
            })
        }

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.fulfilmentItem.create({
                    data: { fulfilmentId: fulfilment.id, orderLineId: line.id, variantId: resolvedVariantId, qty },
                })
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "FULFILMENT",
                    subjectType: "FULFILMENT",
                    subjectId: fulfilment.id,
                    to: "LINE_ADDED",
                    actor,
                    orderId: fulfilment.orderId,
                    metadata: { orderLineId: line.id, variantId: resolvedVariantId, qty },
                })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, "That order line is already on this shipment")
        }
    }

    /**
     * Moves a shipment through its lifecycle.
     *
     * PACKED requires at least one line. SHIPPED consumes any hold on the shipment's order
     * lines through the inventory engine, which is what actually takes the units off the
     * shelf; a line with no hold is shipped without one rather than refused, because stock
     * tracking is optional per record.
     */
    async transition(
        workspaceId: string,
        fulfilmentId: string,
        to: FulfilmentStateValue,
        actor: CommerceActor,
        options?: Readonly<{ reason?: string | null; carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null }>,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const fulfilment = await this.ctx.ownedFulfilment(profileId, fulfilmentId)
        const from = fulfilment.state as FulfilmentStateValue

        if (fulfilmentFlow.isTerminal(from)) {
            this.ctx.conflict(`This shipment is already ${from.toLowerCase()} and cannot change`)
        }
        if (!fulfilmentFlow.can(from, to)) {
            this.ctx.conflict(`Cannot move a ${from.toLowerCase()} shipment to ${to.toLowerCase()}`)
        }
        if (ITEMS_REQUIRED_FULFILMENT_STATES.includes(to) && fulfilment.items.length === 0) {
            this.ctx.conflict("A shipment with no lines cannot be packed")
        }

        const consumed: string[] = []
        if (STOCK_CONSUMING_FULFILMENT_STATES.includes(to)) {
            for (const item of fulfilment.items) {
                const hold = await this.ctx.db.inventoryReservation.findUnique({
                    where: { orderLineId: item.orderLineId },
                    select: { id: true, state: true },
                })
                if (hold && hold.state === "HELD") {
                    await this.inventory.settleReservation(workspaceId, hold.id, "CONSUMED", {
                        actorType: actor.actorType === "CUSTOMER" ? "SYSTEM" : actor.actorType,
                        actorId: actor.actorId,
                    })
                    consumed.push(hold.id)
                }
            }
        }

        const stamp = FULFILMENT_TIMESTAMP_FIELD[to]
        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.fulfilment.update({
                where: { id: fulfilment.id },
                data: {
                    state: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: options?.reason?.trim() || null } : {}),
                    ...(options?.carrier !== undefined ? { carrier: options.carrier?.trim() || null } : {}),
                    ...(options?.trackingNumber !== undefined
                        ? { trackingNumber: options.trackingNumber?.trim() || null }
                        : {}),
                    ...(options?.trackingUrl !== undefined ? { trackingUrl: options.trackingUrl?.trim() || null } : {}),
                },
                include: { items: true },
            })
            await this.ctx.appendEvent(tx, {
                profileId,
                kind: "FULFILMENT",
                subjectType: "FULFILMENT",
                subjectId: fulfilment.id,
                from,
                to,
                actor,
                orderId: fulfilment.orderId,
                ...(consumed.length > 0 ? { metadata: { consumedReservations: consumed } } : {}),
            })
            return row
        })
    }
}
