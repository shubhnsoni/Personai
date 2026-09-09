"use server"

import { withKnowledgeLimit } from "@/lib/billing/resource-limits"
import { prisma } from "@/lib/prisma"
import { executeProfileResourceWrite, requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { revalidatePath } from "next/cache"
import { redactVisitorText } from "@/lib/memory-privacy"

export async function addContent(profileId: string, data: { type: string, title: string, content: string }) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const created = await withKnowledgeLimit(profile.id, null, data.content, (tx) => tx.profileDocument.create({
        data: {
            profileId: profile.id,
            type: "TEXT",
            sourceType: data.type,
            title: data.title,
            rawText: data.content,
            url: data.type === "URL" ? data.content : undefined,
        }
    }))
    revalidatePath("/dashboard/content")
    revalidatePath("/dashboard/profile")
    revalidatePath("/dashboard/inbox")
    const { embedDocument } = await import("@/lib/embeddings")
    embedDocument(created.id).catch(() => {})
}

export async function updateContent(documentId: string, data: { title: string, content: string, sourceType?: string }) {
    const sourceType = data.sourceType
    unwrapOwnershipResult(await executeProfileResourceWrite({
        resourceId: documentId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await withKnowledgeLimit(profile.id, resourceId, data.content, (tx) => tx.profileDocument.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: {
                    title: data.title,
                    rawText: data.content,
                    url: sourceType === "URL" ? data.content : undefined,
                },
            }))
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/content")
    revalidatePath("/dashboard/profile")
}

export async function syncKnowledgeFromChats(profileId: string) {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ claimedProfileId: profileId }))
    const conversations = await prisma.conversation.findMany({
        where: { profileId: profile.id },
        orderBy: { lastMessageAt: "desc" },
        take: 12,
        include: {
            messages: { orderBy: { createdAt: "desc" }, take: 8 },
        },
    })
    const lines: string[] = []
    for (const conv of conversations) {
        const bits = conv.messages
            .slice()
            .reverse()
            .filter((m) => m.role === "user" && m.text?.trim())
            .map((m) => redactVisitorText(m.text.trim(), [conv.visitorName, conv.visitorEmail]))
            .slice(0, 4)
        if (!bits.length) continue
        lines.push(`Private conversation:\n${bits.map((b) => `• ${b}`).join("\n")}`)
    }
    if (!lines.length) return { added: 0 }
    const title = `Private chat notes · ${new Date().toLocaleDateString()}`
    await withKnowledgeLimit(profile.id, null, lines.join("\n\n"), (tx) => tx.profileDocument.create({
        data: {
            profileId: profile.id,
            type: "PRIVATE_CHAT_NOTES",
            sourceType: "CHAT_PRIVATE",
            title,
            rawText: lines.join("\n\n"),
        },
    }))
    revalidatePath("/dashboard/profile")
    revalidatePath("/dashboard/content")
    return { added: 1, count: lines.length }
}

export async function deleteContent(documentId: string) {
    unwrapOwnershipResult(await executeProfileResourceWrite({
        resourceId: documentId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.profileDocument.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/content")
    revalidatePath("/dashboard/profile")
}
