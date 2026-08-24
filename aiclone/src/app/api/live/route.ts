import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMemberFromSession } from "@/lib/members"
import { checkRateLimit } from "@/lib/rate-limit"
import { createNotification } from "@/lib/notifications"
import { notifyOwnerLive } from "@/app/actions/inbox"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const { allowed } = checkRateLimit(ip)
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    const member = await getMemberFromSession()
    if (!member) return NextResponse.json({ error: "Members only" }, { status: 403 })

    const { conversationId, action } = await req.json()
    if (!conversationId) return NextResponse.json({ error: "Missing conversation" }, { status: 400 })

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { profile: { include: { user: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!conversation.profile.liveChatEnabled) {
        return NextResponse.json({ error: "Live chat is off" }, { status: 400 })
    }

    if (action === "cancel" || action === "end") {
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { mode: "AI", liveRespondedAt: new Date() },
        })
        return NextResponse.json({ ok: true, mode: "AI" })
    }

    if (conversation.mode === "LIVE" || conversation.mode === "LIVE_REQUESTED") {
        return NextResponse.json({ ok: true, mode: conversation.mode })
    }

    const recent = conversation.liveRequestedAt
        && Date.now() - conversation.liveRequestedAt.getTime() < 30 * 60 * 1000
        && conversation.liveRespondedAt
    if (recent && conversation.mode === "AI") {
        return NextResponse.json({ error: "Wait a bit before requesting again" }, { status: 429 })
    }

    await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
            mode: "LIVE_REQUESTED",
            liveRequestedAt: new Date(),
            memberId: member.id,
            visitorName: member.name || conversation.visitorName,
            visitorEmail: member.email,
        },
    })

    const origin = req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
        : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    const href = `${origin}/dashboard/inbox?c=${conversation.id}`

    await createNotification({
        userId: conversation.profile.userId,
        type: "LIVE_REQUEST",
        title: `${member.name || member.email} wants to talk live`,
        body: conversation.messages[0]?.text || "Live chat request",
        href: `/dashboard/inbox?c=${conversation.id}`,
    })

    await notifyOwnerLive({
        creatorEmail: conversation.profile.user.email,
        creatorName: conversation.profile.displayName,
        visitorName: member.name || member.email,
        href,
        preview: conversation.messages[0]?.text,
    }).catch(() => {})

    return NextResponse.json({ ok: true, mode: "LIVE_REQUESTED" })
}
