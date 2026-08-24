import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { getMemberFromSession } from "@/lib/members"

export const dynamic = "force-dynamic"

const VISITOR_COOKIE = "pl_vid"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function clientIp(req: NextRequest): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown"
}

function withVisitorCookie(res: NextResponse, visitorId: string, setCookie: boolean): NextResponse {
    if (setCookie) {
        res.cookies.set(VISITOR_COOKIE, visitorId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: COOKIE_MAX_AGE,
        })
    }
    return res
}

export async function GET(req: NextRequest) {
    const { allowed } = checkRateLimit(clientIp(req))
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const existingCookie = req.cookies.get(VISITOR_COOKIE)?.value
    const visitorId = existingCookie || crypto.randomUUID()
    const setCookie = !existingCookie
    const { searchParams } = req.nextUrl
    const profileId = searchParams.get("profileId")
    const member = await getMemberFromSession().catch(() => null)

    if (!profileId) {
        return withVisitorCookie(
            NextResponse.json({ messages: [], conversationId: null, visitorId, mode: "AI" }),
            visitorId,
            setCookie,
        )
    }

    const conversation = await prisma.conversation.findFirst({
        where: {
            profileId,
            OR: [
                { visitorId },
                ...(member?.id ? [{ memberId: member.id }] : []),
                ...(member?.email ? [{ visitorEmail: member.email }] : []),
            ],
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
            profile: { select: { liveChatEnabled: true, liveChatSlaMinutes: true, displayName: true } },
            messages: { orderBy: { createdAt: "asc" }, take: 80 },
        },
    })

    if (!conversation) {
        const profile = await prisma.profile.findUnique({
            where: { id: profileId },
            select: { liveChatEnabled: true, liveChatSlaMinutes: true },
        })
        return withVisitorCookie(
            NextResponse.json({
                messages: [],
                conversationId: null,
                visitorId,
                mode: "AI",
                liveChatEnabled: Boolean(profile?.liveChatEnabled),
                isMember: Boolean(member),
                slaMinutes: profile?.liveChatSlaMinutes || 10,
            }),
            visitorId,
            setCookie,
        )
    }

    if (conversation.mode === "LIVE_REQUESTED" && conversation.liveRequestedAt) {
        const age = Date.now() - conversation.liveRequestedAt.getTime()
        const sla = (conversation.profile.liveChatSlaMinutes || 10) * 60 * 1000
        if (age > sla) {
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { mode: "AI", liveRespondedAt: new Date() },
            })
            conversation.mode = "AI"
        }
    }

    const waitingAhead = conversation.mode === "LIVE_REQUESTED"
        ? await prisma.conversation.count({
            where: {
                profileId,
                mode: { in: ["LIVE_REQUESTED", "LIVE"] },
                liveRequestedAt: { lt: conversation.liveRequestedAt || new Date() },
            },
        })
        : 0

    return withVisitorCookie(
        NextResponse.json({
            conversationId: conversation.id,
            visitorId,
            mode: conversation.mode,
            liveRequestedAt: conversation.liveRequestedAt,
            liveChatEnabled: conversation.profile.liveChatEnabled,
            isMember: Boolean(member),
            slaMinutes: conversation.profile.liveChatSlaMinutes || 10,
            queuePosition: waitingAhead + 1,
            messages: conversation.messages.map((m) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.text,
                senderType: m.senderType,
            })),
        }),
        visitorId,
        setCookie,
    )
}
