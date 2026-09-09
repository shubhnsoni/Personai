import type { Prisma } from "@prisma/client"
import { assertAccountLimit, getProfileBilling, withBillingLimit } from "./service"

export type OfferingKind = "product" | "service" | "course" | "event" | "community" | "leadMagnet"

async function isPublished(tx: Prisma.TransactionClient, kind: OfferingKind, profileId: string, id: string) {
    const where = { id, profileId }
    switch (kind) {
        case "product": return Boolean((await tx.digitalProduct.findFirst({ where, select: { isActive: true } }))?.isActive)
        case "service": return Boolean((await tx.serviceOffering.findFirst({ where, select: { isActive: true } }))?.isActive)
        case "event": return Boolean((await tx.event.findFirst({ where, select: { isActive: true } }))?.isActive)
        case "community": return Boolean((await tx.community.findFirst({ where, select: { isActive: true } }))?.isActive)
        case "leadMagnet": return Boolean((await tx.leadMagnet.findFirst({ where, select: { isActive: true } }))?.isActive)
        case "course": {
            const row = await tx.course.findFirst({ where, select: { isActive: true, isPublished: true } })
            return Boolean(row?.isActive && row.isPublished)
        }
    }
}

/** Check growth and write while holding the same account lock; draft edits never spend a publishing slot. */
export function withOfferingLimit<T>(profileId: string, kind: OfferingKind, id: string | null, published: boolean, write: (tx: Prisma.TransactionClient) => Promise<T>) {
    return withBillingLimit(profileId, "offerings", async (tx) => {
        const previous = id ? await isPublished(tx, kind, profileId, id) : false
        return Number(published) - Number(previous)
    }, write)
}

/** Source count and extracted text share a transaction so concurrent imports cannot overspend either allowance. */
export async function withKnowledgeLimit<T>(profileId: string, documentId: string | null, nextText: string, write: (tx: Prisma.TransactionClient) => Promise<T>) {
    const context = await getProfileBilling(profileId)
    return withBillingLimit(profileId, "knowledgeSources", documentId ? 0 : 1, async (tx) => {
        const previous = documentId ? await tx.profileDocument.findFirst({ where: { id: documentId, profileId }, select: { rawText: true } }) : null
        await assertAccountLimit(tx, context.accountId, "knowledgeCharacters", nextText.length - (previous?.rawText?.length || 0))
        return write(tx)
    })
}
