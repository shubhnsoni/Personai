"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { parseDiet } from "@/lib/menu"
import type { ProductMetal } from "@/lib/metal/math"
import { parseProductMetal, writeProductMetal } from "@/lib/metal/product"
import { writeMedicine, type MedicineBatch } from "@/lib/pharmacy/batch"
import { executeOwnedResourceWrite, requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"

export interface ProductData {
    title: string
    description?: string
    subtitle?: string
    body?: string
    type: "PDF" | "VIDEO" | "AUDIO" | "OTHER" | "PHYSICAL"
    price: number
    compareAtCents?: number
    highlights?: string
    galleryUrls?: string
    fileUrl?: string
    thumbnailUrl?: string
    isActive: boolean
    fulfillment?: "DIGITAL" | "PHYSICAL" | "BOTH"
    stock?: number | null
    sku?: string
    weightGrams?: number | null
    allowCod?: boolean
    category?: string
    diet?: string
    spiceLevel?: number | null
    serveWindow?: string
    prepMinutes?: number | null
    arModelUrl?: string
    arUsdzUrl?: string
    currency?: string
    variantsText?: string
    metal?: ProductMetal | null
    medicine?: MedicineBatch | null
    existingVariantsJson?: string | null
    shipMode?: "NONE" | "PICKUP" | "DELIVER" | "BOTH"
    shipFeeCents?: number
}

function productWrite(data: ProductData) {
    const fulfillment = data.fulfillment || (data.type === "PHYSICAL" ? "PHYSICAL" : "DIGITAL")
    return {
        title: data.title,
        description: data.description || null,
        subtitle: data.subtitle || null,
        body: data.body || null,
        type: fulfillment === "PHYSICAL" ? "PHYSICAL" : data.type,
        priceCents: Math.round(data.price * 100),
        compareAtCents: data.compareAtCents ?? null,
        highlights: data.highlights || null,
        galleryUrls: data.galleryUrls || null,
        fileUrl: data.fileUrl || null,
        thumbnailUrl: data.thumbnailUrl || null,
        isActive: data.isActive,
        fulfillment,
        stock: data.stock === undefined || data.stock === null || Number.isNaN(data.stock) ? null : data.stock,
        sku: data.sku?.trim() || null,
        weightGrams: data.weightGrams ?? null,
        allowCod: Boolean(data.allowCod),
        category: data.category?.trim() || null,
        diet: parseDiet(data.diet) || data.diet?.trim() || null,
        spiceLevel: data.spiceLevel === undefined || data.spiceLevel === null || Number.isNaN(data.spiceLevel) ? null : data.spiceLevel,
        serveWindow: data.serveWindow?.trim() || null,
        arModelUrl: data.arModelUrl?.trim() || null,
        arUsdzUrl: data.arUsdzUrl?.trim() || null,
        variantsJson: (() => {
            let json: string | null | undefined =
                data.variantsText != null || data.metal !== undefined
                    ? writeProductMetal(
                          data.existingVariantsJson ?? null,
                          data.metal === undefined ? parseProductMetal(data.existingVariantsJson ?? null) : data.metal,
                          data.variantsText,
                      )
                    : data.existingVariantsJson ?? null
            if (data.medicine !== undefined) json = writeMedicine(json, data.medicine)
            return json ?? undefined
        })(),
        shipMode: data.shipMode || "NONE",
        shipFeeCents: data.shipFeeCents ?? 0,
        currency: data.currency?.trim() || undefined,
    }
}

export async function createProduct(profileId: string, data: ProductData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    const write = productWrite(data)
    const created = await prisma.digitalProduct.create({
        data: {
            profileId: profile.id,
            ...write,
            currency: write.currency || "USD",
            variantsJson: write.variantsJson ?? null,
        },
    })
    if (data.prepMinutes && data.prepMinutes > 0) {
        await prisma.$executeRaw`UPDATE "DigitalProduct" SET "prepMinutes" = ${Math.min(90, Math.floor(data.prepMinutes))} WHERE id = ${created.id}`
    }
    revalidatePath("/dashboard/products")
    return created
}

export async function updateProduct(productId: string, data: ProductData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: productId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.digitalProduct.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: productWrite(data),
            })
            return updated.count === 1 ? true : null
        },
    }))
    if (data.prepMinutes != null) {
        const minutes = data.prepMinutes > 0 ? Math.min(90, Math.floor(data.prepMinutes)) : null
        await prisma.$executeRaw`UPDATE "DigitalProduct" SET "prepMinutes" = ${minutes} WHERE id = ${productId}`
    }
    revalidatePath("/dashboard/products")
}

export async function setAllPrepMinutes(profileId: string, minutes: number) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    const n = Math.max(1, Math.min(90, Math.floor(minutes)))
    await prisma.$executeRaw`UPDATE "DigitalProduct" SET "prepMinutes" = ${n} WHERE "profileId" = ${profile.id}`
    revalidatePath("/dashboard/products")
}

export async function deleteProduct(productId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: productId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.digitalProduct.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/products")
}

export async function setProductActive(productId: string, isActive: boolean) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: productId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.digitalProduct.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: { isActive },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/products")
}
export async function placeManualOrder(input: {
    productId: string
    visitorName: string
    visitorEmail: string
    payMethod: "UPI" | "COD" | "WHATSAPP"
    address?: string
    buyerNote?: string
}) {
    const product = await prisma.digitalProduct.findUnique({
        where: { id: input.productId },
        include: { profile: true },
    })
    if (!product || !product.isActive) throw new Error("Product not found")
    if (product.stock != null && product.stock <= 0) throw new Error("Sold out")

    const purchase = await prisma.productPurchase.create({
        data: {
            productId: product.id,
            visitorEmail: input.visitorEmail,
            visitorName: input.visitorName,
            status: "PENDING",
            payMethod: input.payMethod,
            address: input.address?.trim() || null,
            buyerNote: input.buyerNote?.trim() || null,
        },
    })

    if (product.stock != null && input.payMethod === "COD") {
        await prisma.digitalProduct.update({
            where: { id: product.id },
            data: { stock: { decrement: 1 } },
        })
    }

    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return {
        id: purchase.id,
        title: product.title,
        priceCents: product.priceCents,
        upiId: product.profile.upiId,
        whatsapp: product.profile.whatsapp,
        slug: product.profile.slug,
        gstin: product.profile.gstin,
    }
}

export async function placeCartOrder(input: {
    lines: { productId: string; qty: number; extras?: string }[]
    visitorName: string
    visitorEmail: string
    payMethod: "UPI" | "COD" | "WHATSAPP"
    address?: string
}) {
    if (!input.lines.length) throw new Error("Cart is empty")
    const ids = [...new Set(input.lines.map((l) => l.productId))]
    const products = await prisma.digitalProduct.findMany({
        where: { id: { in: ids }, isActive: true },
        include: { profile: true },
    })
    if (!products.length || products.length !== ids.length) throw new Error("One or more products are no longer available")
    const profile = products[0].profile
    if (products.some((product) => product.profileId !== profile.id)) {
        throw new Error("Every cart item must belong to the same seller")
    }
    if (profile.roleTemplate === "RESTAURANT") {
        throw new Error("Restaurant carts must use restaurant checkout")
    }
    const rows: { id: string; title: string; qty: number }[] = []
    for (const line of input.lines) {
        const product = products.find((p) => p.id === line.productId)
        if (!product) continue
        const qty = Math.max(1, Math.min(20, Math.floor(line.qty) || 1))
        const purchase = await prisma.productPurchase.create({
            data: {
                productId: product.id,
                visitorEmail: input.visitorEmail,
                visitorName: input.visitorName,
                status: "PENDING",
                payMethod: input.payMethod,
                address: input.address?.trim() || null,
                buyerNote: [`x${qty}`, line.extras].filter(Boolean).join(" · ") || null,
            },
        })
        rows.push({ id: purchase.id, title: product.title, qty })
    }
    if (!rows.length) throw new Error("Could not place that order")
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
    return {
        count: rows.length,
        upiId: profile.upiId,
        whatsapp: profile.whatsapp,
        slug: profile.slug,
        gstin: profile.gstin,
    }
}

export async function confirmProductOrder(purchaseId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: purchaseId,
        writeOwned: async ({ resourceId, profile }) => prisma.$transaction(async (tx) => {
            const purchase = await tx.productPurchase.findFirst({
                where: { id: resourceId, product: { profileId: profile.id } },
                include: { product: true },
            })
            if (!purchase) return null
            if (purchase.status === "COMPLETED") return true
            if (purchase.status !== "PENDING") throw new Error(`Cannot confirm a ${purchase.status.toLowerCase()} purchase`)

            if (purchase.product.stock != null && purchase.payMethod !== "COD") {
                const stockUpdate = await tx.digitalProduct.updateMany({
                    where: { id: purchase.productId, profileId: profile.id, stock: { gte: 1 } },
                    data: { stock: { decrement: 1 } },
                })
                if (stockUpdate.count !== 1) throw new Error("Product is sold out")
            }
            const purchaseUpdate = await tx.productPurchase.updateMany({
                where: {
                    id: purchase.id,
                    productId: purchase.productId,
                    status: "PENDING",
                    product: { profileId: profile.id },
                },
                data: { status: "COMPLETED", confirmedAt: new Date() },
            })
            return purchaseUpdate.count === 1 ? true : null
        }),
    }))
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/money")
}
export async function placeTip(input: {
    profileId: string
    visitorName: string
    visitorEmail: string
    amountCents: number
}) {
    const amount = Math.max(100, Math.round(input.amountCents))
    const payment = await prisma.payment.create({
        data: {
            profileId: input.profileId,
            amountCents: amount,
            currency: "USD",
            status: "PENDING",
            provider: "UPI",
        },
    })
    revalidatePath("/dashboard/money")
    revalidatePath("/dashboard/orders")
    const profile = await prisma.profile.findUnique({ where: { id: input.profileId } })
    return { id: payment.id, upiId: profile?.upiId, whatsapp: profile?.whatsapp, amountCents: amount }
}

export async function addProductReview(input: {
    productId: string
    rating: number
    text?: string
    visitorName: string
    imageUrl?: string
}) {
    const rating = Math.min(5, Math.max(1, Math.round(input.rating)))
    await prisma.offerReview.create({
        data: {
            productId: input.productId,
            rating,
            text: input.text?.trim() || null,
            imageUrl: input.imageUrl?.trim() || null,
            visitorName: input.visitorName.trim() || "Buyer",
        },
    })
    revalidatePath("/dashboard/products")
}
