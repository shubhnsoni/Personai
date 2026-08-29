import { PersistenceError } from "@/lib/persistence/errors"

import type { CommerceActor, CommerceContext } from "./shared"

/**
 * Product options, option values and variants.
 *
 * A variant is the sellable unit: stock, reservations, fulfilment lines and return lines all
 * point at one. The legacy `DigitalProduct.variantsJson` blob is untouched and unread by
 * this file — it carried a name and nothing else, so there is nothing here to migrate from.
 *
 * A product's DEFAULT variant is created by src/lib/inventory/engine.ts
 * `ensureDefaultVariant`, using the same `var_<productId>` convention as the Wave G
 * migration backfill. This service creates the additional, real variants.
 */

export type VariantRecord = Readonly<{
    id: string
    profileId: string
    productId: string
    isDefault: boolean
    isActive: boolean
    title: string
    ordinal: number
    priceCents: number | null
    compareAtCents: number | null
    weightGrams: number | null
    sku: string | null
    /** Resolved: the variant's own price, or the product's when it inherits. */
    effectivePriceCents: number
    createdAt: Date
    updatedAt: Date
}>

type RawVariant = {
    id: string
    profileId: string
    productId: string
    isDefault: boolean
    isActive: boolean
    title: string
    ordinal: number
    priceCents: number | null
    compareAtCents: number | null
    weightGrams: number | null
    sku: string | null
    createdAt: Date
    updatedAt: Date
}

export function toVariantRecord(row: RawVariant, productPriceCents: number): VariantRecord {
    return Object.freeze({
        id: row.id,
        profileId: row.profileId,
        productId: row.productId,
        isDefault: row.isDefault,
        isActive: row.isActive,
        title: row.title,
        ordinal: Number(row.ordinal),
        priceCents: row.priceCents === null ? null : Number(row.priceCents),
        compareAtCents: row.compareAtCents === null ? null : Number(row.compareAtCents),
        weightGrams: row.weightGrams === null ? null : Number(row.weightGrams),
        sku: row.sku,
        // Derived, never stored. A copied price would drift the moment the product changed.
        effectivePriceCents: row.priceCents === null ? productPriceCents : Number(row.priceCents),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    })
}

export class VariantService {
    constructor(private readonly ctx: CommerceContext) {}

    // ---- options -------------------------------------------------------

    async listOptions(workspaceId: string, productId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const product = await this.ctx.ownedProduct(profileId, productId)
        return Object.freeze(
            await this.ctx.db.productOption.findMany({
                where: { productId: product.id },
                include: { values: { orderBy: [{ ordinal: "asc" }, { value: "asc" }] } },
                orderBy: [{ ordinal: "asc" }, { name: "asc" }],
            }),
        )
    }

    async addOption(
        workspaceId: string,
        productId: string,
        input: Readonly<{ name: string; ordinal?: number | null; values?: readonly string[] }>,
        actor: CommerceActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const product = await this.ctx.ownedProduct(profileId, productId)
        const name = this.ctx.required(input.name, "name")
        const ordinal = input.ordinal ?? 0
        this.ctx.nonNegativeInt(ordinal, "ordinal")

        const values = (input.values ?? []).map((v) => v.trim()).filter(Boolean)
        const duplicates = values.filter((v, i) => values.indexOf(v) !== i)
        if (duplicates.length > 0) {
            this.ctx.conflict(`Option values must be distinct; ${[...new Set(duplicates)].join(", ")} repeated`)
        }

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const option = await tx.productOption.create({ data: { productId: product.id, name, ordinal } })
                for (const [index, value] of values.entries()) {
                    await tx.productOptionValue.create({ data: { optionId: option.id, value, ordinal: index } })
                }
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "VARIANT",
                    subjectType: "VARIANT",
                    subjectId: option.id,
                    to: "OPTION_CREATED",
                    actor,
                    metadata: { productId: product.id, name, values: values.length },
                })
                return option
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, `This product already has an option called ${name}`)
        }
    }

    async addOptionValue(
        workspaceId: string,
        optionId: string,
        input: Readonly<{ value: string; ordinal?: number | null }>,
        actor: CommerceActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const option = await this.ctx.ownedOption(profileId, optionId)
        const value = this.ctx.required(input.value, "value")
        const ordinal = input.ordinal ?? 0
        this.ctx.nonNegativeInt(ordinal, "ordinal")

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.productOptionValue.create({ data: { optionId: option.id, value, ordinal } })
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "VARIANT",
                    subjectType: "VARIANT",
                    subjectId: option.id,
                    to: "OPTION_VALUE_ADDED",
                    actor,
                    metadata: { value },
                })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, `${option.name} already has the value ${value}`)
        }
    }

    // ---- variants ------------------------------------------------------

    /**
     * The owner's products, so a console can offer a choice without inventing one. Read-only
     * and profile-scoped; it exists because a variant surface needs to know which products
     * there are, and nothing else in the platform exposes that list.
     */
    async listProducts(workspaceId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const rows = await this.ctx.db.digitalProduct.findMany({
            where: { profileId },
            select: {
                id: true,
                title: true,
                sku: true,
                priceCents: true,
                currency: true,
                isActive: true,
                fulfillment: true,
                _count: { select: { ProductVariant: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: 200,
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    id: r.id,
                    title: r.title,
                    sku: r.sku,
                    priceCents: Number(r.priceCents),
                    currency: r.currency,
                    isActive: r.isActive,
                    fulfillment: r.fulfillment,
                    variantCount: r._count.ProductVariant,
                }),
            ),
        )
    }

    async list(workspaceId: string, productId: string): Promise<readonly VariantRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const product = await this.ctx.ownedProduct(profileId, productId)
        const rows = await this.ctx.db.productVariant.findMany({
            where: { productId: product.id },
            orderBy: [{ ordinal: "asc" }, { createdAt: "asc" }],
        })
        for (const r of rows) if (r.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => toVariantRecord(r as RawVariant, Number(product.priceCents))))
    }

    async get(workspaceId: string, variantId: string): Promise<VariantRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const variant = await this.ctx.ownedVariant(profileId, variantId)
        const product = await this.ctx.ownedProduct(profileId, variant.productId)
        return toVariantRecord(variant as RawVariant, Number(product.priceCents))
    }

    /**
     * Creates a variant, optionally selecting one value per option.
     *
     * A variant may not be created as the default: exactly one default exists per product,
     * it is created by `ensureDefaultVariant`, and a partial unique index enforces the rule.
     * Accepting `isDefault` here would let a caller race the index and get a confusing
     * constraint error instead of a clear refusal.
     */
    async create(
        workspaceId: string,
        productId: string,
        input: Readonly<{
            title: string
            sku?: string | null
            priceCents?: number | null
            compareAtCents?: number | null
            weightGrams?: number | null
            ordinal?: number | null
            isActive?: boolean
            optionValueIds?: readonly string[]
            idempotencyKey?: string | null
        }>,
        actor: CommerceActor,
    ): Promise<{ record: VariantRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const product = await this.ctx.ownedProduct(profileId, productId)
        const title = this.ctx.required(input.title, "title")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.productVariant.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
            })
            if (existing) {
                return { record: toVariantRecord(existing as RawVariant, Number(product.priceCents)), replayed: true }
            }
        }

        const priceCents = input.priceCents ?? null
        if (priceCents !== null) this.ctx.nonNegativeInt(priceCents, "priceCents")
        const compareAtCents = input.compareAtCents ?? null
        if (compareAtCents !== null) this.ctx.nonNegativeInt(compareAtCents, "compareAtCents")
        const weightGrams = input.weightGrams ?? null
        if (weightGrams !== null) this.ctx.nonNegativeInt(weightGrams, "weightGrams")
        const ordinal = input.ordinal ?? 0
        this.ctx.nonNegativeInt(ordinal, "ordinal")
        const sku = input.sku?.trim() || null

        // Every named option value must belong to an option of THIS product, and no two may
        // come from the same option.
        const optionValueIds = [...new Set((input.optionValueIds ?? []).map((v) => v.trim()).filter(Boolean))]
        const selections: Array<{ optionId: string; optionValueId: string }> = []
        for (const optionValueId of optionValueIds) {
            const value = await this.ctx.db.productOptionValue.findUnique({
                where: { id: optionValueId },
                include: { option: { select: { id: true, productId: true } } },
            })
            if (!value || value.option.productId !== product.id) this.ctx.denied()
            if (selections.some((s) => s.optionId === value.option.id)) {
                this.ctx.conflict("A variant may select at most one value per option")
            }
            selections.push({ optionId: value.option.id, optionValueId: value.id })
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.productVariant.create({
                    data: {
                        profileId,
                        productId: product.id,
                        isDefault: false,
                        isActive: input.isActive !== false,
                        title,
                        ordinal,
                        priceCents,
                        compareAtCents,
                        weightGrams,
                        sku,
                        idempotencyKey,
                    },
                })
                for (const s of selections) {
                    await tx.productVariantOptionValue.create({
                        data: { variantId: row.id, optionId: s.optionId, optionValueId: s.optionValueId },
                    })
                }
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "VARIANT",
                    subjectType: "VARIANT",
                    subjectId: row.id,
                    to: "CREATED",
                    actor,
                    metadata: { productId: product.id, sku, options: selections.length },
                })
                return row
            })
            return { record: toVariantRecord(created as RawVariant, Number(product.priceCents)), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(
                error,
                sku ? `The SKU ${sku} is already used by another variant` : "That variant already exists",
            )
        }
    }

    /**
     * Updates a variant's own attributes. The product, the default flag and the option
     * selection are all immutable here: moving a variant to another product would silently
     * relocate its stock, and changing which option values it represents would rewrite the
     * meaning of every order line that already bought it.
     */
    async update(
        workspaceId: string,
        variantId: string,
        input: Readonly<{
            title?: string | null
            sku?: string | null
            priceCents?: number | null
            compareAtCents?: number | null
            weightGrams?: number | null
            ordinal?: number | null
            isActive?: boolean
            clearSku?: boolean
            clearPrice?: boolean
        }>,
        actor: CommerceActor,
    ): Promise<VariantRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const variant = await this.ctx.ownedVariant(profileId, variantId)
        const product = await this.ctx.ownedProduct(profileId, variant.productId)

        const data: Record<string, unknown> = {}
        if (input.title !== undefined && input.title !== null) data.title = this.ctx.required(input.title, "title")
        if (input.clearSku === true) data.sku = null
        else if (input.sku !== undefined && input.sku !== null) data.sku = this.ctx.required(input.sku, "sku")
        if (input.clearPrice === true) data.priceCents = null
        else if (input.priceCents !== undefined && input.priceCents !== null) {
            data.priceCents = this.ctx.nonNegativeInt(input.priceCents, "priceCents")
        }
        if (input.compareAtCents !== undefined && input.compareAtCents !== null) {
            data.compareAtCents = this.ctx.nonNegativeInt(input.compareAtCents, "compareAtCents")
        }
        if (input.weightGrams !== undefined && input.weightGrams !== null) {
            data.weightGrams = this.ctx.nonNegativeInt(input.weightGrams, "weightGrams")
        }
        if (input.ordinal !== undefined && input.ordinal !== null) {
            data.ordinal = this.ctx.nonNegativeInt(input.ordinal, "ordinal")
        }
        if (input.isActive !== undefined) data.isActive = input.isActive === true

        if (Object.keys(data).length === 0) {
            throw new PersistenceError("BAD_REQUEST", "No updatable field was supplied")
        }

        // Deactivating a variant that still has stock promised to orders would strand those
        // promises, so it is refused with the number named.
        if (data.isActive === false) {
            const held = await this.ctx.db.inventoryItem.aggregate({
                where: { variantId: variant.id },
                _sum: { reserved: true },
            })
            const reserved = Number(held._sum.reserved ?? 0)
            if (reserved > 0) {
                this.ctx.conflict(
                    `This variant still has ${reserved} units promised to orders and cannot be deactivated`,
                    { reserved },
                )
            }
        }

        try {
            const updated = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.productVariant.update({ where: { id: variant.id }, data })
                await this.ctx.appendEvent(tx, {
                    profileId,
                    kind: "VARIANT",
                    subjectType: "VARIANT",
                    subjectId: variant.id,
                    from: variant.isActive ? "ACTIVE" : "INACTIVE",
                    to: row.isActive ? "ACTIVE" : "INACTIVE",
                    actor,
                    metadata: { changed: Object.keys(data) },
                })
                return row
            })
            return toVariantRecord(updated as RawVariant, Number(product.priceCents))
        } catch (error) {
            this.ctx.rethrowUnique(error, "That SKU is already used by another variant")
        }
    }

    /** The append-only commerce timeline for one subject. */
    async events(workspaceId: string, subjectType: "VARIANT" | "FULFILMENT" | "RETURN", subjectId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const id = this.ctx.required(subjectId, "subjectId")
        return Object.freeze(
            await this.ctx.db.commerceEvent.findMany({
                where: { profileId, subjectType, subjectId: id },
                orderBy: { seq: "asc" },
            }),
        )
    }
}
