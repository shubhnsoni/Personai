import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildIcs, icsResponse } from "@/lib/ics"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const clean = token.replace(/\.ics$/i, "")
    const rows = await prisma.$queryRaw<Array<{
        id: string
        displayName: string
        timezone: string | null
    }>>`
        SELECT "id", "displayName", "timezone" FROM "Profile" WHERE "calendarToken" = ${clean}
    `
    const profile = rows[0]
    if (!profile) return new Response("Not found", { status: 404 })

    const bookings = await prisma.booking.findMany({
        where: {
            profileId: profile.id,
            status: { not: "CANCELLED" },
            startTime: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
        },
        include: { serviceOffering: true },
        orderBy: { startTime: "asc" },
        take: 400,
    })

    const ics = buildIcs({
        name: `${profile.displayName} · Bookings`,
        timezone: profile.timezone || "UTC",
        events: bookings.map((b) => ({
            id: b.id,
            title: b.visitorEmail === "hold@local"
                ? (b.visitorName || "Blocked")
                : `${b.serviceOffering.name} · ${b.visitorName}`,
            description: b.visitorEmail === "hold@local"
                ? "Blocked on PersonaLink"
                : `${b.visitorName}\n${b.visitorEmail}\n${b.serviceOffering.name}`,
            start: b.startTime,
            end: b.endTime,
            status: b.status,
        })),
    })

    return icsResponse(ics, "personalink.ics")
}
