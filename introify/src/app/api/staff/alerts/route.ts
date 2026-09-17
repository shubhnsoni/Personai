import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { requireProfileAccess, ownershipRefusalResponse } from "@/lib/security"
import { canAccessProfile } from "@/lib/workspace-access"
import { isHotelRole } from "@/lib/hotels"
import { loadHotelStaffRole } from "@/lib/hotels/desk-access"
import { staffAlertsFromFeeds, staffInboxAllowed } from "@/lib/staff-browser-alerts"

export const dynamic = "force-dynamic"

export async function GET() {
    const access = await requireProfileAccess({ permission: "read" })
    if (!access.ok) return ownershipRefusalResponse(access.refusal)
    const { profile, actor } = access.value
    const user = await syncUser()
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const workspace = user.profileAccess[profile.id]
    let hotelRole: import("@/lib/hotels").HotelStaffRole | null = null
    if (isHotelRole(profile.roleTemplate)) {
        const property = await prisma.hotelProperty.findUnique({
            where: { profileId: profile.id },
            select: { staffJson: true },
        })
        hotelRole = await loadHotelStaffRole({
            userId: user.id,
            profileId: profile.id,
            profileUserId: profile.userId,
            workspaceRole: workspace?.role,
            owner: workspace?.owner,
            staffJson: property?.staffJson,
        })
    }
    const canInbox = staffInboxAllowed(hotelRole, canAccessProfile(workspace, "inbox.write"))

    const [liveRows, notices, inboxNotifications] = await Promise.all([
        canInbox
            ? prisma.conversation.findMany({
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
            : Promise.resolve([]),
        hotelRole
            ? prisma.hotelStaffNotice.findMany({
                where: { profileId: profile.id, readAt: null },
                orderBy: { createdAt: "desc" },
                take: 24,
                select: { id: true, kind: true, title: true, body: true, department: true, readAt: true, createdAt: true, requestId: true },
            })
            : Promise.resolve([]),
        prisma.notification.findMany({
            where: {
                userId: actor.userId,
                readAt: null,
                type: { in: ["LIVE_REQUEST", "HOTEL_REQUEST", "HOTEL_EMERGENCY"] },
            },
            orderBy: { createdAt: "desc" },
            take: 16,
            select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
        }),
    ])

    const requestIds = notices.map((row) => row.requestId).filter((id): id is string => Boolean(id))
    const requests = requestIds.length
        ? await prisma.hotelRequest.findMany({
            where: { id: { in: requestIds }, profileId: profile.id },
            select: { id: true, conversationId: true },
        })
        : []
    const conversationByRequest = new Map(requests.map((row) => [row.id, row.conversationId]))

    const alerts = staffAlertsFromFeeds({
        liveRequests: liveRows.map((row) => ({
            id: row.id,
            visitorName: row.visitorName || row.visitorEmail || "A visitor",
            message: row.messages[0]?.text || "Wants to talk live",
            requestedAt: row.liveRequestedAt ? row.liveRequestedAt.toISOString() : null,
        })),
        hotelNotices: notices.map((row) => ({
            id: row.id,
            kind: row.kind,
            title: row.title,
            body: row.body,
            department: row.department,
            readAt: row.readAt ? row.readAt.toISOString() : null,
            createdAt: row.createdAt.toISOString(),
            conversationId: row.requestId ? conversationByRequest.get(row.requestId) || null : null,
        })),
        inboxNotifications: inboxNotifications.map((row) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            body: row.body,
            href: row.href,
            readAt: row.readAt ? row.readAt.toISOString() : null,
            createdAt: row.createdAt.toISOString(),
        })),
        hotelRole,
        canInbox,
    })

    return NextResponse.json({ alerts })
}
