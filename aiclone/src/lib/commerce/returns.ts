import type { InventoryService } from "@/lib/inventory/engine"
import { PersistenceError } from "@/lib/persistence/errors"

import {
    CLAIMING_RETURN_STATES,
    DECIDER_REQUIRED_RETURN_STATES,
    RESTOCKABLE_RETURN_STATES,
    RETURN_TIMESTAMP_FIELD,
    remainingToReturn,
    restockFlow,
    returnFlow,
    type RestockStateValue,
    type ReturnStateValue,
} from "./lifecycle"
import type { CommerceActor, CommerceContext } from "./shared"

/**
 * Returns: what the customer wants to send back, whether it was accepted, and what happened
 * to the goods when they arrived.
 *
 * ELIGIBILITY IS DERIVED. A line may be returned only up to what actually shipped, minus
 * what is already claimed by a live return. Nothing is cached, so cancelling or rejecting a
 * return immediately frees the quantity again.
 *
 * RESTOCKING COMPOSES THE INVENTORY ENGINE. It writes no balance itself: it calls
 * InventoryService with an idempotency key derived from the return item id, and stores the
 * resulting movement id on the item. That stored id is what makes a replay a no-op instead
 * of a second helping of stock.
 *
 * No payment is executed anywhere in this file. `refundPaymentId` is a pointer to a refund
 * that happened elsewhere.
 */

export type ReturnEligibility = Readonly<{
    orderLineId: string
    title: string
    ordered: number
    fulfilled: number
    claimed: number
    returnable: number
}>

export class ReturnService {
    constructor(
        private readonly ctx: CommerceContext,
        private readonly inventory: InventoryService,
    ) {}

    // ---- reads ---------------------------------------------------------

    async list(workspaceId: string, orderId?: string | null) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const scoped = orderId?.trim() || null
        if (scoped) await this.ctx.ownedOrder(profileId, scoped)
        const rows = await this.ctx.db.returnRequest.findMany({
            where: { profileId, ...(scoped ? { orderId: scoped } : {}) },
            include: { items: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        for (const r of rows) if (r.profileId !== profileId) this.ctx.denied()
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    ...r,
                    allowedTransitions: returnFlow.allowedFrom(r.state as ReturnStateValue),
                    items: r.items.map((i) =>
                        Object.freeze({
                            ...i,
                            allowedRestockTransitions: restockFlow.allowedFrom(i.restockState as RestockStateValue),
                        }),
                    ),
                }),
            ),
        )
    }

    async get(workspaceId: string, returnRequestId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const row = await this.ctx.ownedReturn(profileId, returnRequestId)
        return Object.freeze({
            ...row,
            allowedTransitions: returnFlow.allowedFrom(row.state as ReturnStateValue),
            items: row.items.map((i) =>
                Object.freeze({
                    ...i,
                    allowedRestockTransitions: restockFlow.allowedFrom(i.restockState as RestockStateValue),
                }),
            ),
        })
    }

    /**
     * What each line of an order could still be returned. Only SHIPPED and DELIVERED count as
     * "the customer received units"; a draft or cancelled shipment has sent nothing back to
     * argue about.
     */
    async eligibility(workspaceId: string, orderId: string): Promise<readonly ReturnEligibility[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const order = await this.ctx.ownedOrder(profileId, orderId)
        const lines = await this.ctx.db.orderLine.findMany({
            where: { orderId: order.id },
            select: { id: true, qty: true, titleSnapshot: true },
            orderBy: { createdAt: "asc" },
        })
        const shipped = await this.ctx.db.fulfilmentItem.findMany({
            where: { fulfilment: { orderId: order.id, state: { in: ["SHIPPED", "DELIVERED"] } } },
            select: { orderLineId: true, qty: true },
        })
        const claimedItems = await this.ctx.db.returnItem.findMany({
            where: {
                returnRequest: { orderId: order.id, state: { in: [...CLAIMING_RETURN_STATES] } },
            },
            select: { orderLineId: true, qty: true },
        })
        return Object.freeze(
            lines.map((line) => {
                const fulfilled = shipped
                    .filter((s) => s.orderLineId === line.id)
                    .reduce((sum, s) => sum + Number(s.qty), 0)
                const claimed = claimedItems
                    .filter((c) => c.orderLineId === line.id)
                    .reduce((sum, c) => sum + Number(c.qty), 0)
                return Object.freeze({
                    orderLineId: line.id,
                    title: line.titleSnapshot,
                    ordered: Number(line.qty),
                    fulfilled,
                    claimed,
                    returnable: remainingToReturn(fulfilled, claimed),
                })
            }),
        )
    }

    // ---- writes --------------------------------------------------------

    async request(
        workspaceId: string,
        input: Readonly<{ orderId: string; reference: string; reason?: string | null; idempotencyKey?: string | null }>,
        actor: CommerceActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const order = await this.ctx.ownedOrder(profileId, input.orderId)
        const reference = this.ctx.required(input.reference, "reference")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.returnRequest.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
                include: { items: true },
            })
            if (existing) return { returnRequest: existing, replayed: true }
        }

        // A return with nothing returnable behind it is not a return. Refusing at request
        // time gives the customer a reason instead of an empty case to chase.
        const eligibility = await this.eligibility(workspaceId, order.id)
        const anyReturnable = eligibility.some((e) => e.returnable > 0)
        if (!anyReturnable) {
            this.ctx.conflict("Nothing on this order has been shipped and not already claimed, so nothing can be returned", {
                lines: eligibility.map((e) => ({ orderLineId: e.orderLineId, fulfilled: e.fulfilled, claimed: e.claimed })),
            })
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.returnRequest.create({
                    data: {
                        profileId,
                        orderId: order.id,
                        reference,
                        reason: input.reason?.trim() || null,
                        idempotencyKey,
                    },
                    include: { items: true },
                })
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "RETURN",
                    subjectType: "RETURN",
                    subjectId: row.id,
                    to: "REQUESTED",
                    actor,
                    orderId: order.id,
                })
                return row
            })
            return { returnRequest: created, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, `A return with reference ${reference} already exists`)
        }
    }

    /** Adds a line to a return that has not yet been decided. */
    async addItem(
        workspaceId: string,
        returnRequestId: string,
        input: Readonly<{ orderLineId: string; variantId?: string | null; qty?: number | null }>,
        actor: CommerceActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const request = await this.ctx.ownedReturn(profileId, returnRequestId)
        const line = await this.ctx.ownedOrderLine(profileId, input.orderLineId)

        if (request.state !== "REQUESTED") {
            this.ctx.conflict(`A ${request.state.toLowerCase()} return cannot gain new lines`)
        }
        if (line.orderId !== request.orderId) {
            this.ctx.conflict("That order line belongs to a different order")
        }

        const named = input.variantId?.trim() || null
        let resolvedVariantId: string
        if (named) {
            const variant = await this.ctx.ownedVariant(profileId, named)
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

        const eligibility = await this.eligibility(workspaceId, request.orderId)
        const entry = eligibility.find((e) => e.orderLineId === line.id)
        const returnable = entry?.returnable ?? 0
        const qty = input.qty ?? returnable
        this.ctx.positiveInt(qty, "qty")
        if (qty > returnable) {
            this.ctx.conflict(`Only ${returnable} units of that line can still be returned; ${qty} were requested`, {
                returnable,
                requested: qty,
                fulfilled: entry?.fulfilled ?? 0,
                claimed: entry?.claimed ?? 0,
            })
        }

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.returnItem.create({
                    data: {
                        returnRequestId: request.id,
                        orderLineId: line.id,
                        variantId: resolvedVariantId,
                        qty,
                    },
                })
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "RETURN",
                    subjectType: "RETURN",
                    subjectId: request.id,
                    to: "LINE_ADDED",
                    actor,
                    orderId: request.orderId,
                    metadata: { orderLineId: line.id, variantId: resolvedVariantId, qty },
                })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, "That order line is already on this return")
        }
    }

    /**
     * Approves, rejects, receives or cancels a return.
     *
     * A decision must be attributable, so APPROVED and REJECTED require a decider. Approving
     * an empty return is refused: there would be nothing to receive. Every outcome is
     * terminal, because re-deciding a rejection or un-receiving goods that are physically
     * back would each be a lie about the world.
     */
    async transition(
        workspaceId: string,
        returnRequestId: string,
        to: ReturnStateValue,
        actor: CommerceActor,
        options?: Readonly<{ decidedBy?: string | null; decisionNote?: string | null; refundPaymentId?: string | null }>,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const request = await this.ctx.ownedReturn(profileId, returnRequestId)
        const from = request.state as ReturnStateValue

        if (returnFlow.isTerminal(from)) {
            this.ctx.conflict(`This return is already ${from.toLowerCase()} and cannot change`)
        }
        if (!returnFlow.can(from, to)) {
            this.ctx.conflict(`Cannot move a ${from.toLowerCase()} return to ${to.toLowerCase()}`)
        }
        const decidedBy = options?.decidedBy?.trim() || null
        if (DECIDER_REQUIRED_RETURN_STATES.includes(to) && !decidedBy) {
            this.ctx.conflict(`Marking a return ${to.toLowerCase()} requires the person deciding it`)
        }
        if (to === "APPROVED" && request.items.length === 0) {
            this.ctx.conflict("A return with no lines cannot be approved")
        }
        const refundPaymentId = await this.ctx.assertPayment(profileId, options?.refundPaymentId?.trim() || null)

        const stamp = RETURN_TIMESTAMP_FIELD[to]
        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.returnRequest.update({
                where: { id: request.id },
                data: {
                    state: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(decidedBy ? { decidedBy } : {}),
                    ...(options?.decisionNote !== undefined
                        ? { decisionNote: options.decisionNote?.trim() || null }
                        : {}),
                    ...(refundPaymentId ? { refundPaymentId } : {}),
                },
                include: { items: true },
            })
            await this.ctx.appendEvent(tx, {
                profileId,
                kind: "RETURN",
                subjectType: "RETURN",
                subjectId: request.id,
                from,
                to,
                actor,
                orderId: request.orderId,
                ...(refundPaymentId ? { metadata: { refundPaymentId } } : {}),
            })
            return row
        })
    }

    /**
     * Decides what happened to one returned line: back on the shelf, or written off.
     *
     * RESTOCKED goes through InventoryService with an idempotency key derived from the return
     * item id, and the resulting movement id is stored on the item. A replay therefore finds
     * that id already set and returns the same result rather than crediting stock twice —
     * which is the only failure mode that would silently invent inventory.
     *
     * DISCARDED writes no movement at all, because nothing came back to the shelf.
     */
    async settleItem(
        workspaceId: string,
        returnRequestId: string,
        returnItemId: string,
        to: RestockStateValue,
        actor: CommerceActor,
        options?: Readonly<{ locationId?: string | null; reason?: string | null }>,
    ): Promise<{ item: unknown; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const request = await this.ctx.ownedReturn(profileId, returnRequestId)
        const id = this.ctx.required(returnItemId, "returnItemId")
        const item = request.items.find((i) => i.id === id)
        if (!item) this.ctx.denied()

        if (!RESTOCKABLE_RETURN_STATES.includes(request.state as ReturnStateValue)) {
            this.ctx.conflict(
                `Goods on a ${request.state.toLowerCase()} return are not back yet, so they cannot be restocked or written off`,
            )
        }

        const from = item.restockState as RestockStateValue
        if (from === to && item.restockMovementId) {
            // Idempotent replay: the movement that credited the stock already exists.
            return { item: Object.freeze({ ...item }), replayed: true }
        }
        if (restockFlow.isTerminal(from)) {
            this.ctx.conflict(`This line is already ${from.toLowerCase()} and cannot change`)
        }
        if (!restockFlow.can(from, to)) {
            this.ctx.conflict(`Cannot move a ${from.toLowerCase()} return line to ${to.toLowerCase()}`)
        }

        let movementId: string | null = null
        if (to === "RESTOCKED") {
            const locationId = await this.ctx.assertLocation(profileId, options?.locationId?.trim() || null)
            if (!locationId) {
                throw new PersistenceError(
                    "BAD_REQUEST",
                    "locationId is required to say where the returned units went",
                    { field: "locationId" },
                )
            }
            const variant = await this.ctx.ownedVariant(profileId, item.variantId)
            const stock = await this.inventory.ensureItem(
                workspaceId,
                { productId: variant.productId, variantId: variant.id, locationId },
                { actorType: actor.actorType === "CUSTOMER" ? "SYSTEM" : actor.actorType, actorId: actor.actorId },
            )
            await this.inventory.applyMovement(
                workspaceId,
                stock.record.id,
                {
                    kind: "RETURN",
                    qty: Number(item.qty),
                    reason: options?.reason?.trim() || `Return ${request.reference}`,
                    orderId: request.orderId,
                    // Derived from the return item, so a retry cannot move stock twice.
                    idempotencyKey: `return:${item.id}`,
                },
                { actorType: actor.actorType === "CUSTOMER" ? "SYSTEM" : actor.actorType, actorId: actor.actorId },
            )
            const movement = await this.ctx.db.inventoryMovement.findUnique({
                where: { itemId_idempotencyKey: { itemId: stock.record.id, idempotencyKey: `return:${item.id}` } },
                select: { id: true },
            })
            movementId = movement?.id ?? null
        }

        const updated = await this.ctx.db.$transaction(async (tx) => {
            const row = await tx.returnItem.update({
                where: { id: item.id },
                data: {
                    restockState: to,
                    restockedAt: new Date(),
                    ...(movementId ? { restockMovementId: movementId } : {}),
                },
            })
            await this.ctx.appendEvent(tx, {
                profileId,
                kind: "RESTOCK",
                subjectType: "RETURN",
                subjectId: request.id,
                from,
                to,
                actor,
                orderId: request.orderId,
                metadata: { returnItemId: item.id, qty: Number(item.qty), ...(movementId ? { movementId } : {}) },
            })
            return row
        })
        return { item: updated, replayed: false }
    }
}
