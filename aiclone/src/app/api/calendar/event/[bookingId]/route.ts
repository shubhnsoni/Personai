import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildIcs, icsResponse } from "@/lib/ics"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
    const { bookingId } = await params
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { serviceOffering: true, profile: true },
    })
    if (!booking || booking.status === "CANCELLED") return new Response("Not found", { status: 404 })

    const ics = buildIcs({
        name: booking.profile.displayName,
        timezone: booking.profile.timezone || "UTC",
        events: [{
            id: booking.id,
            title: `${booking.serviceOffering.name} with ${booking.profile.displayName}`,
            description: `${booking.serviceOffering.name}\n${booking.visitorName}`,
            start: booking.startTime,
            end: booking.endTime,
            status: booking.status,
        }],
    })

    return icsResponse(ics, "booking.ics")
}
