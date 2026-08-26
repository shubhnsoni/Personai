"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { variantsToJson } from "@/lib/commerce"
import { parseDiet } from "@/lib/menu"

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
    arModelUrl?: string
    arUsdzUrl?: string
    currency?: string
    variantsText?: string
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
        variantsJson: data.variantsText != null ? variantsToJson(data.variantsText) : undefined,
        shipMode: data.shipMode || "NONE",
        shipFeeCents: data.shipFeeCents ?? 0,
        currency: data.currency?.trim() || undefined,
    }
}

export async function createProduct(profileId: string, data: ProductData) {
    const write = productWrite(data)
    const created = await prisma.digitalProduct.create({
        data: {
            profileId,
            ...write,
            currency: write.currency || "USD",
            variantsJson: write.variantsJson ?? null,
        },
    })
    revalidatePath("/dashboard/products")
    return created
}

export async function updateProduct(productId: string, data: ProductData) {
    await prisma.digitalProduct.update({
        where: { id: productId },
        data: productWrite(data),
    })
    revalidatePath("/dashboard/products")
}

export async function deleteProduct(productId: string) {
    await prisma.digitalProduct.delete({
        where: { id: productId },
    })
    revalidatePath("/dashboard/products")
}

export async function setProductActive(productId: string, isActive: boolean) {
    await prisma.digitalProduct.update({
        where: { id: productId },
        data: { isActive },
    })
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
    if (!products.length) throw new Error("Those dishes are no longer available")
    const profile = products[0].profile
    const rows = []
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
    const purchase = await prisma.productPurchase.update({
        where: { id: purchaseId },
        data: { status: "COMPLETED", confirmedAt: new Date() },
        include: { product: true },
    })
    if (purchase.product.stock != null && purchase.payMethod !== "COD") {
        await prisma.digitalProduct.update({
            where: { id: purchase.productId },
            data: { stock: { decrement: 1 } },
        })
    }
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
    const created = await prisma.offerReview.create({
        data: {
            productId: input.productId,
            rating,
            text: input.text?.trim() || null,
            visitorName: input.visitorName.trim() || "Buyer",
        },
    })
    const imageUrl = input.imageUrl?.trim()
    if (imageUrl) {
        await prisma.$executeRaw`UPDATE "OfferReview" SET "imageUrl" = ${imageUrl} WHERE id = ${created.id}`
    }
    revalidatePath("/dashboard/products")
}
