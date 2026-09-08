"use server"

import { prisma } from "@/lib/prisma"
import { executeOwnedResourceWrite, requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
import { revalidatePath } from "next/cache"

export async function addContent(profileId: string, data: { type: string, title: string, content: string }) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    const created = await prisma.profileDocument.create({
        data: {
            profileId: profile.id,
            type: "TEXT",
            sourceType: data.type,
            title: data.title,
            rawText: data.content,
            url: data.type === "URL" ? data.content : undefined,
        }
    })
    revalidatePath("/dashboard/content")
    revalidatePath("/dashboard/profile")
    revalidatePath("/dashboard/inbox")
    const { embedDocument } = await import("@/lib/embeddings")
    embedDocument(created.id).catch(() => {})
}

export async function updateContent(documentId: string, data: { title: string, content: string, sourceType?: string }) {
    const sourceType = data.sourceType
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: documentId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.profileDocument.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: {
                    title: data.title,
                    rawText: data.content,
                    url: sourceType === "URL" ? data.content : undefined,
                },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/content")
    revalidatePath("/dashboard/profile")
}

export async function syncKnowledgeFromChats(profileId: string) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
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
        const who = conv.visitorName || conv.visitorEmail || "Visitor"
        const bits = conv.messages
            .slice()
            .reverse()
            .filter((m) => m.role === "user" && m.text?.trim())
            .map((m) => m.text.trim())
            .slice(0, 4)
        if (!bits.length) continue
        lines.push(`${who}:\n${bits.map((b) => `• ${b}`).join("\n")}`)
    }
    if (!lines.length) return { added: 0 }
    const title = `Chat sync · ${new Date().toLocaleDateString()}`
    const created = await prisma.profileDocument.create({
        data: {
            profileId: profile.id,
            type: "TEXT",
            sourceType: "CHAT_SUMMARY",
            title,
            rawText: lines.join("\n\n"),
        },
    })
    revalidatePath("/dashboard/profile")
    revalidatePath("/dashboard/content")
    const { embedDocument } = await import("@/lib/embeddings")
    embedDocument(created.id).catch(() => {})
    return { added: 1, count: lines.length }
}

export async function deleteContent(documentId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
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
