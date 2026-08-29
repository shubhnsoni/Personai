import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

/**
 * Shared tenancy and composition helpers for the commerce engine.
 *
 * TENANCY is profileId, bridged from the caller's workspace, because DigitalProduct and
 * Order are both already profileId-scoped and Workspace.profileId is unique. Same bridge as
 * the appointment, cohort and inventory domains.
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

export type CommerceActor = Readonly<{ actorType: "STAFF" | "SYSTEM" | "CUSTOMER"; actorId: string | null }>

export type CommerceEventKindValue = "VARIANT" | "FULFILMENT" | "RETURN" | "RESTOCK" | "NOTE"
export type CommerceEventSubjectValue = "VARIANT" | "FULFILMENT" | "RETURN"

type EventWriter = Pick<PrismaClient, "commerceEvent">

export class CommerceContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /** Resolves the caller's workspace to the profileId that owns the catalogue and orders. */
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

    rethrowUnique(error: unknown, message: string): never {
        if (error instanceof PersistenceError) throw error
        if (pgCode(error) === UNIQUE_VIOLATION) throw new PersistenceError("CONFLICT", message)
        throw error
    }

    // ---- ownership loaders --------------------------------------------

    async ownedProduct(profileId: string, productId: string) {
        const id = this.required(productId, "productId")
        const row = await this.db.digitalProduct.findUnique({
            where: { id },
            select: { id: true, profileId: true, title: true, sku: true, isActive: true, priceCents: true },
        })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    async ownedVariant(profileId: string, variantId: string) {
        const id = this.required(variantId, "variantId")
        const row = await this.db.productVariant.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /** An option is reachable only through a product the caller owns. */
    async ownedOption(profileId: string, optionId: string) {
        const id = this.required(optionId, "optionId")
        const row = await this.db.productOption.findUnique({
            where: { id },
            include: { product: { select: { id: true, profileId: true } } },
        })
        if (!row || row.product.profileId !== profileId) this.denied()
        return row
    }

    async ownedOrder(profileId: string, orderId: string) {
        const id = this.required(orderId, "orderId")
        const row = await this.db.order.findUnique({
            where: { id },
            select: { id: true, profileId: true, status: true, currency: true },
        })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    async ownedOrderLine(profileId: string, orderLineId: string) {
        const id = this.required(orderLineId, "orderLineId")
        const row = await this.db.orderLine.findUnique({
            where: { id },
            select: {
                id: true,
                qty: true,
                productId: true,
                titleSnapshot: true,
                orderId: true,
                order: { select: { id: true, profileId: true } },
            },
        })
        if (!row || row.order.profileId !== profileId) this.denied()
        return row
    }

    async ownedFulfilment(profileId: string, fulfilmentId: string) {
        const id = this.required(fulfilmentId, "fulfilmentId")
        const row = await this.db.fulfilment.findUnique({ where: { id }, include: { items: true } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    async ownedReturn(profileId: string, returnRequestId: string) {
        const id = this.required(returnRequestId, "returnRequestId")
        const row = await this.db.returnRequest.findUnique({ where: { id }, include: { items: true } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /** A location must belong to a workspace owned by the caller's profile. */
    async assertLocation(profileId: string, locationId: string | null): Promise<string | null> {
        if (!locationId) return null
        const row = await this.db.location.findUnique({
            where: { id: locationId },
            select: { id: true, workspace: { select: { profileId: true } } },
        })
        if (!row || row.workspace?.profileId !== profileId) this.denied()
        return row.id
    }

    /** A refund pointer must be a Payment the caller owns. Nothing here moves money. */
    async assertPayment(profileId: string, paymentId: string | null): Promise<string | null> {
        if (!paymentId) return null
        const row = await this.db.payment.findUnique({
            where: { id: paymentId },
            select: { id: true, profileId: true },
        })
        if (!row || row.profileId !== profileId) this.denied()
        return row.id
    }

    async appendEvent(
        tx: EventWriter,
        input: Readonly<{
            profileId: string
            kind: CommerceEventKindValue
            subjectType: CommerceEventSubjectValue
            subjectId: string
            from?: string | null
            to: string
            actor: CommerceActor
            orderId?: string | null
            metadata?: Record<string, unknown>
        }>,
    ): Promise<void> {
        await tx.commerceEvent.create({
            data: {
                profileId: input.profileId,
                kind: input.kind,
                subjectType: input.subjectType,
                subjectId: input.subjectId,
                from: input.from ?? null,
                to: input.to,
                actor: input.actor.actorType,
                actorId: input.actor.actorId,
                orderId: input.orderId ?? null,
                ...(input.metadata ? { metadata: input.metadata as never } : {}),
            },
        })
    }
}
