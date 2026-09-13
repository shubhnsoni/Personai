"use server"

import { prisma } from "@/lib/prisma"
import { requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { upsertMember, normalizeEmail } from "@/lib/members"
import { isPublishedKnowledge } from "@/lib/profile-expertise-policy"

async function ownedDocument(profileId: string, documentId: string) {
    if (typeof documentId !== "string" || documentId.length > 191) throw new Error("Invalid document.")
    const document = await prisma.profileDocument.findFirst({ where: { id: documentId, profileId } })
    if (!document) throw new Error("Document not found.")
    return document
}

export async function setKnowledgeVisibility(
    profileId: string,
    documentId: string,
    data: { visibility: "PUBLIC" | "CLIENT" | "PRIVATE"; publicationState: "DRAFT" | "PUBLISHED" },
) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const document = await ownedDocument(profile.id, documentId)
    if (!["PUBLIC", "CLIENT", "PRIVATE"].includes(data.visibility)) throw new Error("Invalid visibility.")
    if (!["DRAFT", "PUBLISHED"].includes(data.publicationState)) throw new Error("Invalid publication state.")
    if (data.visibility !== "PRIVATE" && data.publicationState === "PUBLISHED"
        && !isPublishedKnowledge({ ...document, publicationState: "PUBLISHED", visibility: data.visibility })) {
        throw new Error("Private chat and memory notes cannot be published.")
    }
    await prisma.profileDocument.update({
        where: { id: document.id },
        data: { visibility: data.visibility, publicationState: data.publicationState },
    })
}

export async function setKnowledgeMemberAccess(
    profileId: string,
    documentId: string,
    data: { email: string; allow: boolean; expiresAt: string | null },
) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const document = await ownedDocument(profile.id, documentId)
    if (document.visibility !== "CLIENT" || !isPublishedKnowledge({ ...document, publicationState: "PUBLISHED", visibility: "CLIENT" })) {
        throw new Error("Only published client-only documents can have member access grants.")
    }
    const email = normalizeEmail(data.email || "")
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Valid email required.")
    let expiresAt: Date | null = null
    if (data.expiresAt) {
        expiresAt = new Date(data.expiresAt)
        if (Number.isNaN(expiresAt.getTime())) throw new Error("Invalid expiry.")
        if (expiresAt <= new Date()) throw new Error("Expiry must be in the future.")
    }
    const member = await upsertMember(email)
    await prisma.knowledgeAccessGrant.upsert({
        where: { documentId_memberId: { documentId: document.id, memberId: member.id } },
        create: { documentId: document.id, memberId: member.id, state: data.allow ? "ALLOWED" : "BLOCKED", expiresAt: data.allow ? expiresAt : null },
        update: { state: data.allow ? "ALLOWED" : "BLOCKED", expiresAt: data.allow ? expiresAt : null },
    })
}

export async function setKnowledgePurchaseRule(
    profileId: string,
    documentId: string,
    data: { kind: "PRODUCT" | "SERVICE"; itemId: string; enabled: boolean },
) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const document = await ownedDocument(profile.id, documentId)
    if (data.kind !== "PRODUCT" && data.kind !== "SERVICE") throw new Error("Invalid rule kind.")
    if (typeof data.itemId !== "string" || data.itemId.length > 191) throw new Error("Invalid item.")
    if (data.kind === "PRODUCT") {
        const product = await prisma.digitalProduct.findFirst({ where: { id: data.itemId, profileId: profile.id }, select: { id: true } })
        if (!product) throw new Error("Product not found.")
        if (data.enabled) {
            await prisma.knowledgePurchaseRule.upsert({
                where: { documentId_productId: { documentId: document.id, productId: product.id } },
                create: { documentId: document.id, productId: product.id },
                update: {},
            })
        } else {
            await prisma.knowledgePurchaseRule.deleteMany({ where: { documentId: document.id, productId: product.id } })
        }
        return
    }
    const service = await prisma.serviceOffering.findFirst({ where: { id: data.itemId, profileId: profile.id }, select: { id: true } })
    if (!service) throw new Error("Service not found.")
    if (data.enabled) {
        await prisma.knowledgePurchaseRule.upsert({
            where: { documentId_serviceOfferingId: { documentId: document.id, serviceOfferingId: service.id } },
            create: { documentId: document.id, serviceOfferingId: service.id },
            update: {},
        })
    } else {
        await prisma.knowledgePurchaseRule.deleteMany({ where: { documentId: document.id, serviceOfferingId: service.id } })
    }
}
