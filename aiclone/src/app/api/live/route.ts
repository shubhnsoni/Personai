import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getMemberFromSession } from "@/lib/members"
import { checkRateLimit } from "@/lib/rate-limit"
import { createNotification } from "@/lib/notifications"
import { notifyOwnerLive } from "@/app/actions/inbox"
import { createOwnershipFoundation, ownershipRefusalResponse } from "@/lib/security"

export const dynamic = "force-dynamic"

const CONVERSATION_FORBIDDEN = Object.freeze({
    code: "FORBIDDEN" as const,
    status: 403 as const,
    message: "Access denied",
})

type ConversationDb = Prisma.TransactionClient
type MemberIdentity = Awaited<ReturnType<typeof getMemberFromSession>>

type LiveRouteDependencies = Readonly<{
    db: ConversationDb
    resolveMember: () => Promise<MemberIdentity>
    rateLimit: typeof checkRateLimit
    createNotification: typeof createNotification
    notifyOwner: typeof notifyOwnerLive
    now: () => number
}>

const productionDependencies: LiveRouteDependencies = {
    db: prisma as unknown as ConversationDb,
    resolveMember: getMemberFromSession,
    rateLimit: checkRateLimit,
    createNotification,
    notifyOwner: notifyOwnerLive,
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

export function createLivePostHandler(overrides: Partial<LiveRouteDependencies> = {}) {
    const dependencies: LiveRouteDependencies = { ...productionDependencies, ...overrides }

    return async function handleLivePost(req: Request): Promise<Response> {
        const { db, resolveMember, rateLimit, createNotification, notifyOwner, now } = dependencies
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
        const { allowed } = rateLimit(ip)
        if (!allowed) return Response.json({ error: "Too many requests" }, { status: 429 })

        const member = await resolveMember().catch(() => null)
        if (!member) return refusal()

        let body: { conversationId?: unknown; action?: unknown }
        try {
            body = await req.json()
        } catch {
            return new Response("Invalid request", { status: 400 })
        }
        const conversationId = opaqueId(body.conversationId)
        const action = typeof body.action === "string" ? body.action : "request"
        if (!conversationId) return new Response("Invalid request", { status: 400 })

        const conversation = await db.conversation.findFirst({
            where: { id: conversationId, memberId: member.id },
            include: {
                profile: { include: { user: true } },
                messages: { orderBy: { createdAt: "desc" }, take: 1 },
            },
        })
        if (!conversation) return refusal()

        const memberOwnership = createOwnershipFoundation({
            resolve: async () => ({ id: member.id, profiles: [{ id: conversation.profileId }] }),
        })

        if (!conversation.profile.liveChatEnabled) {
            return Response.json({ error: "Live chat is off" }, { status: 400 })
        }

        if (action === "cancel" || action === "end") {
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

        const forwardedHost = req.headers.get("x-forwarded-host")
        const origin = forwardedHost
            ? `${req.headers.get("x-forwarded-proto") || "https"}://${forwardedHost}`
            : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
        const href = `${origin}/dashboard/inbox?c=${conversation.id}`

        await createNotification({
            userId: conversation.profile.userId,
            type: "LIVE_REQUEST",
            title: `${member.name || member.email} wants to talk live`,
            body: conversation.messages[0]?.text || "Live chat request",
            href: `/dashboard/inbox?c=${conversation.id}`,
        })

        await notifyOwner({
            creatorEmail: conversation.profile.user.email,
            creatorName: conversation.profile.displayName,
            visitorName: member.name || member.email,
            href,
            preview: conversation.messages[0]?.text,
        }).catch(() => {})

        return Response.json({ ok: true, mode: write.value.result.mode })
    }
}

export const POST = createLivePostHandler()
