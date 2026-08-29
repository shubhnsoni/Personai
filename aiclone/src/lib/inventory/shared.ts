import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

import type { MovementKindValue } from "./lifecycle"

/**
 * Shared tenancy and composition helpers for the inventory engine.
 *
 * TENANCY is profileId, bridged from the caller's workspace. `DigitalProduct` and
 * `Order` are both already profileId-scoped and `Workspace.profileId` is unique, so the
 * bridge is exact — the same bridge the appointment and cohort domains use.
 *
 * NON-ENUMERATION: `denied()` is the single refusal used for both foreign and nonexistent
 * resources, so the two are indistinguishable by construction rather than by convention.
 *
 * TIME COMPARISONS must use Prisma's typed API. Raw SQL `Date` parameters bind as local
 * wall-clock against `timestamp without time zone` while Prisma writes UTC components,
 * which silently disabled an overlap check in an earlier wave.
 */

export const UNIQUE_VIOLATION = "23505"
export const CHECK_VIOLATION = "23514"

export function pgCode(error: unknown): string | null {
    const e = error as { code?: unknown; meta?: { code?: unknown } } | null
    if (!e) return null
    if (typeof e.code === "string" && /^\d{5}$/.test(e.code)) return e.code
    if (typeof e.meta?.code === "string" && /^\d{5}$/.test(e.meta.code)) return e.meta.code
    const m = error instanceof Error ? error.message : String(error)
    if (/Code: `23505`/.test(m) || /Unique constraint failed/i.test(m)) return UNIQUE_VIOLATION
    if (/Code: `23514`/.test(m) || /check constraint/i.test(m)) return CHECK_VIOLATION
    return null
}

export type InventoryActor = Readonly<{ actorType: "STAFF" | "SYSTEM" | "CUSTOMER"; actorId: string | null }>

type MovementWriter = Pick<PrismaClient, "inventoryMovement">

export type LockedItem = Readonly<{
    id: string
    profileId: string
    onHand: number
    reserved: number
    trackingEnabled: boolean
}>

export class InventoryContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /**
     * Resolves the caller's workspace to the profileId that owns the catalogue.
     * A workspace with no linked profile has no products, so it can hold no stock.
     */
    async requireProfile(workspaceId: string, permission: "profile.read" | "profile.update"): Promise<string> {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        const workspace = await this.db.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { profileId: true },
        })
        if (!workspace?.profileId) {
            throw new PersistenceError("FORBIDDEN", "This workspace is not linked to a profile that owns a catalogue")
        }
        return workspace.profileId
    }

    denied(): never {
        throw new PersistenceError("FORBIDDEN", "Access denied")
    }

    required(value: string | undefined | null, field: string): string {
        const v = value?.trim()
        if (!v) throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
        return v
    }

    positiveInt(value: unknown, field: string): number {
        if (!Number.isInteger(value) || (value as number) <= 0) {
            throw new PersistenceError("BAD_REQUEST", `${field} must be a positive integer`, { field })
        }
        return value as number
    }

    nonNegativeInt(value: unknown, field: string): number {
        if (!Number.isInteger(value) || (value as number) < 0) {
            throw new PersistenceError("BAD_REQUEST", `${field} must be a non-negative integer`, { field })
        }
        return value as number
    }

    conflict(message: string, details?: Record<string, unknown>): never {
        throw new PersistenceError("CONFLICT", message, details)
    }

    /** Maps a unique-constraint collision to a caller-meaningful conflict. */
    rethrowUnique(error: unknown, message: string): never {
        if (error instanceof PersistenceError) throw error
        if (pgCode(error) === UNIQUE_VIOLATION) throw new PersistenceError("CONFLICT", message)
        throw error
    }

    /**
     * Maps a CHECK violation to a conflict. The engine refuses these cases before they
     * reach the database, so seeing one here means the engine's arithmetic disagreed with
     * the constraint — a defect worth surfacing as a conflict rather than a 500, but never
     * relied on as the primary guard.
     */
    rethrowCheck(error: unknown, message: string): never {
        if (error instanceof PersistenceError) throw error
        if (pgCode(error) === CHECK_VIOLATION) throw new PersistenceError("CONFLICT", message)
        throw error
    }

    /** A product may only be used if the caller's profile owns it. */
    async ownedProduct(profileId: string, productId: string) {
        const id = this.required(productId, "productId")
        const row = await this.db.digitalProduct.findUnique({
            where: { id },
            select: { id: true, profileId: true, title: true },
        })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /** A location must belong to a workspace owned by the caller's profile. */
    async ownedLocation(profileId: string, locationId: string) {
        const id = this.required(locationId, "locationId")
        const row = await this.db.location.findUnique({
            where: { id },
            select: { id: true, name: true, workspace: { select: { profileId: true } } },
        })
        if (!row || row.workspace?.profileId !== profileId) this.denied()
        return row
    }

    /** Loads a stock record and proves ownership. Refuses identically when absent. */
    async ownedItem(profileId: string, itemId: string) {
        const id = this.required(itemId, "itemId")
        const row = await this.db.inventoryItem.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /** An order line is reachable only through an Order the caller's profile owns. */
    async ownedOrderLine(profileId: string, orderLineId: string) {
        const id = this.required(orderLineId, "orderLineId")
        const row = await this.db.orderLine.findUnique({
            where: { id },
            select: {
                id: true,
                qty: true,
                productId: true,
                orderId: true,
                order: { select: { id: true, profileId: true } },
            },
        })
        if (!row || row.order.profileId !== profileId) this.denied()
        return row
    }

    async ownedReservation(profileId: string, reservationId: string) {
        const id = this.required(reservationId, "reservationId")
        const row = await this.db.inventoryReservation.findUnique({
            where: { id },
            include: { item: { select: { id: true, profileId: true } } },
        })
        if (!row || row.item.profileId !== profileId) this.denied()
        return row
    }

    /**
     * Takes a row lock on a stock record. Every balance change goes through this, so two
     * concurrent orders cannot both read the same available quantity and both succeed.
     */
    async lockItem(tx: Pick<PrismaClient, "$queryRawUnsafe">, itemId: string): Promise<LockedItem> {
        const rows = await tx.$queryRawUnsafe<
            Array<{ id: string; profileId: string; onHand: number; reserved: number; trackingEnabled: boolean }>
        >(
            `select "id","profileId","onHand","reserved","trackingEnabled" from "InventoryItem" where "id" = $1 for update`,
            itemId,
        )
        const row = rows[0]
        if (!row) this.denied()
        return Object.freeze({
            id: row.id,
            profileId: row.profileId,
            onHand: Number(row.onHand),
            reserved: Number(row.reserved),
            trackingEnabled: row.trackingEnabled,
        })
    }

    /**
     * Appends one movement per accepted change, inside the same transaction. Both the
     * signed deltas and the resulting balances are stored, so the ledger can be replayed
     * against the record it describes.
     */
    async appendMovement(
        tx: MovementWriter,
        input: Readonly<{
            itemId: string
            kind: MovementKindValue
            qtyDelta: number
            reservedDelta: number
            onHandAfter: number
            reservedAfter: number
            actor: InventoryActor
            reason?: string | null
            orderId?: string | null
            orderLineId?: string | null
            reservationId?: string | null
            idempotencyKey?: string | null
        }>,
    ): Promise<void> {
        await tx.inventoryMovement.create({
            data: {
                itemId: input.itemId,
                kind: input.kind,
                qtyDelta: input.qtyDelta,
                reservedDelta: input.reservedDelta,
                onHandAfter: input.onHandAfter,
                reservedAfter: input.reservedAfter,
                actor: input.actor.actorType,
                actorId: input.actor.actorId,
                reason: input.reason?.trim() || null,
                orderId: input.orderId ?? null,
                orderLineId: input.orderLineId ?? null,
                reservationId: input.reservationId ?? null,
                idempotencyKey: input.idempotencyKey ?? null,
            },
        })
    }
}
