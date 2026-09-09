"use server"

import { prisma } from "@/lib/prisma"
import { requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { getPhotorealAccess, requirePhotorealGenerationAccess } from "@/lib/billing/photoreal-access"
import { getAccountBalances, getProfileBilling } from "@/lib/billing/service"
import { enqueueArBatch, isOwnedProductPhoto, listBatch, photoForProduct, publicBuild } from "@/lib/ar-builds"

async function studioContext() {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ permission: "read" }))
    const billing = await getProfileBilling(profile.id)
    const [balances, writeAccess] = await Promise.all([getAccountBalances(billing.accountId), requireProfileAccess({ permission: "content.write", claimedProfileId: profile.id })])
    return { profile, billing, balance: balances.photoreal, canGenerate: writeAccess.ok }
}

export async function getArStudio() {
    const context = await studioContext()
    const products = await prisma.digitalProduct.findMany({ where: { profileId: context.profile.id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, thumbnailUrl: true, galleryUrls: true, arModelUrl: true, isActive: true } })
    const jobs = await prisma.arBuild.findMany({ where: { profileId: context.profile.id }, select: { batchId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 })
    return { access: getPhotorealAccess(), canGenerate: context.canGenerate, plan: { id: context.billing.planId, name: context.billing.plan.name }, balance: context.balance, items: products.map(product => ({ id: product.id, title: product.title, photo: photoForProduct(product), canGenerate: isOwnedProductPhoto(context.profile.id, photoForProduct(product)), has3d: Boolean(product.arModelUrl), live: product.isActive })), recentBatchIds: [...new Set(jobs.map(job => job.batchId))].slice(0, 5) }
}

export async function quoteArBuilds(productIds: string[]) {
    const studio = await getArStudio()
    const ids = new Set(productIds)
    const items = studio.items.filter(item => ids.has(item.id))
    return { access: studio.access, canGenerate: studio.canGenerate, plan: studio.plan, balance: studio.balance, unitsRequired: items.length, items }
}

export async function catalogArItems() { return (await getArStudio()).items }

/** Name retained for old entry points; this now reserves allowance, never creates per-item checkout. */
export async function startArCheckout(input: { productIds: string[]; requestKey: string }) {
    const { profile, actor } = unwrapOwnershipResult(await requireProfileAccess({ permission: "content.write" }))
    requirePhotorealGenerationAccess()
    const billing = await getProfileBilling(profile.id)
    try {
        const batch = await enqueueArBatch({ profileId: profile.id, accountId: billing.accountId, actorId: actor.userId, productIds: input.productIds, requestKey: input.requestKey })
        return { ...batch, error: undefined }
    } catch (error) {
        const message = error instanceof Error && /^(?:Choose between|Upload a|One or more selected|A selected product|This request key|The business billing|Not enough|Verify your email|Today's trial|Your .+ plan allows|Photoreal generation|A valid generation|The prior generation)/.test(error.message)
            ? error.message : "Your generation could not be queued. Check the status before retrying."
        return { error: message, batchId: undefined, replayed: false }
    }
}

export async function pollArBatch(batchId: string) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ permission: "read" }))
    return { batchId, items: (await listBatch(batchId, profile.id)).map(publicBuild) }
}
export async function getArBatch(batchId: string) { return pollArBatch(batchId) }
