"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { syncUser } from "@/lib/auth-sync"
import { sendEmail } from "@/lib/email"

async function ownedConversation(conversationId: string) {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!profile) throw new Error("Unauthorized")
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { profile: { include: { user: true } } },
    })
    if (!conversation || conversation.profileId !== profile.id) throw new Error("Not found")
    return { user, profile, conversation }
}

export async function sendOwnerMessage(conversationId: string, text: string) {
    const trimmed = text.trim()
    if (!trimmed) throw new Error("Message required")
    const { conversation } = await ownedConversation(conversationId)
    await prisma.message.create({
        data: {
            conversationId: conversation.id,
            senderType: "OWNER",
            role: "assistant",
            text: trimmed,
        },
    })
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
    })
    revalidatePath("/dashboard/inbox")
}

export async function requestLiveChatFromOwner() {
    // unused — visitors use the API
}

export async function respondLiveChat(conversationId: string, accept: boolean) {
    const { conversation } = await ownedConversation(conversationId)
    if (conversation.mode !== "LIVE_REQUESTED" && conversation.mode !== "LIVE") {
        throw new Error("No live request")
    }

    if (accept) {
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { mode: "LIVE", liveRespondedAt: new Date() },
        })
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderType: "OWNER",
                role: "assistant",
                text: "I'm here. How can I help?",
            },
        })
    } else {
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { mode: "AI", liveRespondedAt: new Date() },
        })
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderType: "AI",
                role: "assistant",
                text: "I can't join live right now. You can book a call and I'll make time.",
            },
        })
    }

    revalidatePath("/dashboard/inbox")
    revalidatePath("/dashboard")
}

export async function endLiveChat(conversationId: string) {
    const { conversation } = await ownedConversation(conversationId)
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { mode: "AI", liveRespondedAt: new Date() },
    })
    await prisma.message.create({
        data: {
            conversationId: conversation.id,
            senderType: "OWNER",
            role: "assistant",
            text: "Stepping out — the AI will take it from here.",
        },
    })
    revalidatePath("/dashboard/inbox")
    revalidatePath("/dashboard")
}

export async function notifyOwnerLive(opts: {
    creatorEmail: string
    creatorName: string
    visitorName: string
    href: string
    preview?: string
}) {
    await sendEmail({
        to: opts.creatorEmail,
        subject: `${opts.visitorName} wants to talk live`,
        text: `${opts.visitorName} asked to chat with you. Open ${opts.href}`,
        html: `<p>${opts.visitorName} wants to talk live.</p>${opts.preview ? `<p>“${opts.preview}”</p>` : ""}<p><a href="${opts.href}">Open chat</a></p>`,
    })
}
