import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"

export const dynamic = "force-dynamic"

export async function GET() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await prisma.conversation.findMany({
        where: { profileId: profile.id, mode: "LIVE_REQUESTED" },
        orderBy: { liveRequestedAt: "asc" },
        take: 8,
        select: {
            id: true,
            visitorName: true,
            visitorEmail: true,
            liveRequestedAt: true,
            messages: {
                where: { senderType: "VISITOR" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { text: true },
            },
        },
    })

    return NextResponse.json({
        requests: rows.map((row) => ({
            id: row.id,
            visitorName: row.visitorName || row.visitorEmail || "A visitor",
            message: row.messages[0]?.text || "Wants to talk live",
            requestedAt: row.liveRequestedAt,
        })),
    })
}
