import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import { defaultPrepMinutesFromConfig } from "./payment-qr"
import {
    businessDateKey,
    normalizeCreateRestaurantOrderInput,
    priceRestaurantCart,
    type CreateRestaurantOrderInput,
} from "./restaurant-orders"

const MAX_TRANSACTION_ATTEMPTS = 6

const ORDER_RESULT_INCLUDE = Prisma.validator<Prisma.OrderInclude>()({
    profile: {
        select: {
            slug: true,
            upiId: true,
            whatsapp: true,
            gstin: true,
        },
    },
    lines: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    },
})

type OrderResultRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_RESULT_INCLUDE }>

function publicOrderResult(order: OrderResultRecord, replayed: boolean) {
    return {
        id: order.id,
        publicToken: order.publicToken,
        number: order.number,
        status: order.status,
        channel: order.channel,
        tableLabel: order.tableLabel,
        subtotalCents: order.subtotalCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        currency: order.currency,
        payMethod: order.payMethod,
        payStatus: order.payStatus,
        upiId: order.profile.upiId,
        whatsapp: order.profile.whatsapp,
        slug: order.profile.slug,
        gstin: order.profile.gstin,
        replayed,
        lines: order.lines.map((line) => ({
            title: line.titleSnapshot,
            qty: line.qty,
            modifiersLabel: line.modifiersLabel,
            lineTotalCents: line.lineTotalCents,
        })),
    }
}

function isKnownPrismaError(error: unknown, code: string) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

function isSerializationFailure(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
    if (error.code === "P2034") return true
    if (error.code !== "P2010") return false
    const meta = error.meta as { code?: unknown; message?: unknown } | undefined
    return meta?.code === "40001" ||
        (typeof meta?.message === "string" && meta.message.includes("could not serialize access")) ||
        error.message.includes("40001")
}

async function waitBeforeRetry(attempt: number) {
    const exponentialMs = Math.min(20 * (2 ** attempt), 250)
    const jitterMs = Math.floor(Math.random() * 20)
    await new Promise((resolve) => setTimeout(resolve, exponentialMs + jitterMs))
}

async function findReplayedOrder(profileSlug: string, idempotencyKey: string) {
    return prisma.order.findFirst({
        where: { profile: { slug: profileSlug }, idempotencyKey },
        include: ORDER_RESULT_INCLUDE,
    })
}

export async function createRestaurantOrderRecord(rawInput: CreateRestaurantOrderInput) {
    const input = normalizeCreateRestaurantOrderInput(rawInput)
    const publicToken = randomBytes(24).toString("base64url")

    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const profile = await tx.profile.findUnique({
                    where: { slug: input.profileSlug },
                    select: {
                        id: true,
                        slug: true,
                        roleTemplate: true,
                        isPublic: true,
                        timezone: true,
                        upiId: true,
                        whatsapp: true,
                        personalityConfig: true,
                    },
                })
                if (!profile || !profile.isPublic || profile.roleTemplate !== "RESTAURANT") {
                    throw new Error("Restaurant not found.")
                }

                const existing = await tx.order.findUnique({
                    where: {
                        profileId_idempotencyKey: {
                            profileId: profile.id,
                            idempotencyKey: input.idempotencyKey,
                        },
                    },
                    include: ORDER_RESULT_INCLUDE,
                })
                if (existing) return { order: existing, replayed: true }

                if (input.payMethod === "UPI" && !profile.upiId) throw new Error("UPI is not available for this restaurant.")
                if (input.payMethod === "WHATSAPP" && !profile.whatsapp) throw new Error("WhatsApp ordering is not available for this restaurant.")

                const productIds = [...new Set(input.lines.map((line) => line.productId))]
                const products = await tx.digitalProduct.findMany({
                    where: { id: { in: productIds } },
                    select: {
                        id: true,
                        profileId: true,
                        title: true,
                        sku: true,
                        priceCents: true,
                        currency: true,
                        category: true,
                        isActive: true,
                        stock: true,
                    },
                })
                const priced = priceRestaurantCart(profile.id, input.lines, products)

                let table: { id: string; label: string } | null = null
                if (input.channel === "DINE_IN") {
                    table = await tx.restaurantTable.findUnique({
                        where: { code: input.tableCode! },
                        select: { id: true, profileId: true, label: true, isActive: true },
                    }).then((row) => {
                        if (!row || !row.isActive || row.profileId !== profile.id) {
                            throw new Error("That table code is not valid for this restaurant.")
                        }
                        return { id: row.id, label: row.label }
                    })
                }

                const now = new Date()
                const dateKey = businessDateKey(profile.timezone, now)
                const allocated = await tx.$queryRaw<Array<{ value: number }>>`
                    INSERT INTO "OrderCounter" ("profileId", "businessDate", "value", "updatedAt")
                    SELECT ${profile.id}, CAST(${dateKey} AS DATE), COALESCE(MAX("number"), 0) + 1, ${now}
                    FROM "Order"
                    WHERE "profileId" = ${profile.id}
                      AND "businessDate" = CAST(${dateKey} AS DATE)
                    ON CONFLICT ("profileId", "businessDate")
                    DO UPDATE SET
                        "value" = GREATEST("OrderCounter"."value" + 1, EXCLUDED."value"),
                        "updatedAt" = EXCLUDED."updatedAt"
                    RETURNING "value"
                `
                const number = allocated[0]?.value
                if (!number || number < 1) throw new Error("Could not allocate an order number.")

                const order = await tx.order.create({
                    data: {
                        profileId: profile.id,
                        publicToken,
                        idempotencyKey: input.idempotencyKey,
                        number,
                        businessDate: new Date(`${dateKey}T00:00:00.000Z`),
                        channel: input.channel,
                        tableId: table?.id || null,
                        tableLabel: table?.label || null,
                        guestName: input.guestName,
                        guestEmail: input.guestEmail,
                        guestPhone: input.guestPhone,
                        note: input.note,
                        subtotalCents: priced.subtotalCents,
                        taxCents: 0,
                        totalCents: priced.totalCents,
                        currency: priced.currency,
                        payMethod: input.payMethod,
                        lines: {
                            create: priced.lines.map((line) => ({
                                productId: line.productId,
                                titleSnapshot: line.titleSnapshot,
                                skuSnapshot: line.skuSnapshot,
                                qty: line.qty,
                                unitPriceCents: line.unitPriceCents,
                                unitModifierCents: line.unitModifierCents,
                                modifiers: line.modifiers.length
                                    ? line.modifiers as unknown as Prisma.InputJsonValue
                                    : undefined,
                                modifiersLabel: line.modifiersLabel,
                                lineTotalCents: line.lineTotalCents,
                            })),
                        },
                        events: {
                            create: {
                                kind: "CREATED",
                                to: "PLACED",
                                actor: "GUEST",
                                metadata: {
                                    channel: input.channel,
                                    tableLabel: table?.label || null,
                                },
                            },
                        },
                    },
                    include: ORDER_RESULT_INCLUDE,
                })

                if (table) {
                    await tx.restaurantTable.update({
                        where: { id: table.id },
                        data: { scans: { increment: 1 } },
                    })
                }

                const defaultMins = defaultPrepMinutesFromConfig(profile.personalityConfig)
                let minutes = defaultMins
                const preps = await tx.$queryRaw<Array<{ id: string; prepMinutes: number | null }>>`
                    SELECT id, "prepMinutes" FROM "DigitalProduct" WHERE id IN (${Prisma.join(productIds)})
                `.catch(() => [] as Array<{ id: string; prepMinutes: number | null }>)
                if (preps.length) {
                    const byId = new Map(preps.map((row) => [row.id, row.prepMinutes]))
                    minutes = Math.max(
                        defaultMins,
                        ...priced.lines.map((line) => byId.get(line.productId) || defaultMins),
                    )
                }
                minutes = Math.max(1, Math.min(90, minutes))
                const dueAt = new Date(now.getTime() + minutes * 60 * 1000)
                await tx.$executeRaw`UPDATE "Order" SET "dueAt" = ${dueAt.toISOString()}::timestamptz WHERE id = ${order.id}`

                return { order, replayed: false }
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

            return publicOrderResult(result.order, result.replayed)
        } catch (error) {
            if (isSerializationFailure(error) && attempt < MAX_TRANSACTION_ATTEMPTS - 1) {
                await waitBeforeRetry(attempt)
                continue
            }
            if (isKnownPrismaError(error, "P2002")) {
                const existing = await findReplayedOrder(input.profileSlug, input.idempotencyKey)
                if (existing) return publicOrderResult(existing, true)
            }
            throw error
        }
    }

    throw new Error("Could not place that order. Please try again.")
}
