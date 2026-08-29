import { PersistenceError } from "@/lib/persistence/errors"

import {
    RESERVATION_TIMESTAMP_FIELD,
    availableUnits,
    isDirectMovementKind,
    reservationFlow,
    type MovementKindValue,
    type ReservationStateValue,
} from "./lifecycle"
import type { InventoryActor, InventoryContext } from "./shared"

/**
 * Inventory engine.
 *
 * Every balance change happens inside a transaction that first takes a row lock on the
 * stock record, so two concurrent orders cannot both read the same available quantity and
 * both succeed. Every accepted change appends exactly one movement in the same
 * transaction, so a balance and its explanation cannot come apart.
 *
 * The engine refuses an oversell before the database has to. The CHECK constraints from
 * F1 are the backstop, not the primary guard: they exist so the guarantee holds even if
 * this file is wrong, and the schema harness proves them independently of this code.
 */

export type StockRecord = Readonly<{
    id: string
    profileId: string
    productId: string
    locationId: string
    onHand: number
    reserved: number
    available: number
    reorderPoint: number | null
    safetyStock: number
    trackingEnabled: boolean
    belowReorderPoint: boolean
    createdAt: Date
    updatedAt: Date
}>

type RawItem = {
    id: string
    profileId: string
    productId: string
    locationId: string
    onHand: number
    reserved: number
    reorderPoint: number | null
    safetyStock: number
    trackingEnabled: boolean
    createdAt: Date
    updatedAt: Date
}

export function toStockRecord(row: RawItem): StockRecord {
    const onHand = Number(row.onHand)
    const reserved = Number(row.reserved)
    const available = availableUnits(onHand, reserved)
    return Object.freeze({
        id: row.id,
        profileId: row.profileId,
        productId: row.productId,
        locationId: row.locationId,
        onHand,
        reserved,
        available,
        reorderPoint: row.reorderPoint === null ? null : Number(row.reorderPoint),
        safetyStock: Number(row.safetyStock),
        trackingEnabled: row.trackingEnabled,
        // Derived, never stored: a cached flag would go stale the moment stock moved.
        belowReorderPoint: row.reorderPoint !== null && available <= Number(row.reorderPoint),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    })
}

export class InventoryService {
    constructor(private readonly ctx: InventoryContext) {}

    // ---- reads ---------------------------------------------------------

    async list(workspaceId: string, locationId?: string | null): Promise<readonly StockRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const scoped = locationId?.trim() || null
        if (scoped) await this.ctx.ownedLocation(profileId, scoped)
        const rows = await this.ctx.db.inventoryItem.findMany({
            where: { profileId, ...(scoped ? { locationId: scoped } : {}) },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        // Revalidate on the way out rather than trusting the query alone.
        for (const r of rows) if (r.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => toStockRecord(r as RawItem)))
    }

    async get(workspaceId: string, itemId: string): Promise<StockRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        return toStockRecord((await this.ctx.ownedItem(profileId, itemId)) as RawItem)
    }

    /** Availability for one product across every location that stocks it. */
    async availability(workspaceId: string, productId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const product = await this.ctx.ownedProduct(profileId, productId)
        const rows = await this.ctx.db.inventoryItem.findMany({
            where: { profileId, productId: product.id },
            orderBy: [{ locationId: "asc" }],
        })
        const records = rows.map((r) => toStockRecord(r as RawItem))
        return Object.freeze({
            productId: product.id,
            locations: Object.freeze(records),
            totalOnHand: records.reduce((sum, r) => sum + r.onHand, 0),
            totalReserved: records.reduce((sum, r) => sum + r.reserved, 0),
            totalAvailable: records.reduce((sum, r) => sum + r.available, 0),
            // An untracked location cannot promise anything, so the total is only
            // meaningful when every location that stocks the product tracks it.
            allLocationsTracked: records.every((r) => r.trackingEnabled),
        })
    }

    async movements(workspaceId: string, itemId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const item = await this.ctx.ownedItem(profileId, itemId)
        return Object.freeze(
            await this.ctx.db.inventoryMovement.findMany({
                where: { itemId: item.id },
                orderBy: { seq: "asc" },
            }),
        )
    }

    async listReservations(workspaceId: string, itemId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const item = await this.ctx.ownedItem(profileId, itemId)
        const rows = await this.ctx.db.inventoryReservation.findMany({
            where: { itemId: item.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    ...r,
                    allowedTransitions: reservationFlow.allowedFrom(r.state as ReservationStateValue),
                }),
            ),
        )
    }

    // ---- stock records -------------------------------------------------

    /**
     * Creates or returns the stock record for a product at a location. Idempotent by
     * construction: the pair is unique, so a replay returns the existing record rather
     * than failing or duplicating.
     */
    async ensureItem(
        workspaceId: string,
        input: Readonly<{
            productId: string
            locationId: string
            reorderPoint?: number | null
            safetyStock?: number | null
            trackingEnabled?: boolean
        }>,
        actor: InventoryActor,
    ): Promise<{ record: StockRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const product = await this.ctx.ownedProduct(profileId, input.productId)
        const location = await this.ctx.ownedLocation(profileId, input.locationId)

        const existing = await this.ctx.db.inventoryItem.findUnique({
            where: { productId_locationId: { productId: product.id, locationId: location.id } },
        })
        if (existing) return { record: toStockRecord(existing as RawItem), replayed: true }

        const reorderPoint = input.reorderPoint ?? null
        if (reorderPoint !== null) this.ctx.nonNegativeInt(reorderPoint, "reorderPoint")
        const safetyStock = input.safetyStock ?? 0
        this.ctx.nonNegativeInt(safetyStock, "safetyStock")

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.inventoryItem.create({
                    data: {
                        profileId,
                        productId: product.id,
                        locationId: location.id,
                        reorderPoint,
                        safetyStock,
                        trackingEnabled: input.trackingEnabled !== false,
                    },
                })
                await this.ctx.appendMovement(tx, {
                    itemId: row.id,
                    kind: "COUNT",
                    qtyDelta: 0,
                    reservedDelta: 0,
                    onHandAfter: 0,
                    reservedAfter: 0,
                    actor,
                    reason: "Stock record opened",
                })
                return row
            })
            return { record: toStockRecord(created as RawItem), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That product already has a stock record at this location")
        }
    }

    // ---- direct movements ----------------------------------------------

    /**
     * Applies a direct movement: RECEIPT, ADJUSTMENT, RETURN or COUNT.
     *
     * RESERVE, RELEASE and CONSUME are deliberately NOT accepted here. They only ever
     * arise from a reservation transition, so allowing them as input would let a caller
     * move the reserved balance with no hold behind it.
     *
     * COUNT is absolute: it sets onHand to the counted figure and records the difference
     * as the delta, which is what a stock take actually is. The others are relative.
     */
    async applyMovement(
        workspaceId: string,
        itemId: string,
        input: Readonly<{
            kind: unknown
            qty: number
            reason?: string | null
            orderId?: string | null
            idempotencyKey?: string | null
        }>,
        actor: InventoryActor,
    ): Promise<StockRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const item = await this.ctx.ownedItem(profileId, itemId)

        if (!isDirectMovementKind(input.kind)) {
            throw new PersistenceError(
                "BAD_REQUEST",
                "kind must be one of RECEIPT, ADJUSTMENT, RETURN or COUNT; reserve, release and consume are driven by reservations",
                { field: "kind" },
            )
        }
        const kind: MovementKindValue = input.kind
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const replay = await this.ctx.db.inventoryMovement.findUnique({
                where: { itemId_idempotencyKey: { itemId: item.id, idempotencyKey } },
                select: { id: true },
            })
            if (replay) return toStockRecord((await this.ctx.ownedItem(profileId, item.id)) as RawItem)
        }

        if (kind === "COUNT") this.ctx.nonNegativeInt(input.qty, "qty")
        else if (kind === "ADJUSTMENT") {
            if (!Number.isInteger(input.qty) || input.qty === 0) {
                throw new PersistenceError("BAD_REQUEST", "qty must be a non-zero integer for an adjustment", { field: "qty" })
            }
        } else this.ctx.positiveInt(input.qty, "qty")

        const orderId = input.orderId?.trim() || null
        if (orderId) {
            const order = await this.ctx.db.order.findUnique({ where: { id: orderId }, select: { id: true, profileId: true } })
            if (!order || order.profileId !== profileId) this.ctx.denied()
        }

        try {
            const updated = await this.ctx.db.$transaction(async (tx) => {
                const locked = await this.ctx.lockItem(tx, item.id)
                const qtyDelta = kind === "COUNT" ? input.qty - locked.onHand : input.qty
                const onHandAfter = locked.onHand + qtyDelta

                if (onHandAfter < 0) {
                    this.ctx.conflict(
                        `That movement would leave ${onHandAfter} units on hand; only ${locked.onHand} are present`,
                        { onHand: locked.onHand, requested: qtyDelta },
                    )
                }
                if (onHandAfter < locked.reserved) {
                    this.ctx.conflict(
                        `That movement would leave ${onHandAfter} units on hand while ${locked.reserved} are already promised to orders`,
                        { onHand: locked.onHand, reserved: locked.reserved, requested: qtyDelta },
                    )
                }

                const row = await tx.inventoryItem.update({
                    where: { id: item.id },
                    data: { onHand: onHandAfter },
                })
                await this.ctx.appendMovement(tx, {
                    itemId: item.id,
                    kind,
                    qtyDelta,
                    reservedDelta: 0,
                    onHandAfter,
                    reservedAfter: locked.reserved,
                    actor,
                    reason: input.reason,
                    orderId,
                    idempotencyKey,
                })
                return row
            })
            return toStockRecord(updated as RawItem)
        } catch (error) {
            if (error instanceof PersistenceError) throw error
            if (idempotencyKey) this.ctx.rethrowUnique(error, "That movement was already recorded")
            this.ctx.rethrowCheck(error, "That movement would break a stock invariant")
        }
    }

    // ---- reservations --------------------------------------------------

    /**
     * Places a hold for one order line. Refuses when fewer units are available than the
     * line needs, and names the number actually available so the caller can act on it.
     *
     * An untracked stock record cannot hold anything: a reservation is a promise, and a
     * record that does not count units cannot make one.
     */
    async reserve(
        workspaceId: string,
        itemId: string,
        input: Readonly<{ orderLineId: string; qty?: number | null; expiresAt?: Date | null; idempotencyKey?: string | null }>,
        actor: InventoryActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const item = await this.ctx.ownedItem(profileId, itemId)
        const line = await this.ctx.ownedOrderLine(profileId, input.orderLineId)
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const replay = await this.ctx.db.inventoryReservation.findUnique({
                where: { itemId_idempotencyKey: { itemId: item.id, idempotencyKey } },
            })
            if (replay) return { reservation: replay, replayed: true }
        }

        // A line that names a product may only be reserved against that product's stock.
        if (line.productId && line.productId !== item.productId) {
            this.ctx.conflict("That order line is for a different product")
        }

        const qty = input.qty ?? line.qty
        this.ctx.positiveInt(qty, "qty")
        if (!item.trackingEnabled) {
            this.ctx.conflict("This stock record does not track units, so it cannot hold a reservation")
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const locked = await this.ctx.lockItem(tx, item.id)
                const available = availableUnits(locked.onHand, locked.reserved)
                if (available < qty) {
                    this.ctx.conflict(
                        `Only ${available} units are available; ${qty} were requested`,
                        { available, requested: qty, onHand: locked.onHand, reserved: locked.reserved },
                    )
                }
                const reservedAfter = locked.reserved + qty
                const reservation = await tx.inventoryReservation.create({
                    data: {
                        itemId: item.id,
                        orderLineId: line.id,
                        qty,
                        expiresAt: input.expiresAt ?? null,
                        idempotencyKey,
                    },
                })
                await tx.inventoryItem.update({ where: { id: item.id }, data: { reserved: reservedAfter } })
                await this.ctx.appendMovement(tx, {
                    itemId: item.id,
                    kind: "RESERVE",
                    qtyDelta: 0,
                    reservedDelta: qty,
                    onHandAfter: locked.onHand,
                    reservedAfter,
                    actor,
                    orderId: line.orderId,
                    orderLineId: line.id,
                    reservationId: reservation.id,
                    idempotencyKey,
                })
                return reservation
            })
            return { reservation: created, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That order line already holds stock")
        }
    }

    /**
     * Settles a hold. RELEASED and EXPIRED return the units to available stock; CONSUMED
     * takes them off the shelf. All three are terminal, because re-releasing would
     * double-credit stock and un-consuming would conjure units that have already gone.
     *
     * EXPIRED additionally requires the hold to have actually passed its expiry, so the
     * state cannot be used to quietly cancel a live reservation.
     */
    async settleReservation(
        workspaceId: string,
        reservationId: string,
        to: ReservationStateValue,
        actor: InventoryActor,
        reason?: string | null,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const existing = await this.ctx.ownedReservation(profileId, reservationId)
        const from = existing.state as ReservationStateValue

        if (reservationFlow.isTerminal(from)) {
            this.ctx.conflict(`This hold is already ${from.toLowerCase()} and cannot change`)
        }
        if (!reservationFlow.can(from, to)) {
            this.ctx.conflict(`Cannot move a ${from.toLowerCase()} hold to ${to.toLowerCase()}`)
        }
        if (to === "EXPIRED") {
            if (!existing.expiresAt) {
                this.ctx.conflict("This hold has no expiry, so it cannot be expired")
            } else if (existing.expiresAt.getTime() > Date.now()) {
                this.ctx.conflict("This hold has not reached its expiry yet")
            }
        }

        const stamp = RESERVATION_TIMESTAMP_FIELD[to]
        const settled = await this.ctx.db.$transaction(async (tx) => {
            const locked = await this.ctx.lockItem(tx, existing.itemId)
            const qty = Number(existing.qty)
            const reservedAfter = Math.max(0, locked.reserved - qty)
            const onHandAfter = to === "CONSUMED" ? locked.onHand - qty : locked.onHand

            if (onHandAfter < 0) {
                this.ctx.conflict(
                    `Consuming ${qty} units would leave ${onHandAfter} on hand; only ${locked.onHand} are present`,
                    { onHand: locked.onHand, requested: qty },
                )
            }

            const row = await tx.inventoryReservation.update({
                where: { id: existing.id },
                data: { state: to, ...(stamp ? { [stamp]: new Date() } : {}) },
            })
            await tx.inventoryItem.update({
                where: { id: existing.itemId },
                data: { onHand: onHandAfter, reserved: reservedAfter },
            })
            await this.ctx.appendMovement(tx, {
                itemId: existing.itemId,
                kind: to === "CONSUMED" ? "CONSUME" : "RELEASE",
                qtyDelta: to === "CONSUMED" ? -qty : 0,
                reservedDelta: -Math.min(qty, locked.reserved),
                onHandAfter,
                reservedAfter,
                actor,
                reason,
                orderLineId: existing.orderLineId,
                reservationId: existing.id,
            })
            return row
        })
        return settled
    }
}
