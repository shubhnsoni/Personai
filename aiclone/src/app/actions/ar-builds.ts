"use server"

import { prisma } from "@/lib/prisma"
import { requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { arQuote } from "@/lib/ar-price"
import { meshyConfigured } from "@/lib/meshy-internal"
import { env } from "@/lib/env"
import {
    createBatch,
    listBatch,
    markBatchPaid,
    photoForProduct,
    publicBuild,
    tickBatch,
} from "@/lib/ar-builds"

export async function quoteArBuilds(productIds: string[], photos?: Record<string, string>) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    const ids = [...new Set(productIds.filter(Boolean))].slice(0, 80)
    const products = await prisma.digitalProduct.findMany({
        where: { profileId: profile.id, id: { in: ids } },
        select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true, arModelUrl: true },
    })
    const items = products.map((p) => ({
        id: p.id,
        title: p.title,
        photo: photos?.[p.id] || photoForProduct(p),
        has3d: Boolean(p.arModelUrl),
    }))
    const ready = items.filter((i) => i.photo)
    return {
        studioReady: meshyConfigured(),
        paymentsReady: env.hasStripe,
        quote: arQuote(ready.length),
        items,
    }
}

export async function catalogArItems() {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    const products = await prisma.digitalProduct.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true, arModelUrl: true, isActive: true },
    })
    return products.map((p) => ({
        id: p.id,
        title: p.title,
        photo: photoForProduct(p),
        has3d: Boolean(p.arModelUrl),
        live: p.isActive,
    }))
}

export async function startArCheckout(input: { productIds: string[]; photos?: Record<string, string> }) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    const ids = [...new Set(input.productIds.filter(Boolean))].slice(0, 80)
    if (!ids.length) throw new Error("Pick at least one item.")
    if (!meshyConfigured()) throw new Error("3D studio isn’t connected yet.")

    const products = await prisma.digitalProduct.findMany({
        where: { profileId: profile.id, id: { in: ids } },
        select: { id: true, thumbnailUrl: true, galleryUrls: true },
    })
    const items = products.map((p) => {
        const imageUrl = input.photos?.[p.id] || photoForProduct(p)
        if (!imageUrl) return null
        return { productId: p.id, imageUrl }
    }).filter(Boolean) as { productId: string; imageUrl: string }[]
    if (!items.length) throw new Error("Add a photo for each item first.")

    const batchId = await createBatch({ profileId: profile.id, items })
    const totalCents = arQuote(items.length).totalCents

    if (!env.hasStripe) {
        await markBatchPaid(batchId, "local")
        await tickBatch(batchId, profile.id)
        return { batchId, checkoutUrl: null as string | null, totalCents }
    }

    const { getUncachableStripeClient } = await import("@/lib/stripe")
    const stripe = await getUncachableStripeClient()
    const { getRequestCurrency } = await import("@/lib/request-currency")
    const { convertUsdCents, stripeCurrency } = await import("@/lib/pricing")
    const currency = await getRequestCurrency()
    const amount = convertUsdCents(totalCents, currency)
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${env.appUrl}/dashboard/products?ar=${batchId}`,
        cancel_url: `${env.appUrl}/dashboard/products?ar=cancel`,
        metadata: { itemType: "ar-build", itemId: batchId, profileId: profile.id },
        line_items: [{
            quantity: 1,
            price_data: {
                currency: stripeCurrency(currency),
                unit_amount: amount,
                product_data: {
                    name: `Photoreal 3D · ${items.length} item${items.length === 1 ? "" : "s"}`,
                    description: "Table-ready 3D models from your photos",
                },
            },
        }],
    })
    await prisma.$executeRaw`
        UPDATE "ArBuild" SET "stripeSessionId" = ${session.id}, "updatedAt" = CURRENT_TIMESTAMP WHERE "batchId" = ${batchId}
    `
    return { batchId, checkoutUrl: session.url, totalCents }
}

export async function pollArBatch(batchId: string) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    const rows = await tickBatch(batchId, profile.id)
    return { batchId, items: rows }
}

export async function getArBatch(batchId: string) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile())
    const rows = await listBatch(batchId, profile.id)
    return { batchId, items: rows.map(publicBuild) }
}
