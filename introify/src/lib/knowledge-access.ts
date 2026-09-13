import type { Prisma } from "@prisma/client"
import { normalizeEmail } from "@/lib/members"
import { isPublishedKnowledge } from "@/lib/profile-expertise-policy"

export async function resolveClientDocumentIds(
    db: Prisma.TransactionClient,
    profileId: string,
    member: { id: string; email: string | null } | null,
): Promise<Set<string>> {
    const allowed = new Set<string>()
    if (!member) return allowed
    const email = normalizeEmail(member.email || "")
    if (!email || !email.includes("@")) return allowed

    const rows = await db.profileDocument.findMany({
        where: { profileId, visibility: "CLIENT" },
        select: { id: true, type: true, sourceType: true, visibility: true, publicationState: true },
    })
    const documents = rows.filter(isPublishedKnowledge)
    if (!documents.length) return allowed
    const documentIds = documents.map(d => d.id)

    const grants = await db.knowledgeAccessGrant.findMany({
        where: { documentId: { in: documentIds }, memberId: member.id },
        select: { documentId: true, state: true, expiresAt: true },
    })
    const grantByDocument = new Map(grants.map(g => [g.documentId, g]))

    const rules = await db.knowledgePurchaseRule.findMany({
        where: { documentId: { in: documentIds } },
        select: { documentId: true, productId: true, serviceOfferingId: true },
    })
    const productIds = [...new Set(rules.flatMap(r => r.productId ? [r.productId] : []))]
    const serviceIds = [...new Set(rules.flatMap(r => r.serviceOfferingId ? [r.serviceOfferingId] : []))]

    const proofs = (productIds.length || serviceIds.length)
        ? await db.knowledgePaymentProof.findMany({
            where: {
                profileId,
                buyerEmail: email,
                OR: [
                    ...(productIds.length ? [{ itemType: "PRODUCT", itemId: { in: productIds } }] : []),
                    ...(serviceIds.length ? [{ itemType: "SERVICE", itemId: { in: serviceIds } }] : []),
                ],
            },
            select: { stripeAccountId: true, paymentIntentId: true, itemType: true, itemId: true },
        })
        : []
    const blockedKeys = proofs.length
        ? new Set((await db.knowledgePaymentBlock.findMany({
            where: { OR: proofs.map(p => ({ stripeAccountId: p.stripeAccountId, paymentIntentId: p.paymentIntentId })) },
            select: { stripeAccountId: true, paymentIntentId: true },
        })).map(b => `${b.stripeAccountId}:${b.paymentIntentId}`))
        : new Set<string>()
    const paidItems = new Set<string>()
    for (const proof of proofs) {
        if (!blockedKeys.has(`${proof.stripeAccountId}:${proof.paymentIntentId}`)) {
            paidItems.add(`${proof.itemType}:${proof.itemId}`)
        }
    }

    const now = new Date()
    for (const document of documents) {
        const grant = grantByDocument.get(document.id)
        if (grant?.state === "BLOCKED") continue
        if (grant?.state === "ALLOWED" && (!grant.expiresAt || grant.expiresAt > now)) {
            allowed.add(document.id)
            continue
        }
        if (rules.some(r => r.documentId === document.id && (
            (r.productId && paidItems.has(`PRODUCT:${r.productId}`))
            || (r.serviceOfferingId && paidItems.has(`SERVICE:${r.serviceOfferingId}`))
        ))) allowed.add(document.id)
    }
    return allowed
}
