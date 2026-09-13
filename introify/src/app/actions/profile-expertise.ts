"use server"

import { prisma } from "@/lib/prisma"
import { requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { assertBillingFeature, getProfileBilling } from "@/lib/billing/service"
import { frameworkDraftSchema, type FrameworkDraft } from "@/lib/profile-import-contract"
import { groupKnowledgeGaps, KNOWLEDGE_GAP_ROW_LIMIT, KNOWLEDGE_GAP_WINDOW_DAYS, isPublishedKnowledge } from "@/lib/profile-expertise-policy"

function plain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

export async function getProfileExpertise(profileId: string) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const [frameworks, introductions, documents, grants, offers, billing] = await Promise.all([
        prisma.profileFramework.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } }),
        prisma.profileIntroduction.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } }),
        prisma.profileDocument.findMany({
            where: { profileId: profile.id },
            select: { id: true, title: true, type: true, sourceType: true, visibility: true, publicationState: true },
            orderBy: { createdAt: "desc" },
        }),
        prisma.knowledgeAccessGrant.findMany({
            where: { document: { profileId: profile.id } },
            select: { id: true, documentId: true, state: true, expiresAt: true, member: { select: { email: true } } },
            orderBy: { createdAt: "desc" },
        }),
        Promise.all([
            prisma.digitalProduct.findMany({ where: { profileId: profile.id }, select: { id: true, title: true, isActive: true } }),
            prisma.serviceOffering.findMany({ where: { profileId: profile.id }, select: { id: true, name: true, isActive: true } }),
        ]),
        getProfileBilling(profile.id),
    ])
    const rules = await prisma.knowledgePurchaseRule.findMany({
        where: { document: { profileId: profile.id } },
        select: { id: true, documentId: true, productId: true, serviceOfferingId: true },
    })
    return plain({
        frameworks,
        introductions,
        documents: documents.map(d => ({ ...d, publishable: isPublishedKnowledge({ ...d, publicationState: "PUBLISHED" }) })),
        grants,
        rules,
        offers: { products: offers[0], services: offers[1] },
        settings: {
            knowledgeGapTracking: profile.knowledgeGapTracking,
            advancedAnalytics: billing.features.advancedAnalytics === true,
        },
    })
}

export async function saveProfileFramework(
    profileId: string,
    id: string,
    data: { definition: FrameworkDraft; publish: boolean; scoringApproved: boolean },
) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const definition = frameworkDraftSchema.parse(data.definition)
    const ids = definition.questions.map(q => q.id)
    if (new Set(ids).size !== ids.length) throw new Error("Question IDs must be unique.")
    if (data.publish && !data.scoringApproved) throw new Error("Approve the scoring before publishing this framework.")
    const updated = await prisma.profileFramework.updateMany({
        where: { id, profileId: profile.id },
        data: {
            title: definition.title,
            description: definition.description,
            definition: JSON.parse(JSON.stringify(definition)),
            status: data.publish ? "PUBLISHED" : "DRAFT",
            scoringApproved: Boolean(data.scoringApproved),
        },
    })
    if (!updated.count) throw new Error("Framework not found.")
}

export async function saveProfileIntroduction(
    profileId: string,
    id: string,
    data: { intent: string; text: string; publish: boolean },
) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const intent = (data.intent || "").trim().slice(0, 60)
    const text = (data.text || "").trim().slice(0, 700)
    if (!intent || !text) throw new Error("Intent and text are required.")
    const updated = await prisma.profileIntroduction.updateMany({
        where: { id, profileId: profile.id },
        data: { intent, text, status: data.publish ? "PUBLISHED" : "DRAFT" },
    })
    if (!updated.count) throw new Error("Introduction not found.")
}

export async function setKnowledgeGapTracking(profileId: string, enabled: boolean) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    await assertBillingFeature(profile.id, "advancedAnalytics")
    await prisma.profile.update({ where: { id: profile.id }, data: { knowledgeGapTracking: enabled === true } })
}

export async function getKnowledgeGaps(profileId: string) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    await assertBillingFeature(profile.id, "advancedAnalytics")
    const since = new Date(Date.now() - KNOWLEDGE_GAP_WINDOW_DAYS * 86400000)
    const rows = await prisma.knowledgeGapSignal.findMany({
        where: { profileId: profile.id, status: "OPEN", createdAt: { gte: since } },
        select: { id: true, question: true, createdAt: true, status: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: KNOWLEDGE_GAP_ROW_LIMIT + 1,
    })
    return {
        since: since.toISOString(),
        truncated: rows.length > KNOWLEDGE_GAP_ROW_LIMIT,
        groups: groupKnowledgeGaps(rows.slice(0, KNOWLEDGE_GAP_ROW_LIMIT)),
    }
}

export async function resolveKnowledgeGaps(profileId: string, ids: string[], state: "DISMISSED" | "ANSWERED") {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    await assertBillingFeature(profile.id, "advancedAnalytics")
    if (state !== "DISMISSED" && state !== "ANSWERED") throw new Error("Invalid state.")
    const clean = (Array.isArray(ids) ? ids : []).filter(id => typeof id === "string" && id.length > 0 && id.length <= 191).slice(0, 200)
    if (!clean.length) return
    await prisma.knowledgeGapSignal.updateMany({
        where: { profileId: profile.id, id: { in: clean } },
        data: { status: state },
    })
}
