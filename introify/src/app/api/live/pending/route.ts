import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireProfileAccess, ownershipRefusalResponse } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function GET() {
    const access = await requireProfileAccess({ permission: "inbox.write" })
    if (!access.ok) return ownershipRefusalResponse(access.refusal)
    const { profile } = access.value

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
