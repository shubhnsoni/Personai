import { prisma } from "@/lib/prisma"
import { embedDocument } from "@/lib/embeddings"

const PROFILE_TITLE = "Learned from chats"

function visitorKeyOf(conversation: { visitorEmail?: string | null; visitorId?: string | null }) {
    return (conversation.visitorEmail || conversation.visitorId || "").toLowerCase() || null
}

export async function maybeSummarizeConversation(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            profile: true,
            messages: { orderBy: { createdAt: "asc" } },
        },
    })
    if (!conversation?.profile.autoMemoryEnabled) return
    if (!process.env.OPENAI_API_KEY) return

    const msgs = conversation.messages
    if (msgs.length < 6) return

    const lastId = conversation.lastSummarizedMsgId
    const start = lastId ? msgs.findIndex((m) => m.id === lastId) + 1 : 0
    const fresh = start > 0 ? msgs.slice(start) : msgs
    if (fresh.length < 6) return

    const transcript = fresh.map((m) => `${m.senderType === "VISITOR" ? "Visitor" : "Host"}: ${m.text}`).join("\n")
    const { default: OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const [profileSum, visitorSum] = await Promise.all([
        summarize(openai, "anonymized", transcript, conversation.profile.displayName),
        summarize(openai, "visitor", transcript, conversation.profile.displayName),
    ])

    await upsertMemoryDoc({
        profileId: conversation.profileId,
        type: "PROFILE_MEMORY",
        title: PROFILE_TITLE,
        visitorKey: null,
        next: profileSum,
    })

    const key = visitorKeyOf(conversation)
    if (key && visitorSum) {
        await upsertMemoryDoc({
            profileId: conversation.profileId,
            type: "VISITOR_MEMORY",
            title: `Notes on ${conversation.visitorName || "a visitor"}`,
            visitorKey: key,
            memberId: conversation.memberId,
            conversationId: conversation.id,
            next: visitorSum,
        })
    }

    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastSummarizedMsgId: msgs[msgs.length - 1]?.id },
    })
}

async function summarize(
    openai: import("openai").default,
    kind: "anonymized" | "visitor",
    transcript: string,
    ownerName: string
) {
    const prompt =
        kind === "anonymized"
            ? `Summarize what visitors commonly ask ${ownerName}. No names, emails, or payment details. Bullet facts only, under 120 words.\n\n${transcript}`
            : `Extract durable facts about this visitor for ${ownerName}'s AI. First name ok. No payment details. Under 120 words.\n\n${transcript}`

    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 220,
        })
        return res.choices[0]?.message?.content?.trim() || ""
    } catch (e) {
        console.error("[memory] summarize failed", e)
        return ""
    }
}

async function upsertMemoryDoc(input: {
    profileId: string
    type: string
    title: string
    visitorKey: string | null
    memberId?: string | null
    conversationId?: string
    next: string
}) {
    if (!input.next) return
    const existing = await prisma.profileDocument.findFirst({
        where: {
            profileId: input.profileId,
            type: input.type,
            visitorKey: input.visitorKey,
        },
    })
    const merged = existing?.rawText
        ? `${input.next}\n\nEarlier:\n${existing.rawText}`.slice(0, 4000)
        : input.next

    if (existing) {
        await prisma.profileDocument.update({
            where: { id: existing.id },
            data: { rawText: merged, title: input.title },
        })
        await embedDocument(existing.id)
        return
    }

    const created = await prisma.profileDocument.create({
        data: {
            profileId: input.profileId,
            type: input.type,
            sourceType: "CHAT_SUMMARY",
            title: input.title,
            rawText: merged,
            visitorKey: input.visitorKey,
            memberId: input.memberId || undefined,
            conversationId: input.conversationId,
        },
    })
    await embedDocument(created.id)
}

export function visitorKeyFrom(email?: string | null, visitorId?: string | null) {
    return (email || visitorId || "").toLowerCase() || null
}
