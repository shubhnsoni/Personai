import { withKnowledgeLimit } from "@/lib/billing/resource-limits"
import { prisma } from "@/lib/prisma"
import { getProfileBilling } from "@/lib/billing/service"
import { redactVisitorText } from "@/lib/memory-privacy"

/** Private, deterministic notes: no unmetered summarization or embedding calls. */
export async function maybeSummarizeConversation(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { profile: true, messages: { orderBy: { createdAt: "desc" }, take: 12 } },
    })
    if (!conversation?.profile.autoMemoryEnabled) return
    const billing = await getProfileBilling(conversation.profileId)
    if (!billing.features.autoMemory) return
    const consent = await prisma.profileEvent.findFirst({
        where: { profileId: conversation.profileId, name: "visitor_memory_consent", path: conversation.id },
        orderBy: { createdAt: "desc" },
    })
    if (!consent || consent.meta !== '{"granted":true}') return
    const key = visitorKeyFrom(null, conversation.visitorId || conversation.memberId)
    if (!key) return
    const messages = conversation.messages.slice().reverse()
    if (messages.length < 6 || messages[messages.length - 1]?.id === conversation.lastSummarizedMsgId) return
    const excerpt = messages.filter(message => message.senderType === "VISITOR")
        .slice(-6).map(message => redactVisitorText(message.text, [conversation.visitorName, conversation.visitorEmail])).join("\n").slice(0, 2400)
    if (!excerpt) return
    const existing = await prisma.profileDocument.findFirst({
        where: { profileId: conversation.profileId, type: "VISITOR_MEMORY", conversationId: conversation.id, visitorKey: key },
    })
    const data = { title: "Private conversation notes", rawText: excerpt, sourceType: "CHAT_PRIVATE", embedding: [] as number[] }
    await withKnowledgeLimit(conversation.profileId, existing?.id || null, excerpt, async tx => {
        if (existing) return tx.profileDocument.update({ where: { id: existing.id }, data })
        return tx.profileDocument.create({ data: {
            ...data, profileId: conversation.profileId, type: "VISITOR_MEMORY", visitorKey: key,
            conversationId: conversation.id, memberId: conversation.memberId,
        } })
    })
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastSummarizedMsgId: messages[messages.length - 1]?.id } })
}

/** Email addresses never establish a memory identity. */
export function visitorKeyFrom(_email?: string | null, visitorId?: string | null) {
    return visitorId ? `visitor:${visitorId}` : null
}
