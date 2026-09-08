import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getMemberFromSession } from "@/lib/members"
import { checkRateLimit } from "@/lib/rate-limit"
import { createNotification } from "@/lib/notifications"
import { notifyOwnerLive } from "@/app/actions/inbox"
import { createOwnershipFoundation, ownershipRefusalResponse } from "@/lib/security"
import {
    conversationCapabilityCookieName,
    productionCapabilitySecret,
    verifyConversationCapability,
} from "@/lib/conversation-capability"

export const dynamic = "force-dynamic"

const VISITOR_COOKIE = "pl_vid"

const CONVERSATION_FORBIDDEN = Object.freeze({
    code: "FORBIDDEN" as const,
    status: 403 as const,
    message: "Access denied",
})

type ConversationDb = Prisma.TransactionClient
type MemberIdentity = Awaited<ReturnType<typeof getMemberFromSession>>

type LiveConversation = {
    id: string
    profileId: string
    mode: string
    visitorId: string | null
    visitorName: string | null
    visitorEmail: string | null
    memberId: string | null
    liveRequestedAt: Date | null
    liveRespondedAt: Date | null
    profile: {
        userId: string
        displayName: string
        liveChatEnabled: boolean
        user: { email: string }
    }
    messages: { text: string }[]
}

type LiveRouteDependencies = Readonly<{
    db: ConversationDb
    resolveMember: () => Promise<MemberIdentity>
    rateLimit: typeof checkRateLimit
    createNotification: typeof createNotification
    notifyOwner: typeof notifyOwnerLive
    capabilitySecret: () => string | null
    now: () => number
}>

const productionDependencies: LiveRouteDependencies = {
    db: prisma as unknown as ConversationDb,
    resolveMember: getMemberFromSession,
    rateLimit: checkRateLimit,
    createNotification,
    notifyOwner: notifyOwnerLive,
    capabilitySecret: productionCapabilitySecret,
    now: Date.now,
}

function refusal(): Response {
    return ownershipRefusalResponse(CONVERSATION_FORBIDDEN)
}

function opaqueId(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0 || value.length > 191) return null
    if (value.trim() !== value || /[\s\u0000-\u001f\u007f]/u.test(value)) return null
    return value
}

function parseCookies(header: string | null): Map<string, string> {
    const parsed = new Map<string, string>()
    for (const part of (header || "").split(";")) {
        const separator = part.indexOf("=")
        if (separator < 1) continue
        const name = part.slice(0, separator).trim()
        const encoded = part.slice(separator + 1).trim()
        try {
            parsed.set(name, decodeURIComponent(encoded))
        } catch {
            // Malformed cookies are ignored and therefore fail closed.
        }
    }
    return parsed
}

function visitorNameOf(conversation: LiveConversation, member: MemberIdentity): string {
    return member?.name || member?.email || conversation.visitorName || conversation.visitorEmail || "A visitor"
}

export function createLivePostHandler(overrides: Partial<LiveRouteDependencies> = {}) {
    const dependencies: LiveRouteDependencies = { ...productionDependencies, ...overrides }

    return async function handleLivePost(req: Request): Promise<Response> {
        const { db, resolveMember, rateLimit, createNotification, notifyOwner, capabilitySecret, now } = dependencies
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
        const { allowed } = rateLimit(ip)
        if (!allowed) return Response.json({ error: "Too many requests" }, { status: 429 })

        const member = await resolveMember().catch(() => null)

        let body: { conversationId?: unknown; profileId?: unknown; action?: unknown }
        try {
            body = await req.json()
        } catch {
            return new Response("Invalid request", { status: 400 })
        }
        const conversationId = opaqueId(body.conversationId)
        const claimedProfileId = opaqueId(body.profileId)
        const action = typeof body.action === "string" ? body.action : "request"
        if (!conversationId) return new Response("Invalid request", { status: 400 })

        const include = {
            profile: { include: { user: true } },
            messages: { where: { senderType: "VISITOR" }, orderBy: { createdAt: "desc" as const }, take: 1 },
        }

        let conversation: LiveConversation | null = null

        if (member) {
            conversation = await db.conversation.findFirst({
                where: { id: conversationId, memberId: member.id },
                include,
            })
            if (!conversation) return refusal()
        } else {
            const cookies = parseCookies(req.headers.get("cookie"))
            const visitorId = opaqueId(cookies.get(VISITOR_COOKIE))
            const secret = capabilitySecret()
            const token = claimedProfileId
                ? cookies.get(conversationCapabilityCookieName(claimedProfileId)) || ""
                : ""
            if (!claimedProfileId || !visitorId || !secret || !verifyConversationCapability({
                token,
                conversationId,
                profileId: claimedProfileId,
                visitorId,
                secret,
                nowMs: now(),
            })) {
                return refusal()
            }
            conversation = await db.conversation.findFirst({
                where: {
                    id: conversationId,
                    profileId: claimedProfileId,
                    visitorId,
                    memberId: null,
                },
                include,
            })
            if (!conversation) return refusal()
        }

        if (!conversation.profile.liveChatEnabled) {
            return Response.json({ error: "Live chat is off" }, { status: 400 })
        }

        const ownedWhere = member
            ? { id: conversationId, profileId: conversation.profileId, memberId: member.id }
            : { id: conversationId, profileId: conversation.profileId, visitorId: conversation.visitorId, memberId: null }

        if (action === "cancel" || action === "end") {
            if (member) {
                const memberOwnership = createOwnershipFoundation({
                    resolve: async () => ({ id: member.id, profiles: [{ id: conversation.profileId }] }),
                })
                const write = await memberOwnership.executeOwnedResourceWrite({
                    resourceId: conversationId,
                    claimedProfileId: conversation.profileId,
                    writeOwned: async ({ resourceId, profile, actor }) => {
                        const result = await db.conversation.updateMany({
                            where: { id: resourceId, profileId: profile.id, memberId: actor.userId },
                            data: { mode: "AI", liveRespondedAt: new Date(now()) },
                        })
                        return result.count === 1 ? { mode: "AI" as const } : null
                    },
                })
                if (!write.ok) return ownershipRefusalResponse(write.refusal)
                return Response.json({ ok: true, mode: write.value.result.mode })
            }
            const result = await db.conversation.updateMany({
                where: ownedWhere,
                data: { mode: "AI", liveRespondedAt: new Date(now()) },
            })
            if (result.count !== 1) return refusal()
            return Response.json({ ok: true, mode: "AI" as const })
        }

        if (conversation.mode === "LIVE" || conversation.mode === "LIVE_REQUESTED") {
            return Response.json({ ok: true, mode: conversation.mode })
        }

        const recent = conversation.liveRequestedAt
            && now() - conversation.liveRequestedAt.getTime() < 30 * 60 * 1000
            && conversation.liveRespondedAt
        if (recent && conversation.mode === "AI") {
            return Response.json({ error: "Wait a bit before requesting again" }, { status: 429 })
        }

        const requestedAt = new Date(now())
        const who = visitorNameOf(conversation, member)
        const preview = conversation.messages[0]?.text || "Live chat request"

        if (member) {
            const memberOwnership = createOwnershipFoundation({
                resolve: async () => ({ id: member.id, profiles: [{ id: conversation.profileId }] }),
            })
            const write = await memberOwnership.executeOwnedResourceWrite({
                resourceId: conversationId,
                claimedProfileId: conversation.profileId,
                writeOwned: async ({ resourceId, profile, actor }) => {
                    const result = await db.conversation.updateMany({
                        where: {
                            id: resourceId,
                            profileId: profile.id,
                            memberId: actor.userId,
                            mode: "AI",
                        },
                        data: {
                            mode: "LIVE_REQUESTED",
                            liveRequestedAt: requestedAt,
                            memberId: actor.userId,
                            visitorName: member.name || conversation.visitorName,
                            visitorEmail: member.email,
                        },
                    })
                    return result.count === 1 ? { mode: "LIVE_REQUESTED" as const } : null
                },
            })
            if (!write.ok) return ownershipRefusalResponse(write.refusal)
        } else {
            const result = await db.conversation.updateMany({
                where: { ...ownedWhere, mode: "AI" },
                data: {
                    mode: "LIVE_REQUESTED",
                    liveRequestedAt: requestedAt,
                    visitorName: conversation.visitorName || "Visitor",
                },
            })
            if (result.count !== 1) return refusal()
        }

        const forwardedHost = req.headers.get("x-forwarded-host")
        const origin = forwardedHost
            ? `${req.headers.get("x-forwarded-proto") || "https"}://${forwardedHost}`
            : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
        const href = `${origin}/dashboard/inbox?c=${conversation.id}`

        await createNotification({
            userId: conversation.profile.userId,
            type: "LIVE_REQUEST",
            title: `${who} wants to talk live`,
            body: preview,
            href: `/dashboard/inbox?c=${conversation.id}`,
        })

        await notifyOwner({
            creatorEmail: conversation.profile.user.email,
            creatorName: conversation.profile.displayName,
            visitorName: who,
            href,
            preview,
        }).catch(() => {})

        return Response.json({ ok: true, mode: "LIVE_REQUESTED" as const })
    }
}

export const POST = createLivePostHandler()
