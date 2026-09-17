import { prisma } from "@/lib/prisma"
import { hotelDesksForRole } from "@/lib/hotels"
import { parseHotelSlaJson } from "@/lib/hotels/analytics"
import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelRequestsBoard } from "@/components/dashboard/hotel-requests-board"

export const dynamic = "force-dynamic"

export default async function HotelRequestsPage() {
    const { profile, staffRole, property } = await requireHotelPage("requests")
    const desks = hotelDesksForRole(staffRole)
    const rows = await prisma.hotelRequest.findMany({
        where: {
            profileId: profile.id,
            ...(desks == null ? {} : desks.length ? { department: { in: [...desks] } } : { id: "__none__" }),
        },
        include: { room: { select: { number: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
    })

    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Requests" hint="Accept, then On the way or Scheduled, then Done. Emergencies are call-first alerts. Approaching SLA is a badge, not a pager." />
            <HotelRequestsBoard
                sla={parseHotelSlaJson(property?.slaJson)}
                lockedDesk={desks && desks.length === 1 ? desks[0] : null}
                rows={rows.map((row) => ({
                    id: row.id,
                    type: row.type,
                    status: row.status,
                    department: row.department,
                    itemsJson: row.itemsJson,
                    guestName: row.guestName,
                    notes: row.notes,
                    staffNotes: row.staffNotes,
                    photoUrl: row.photoUrl,
                    priority: row.priority,
                    createdAt: row.createdAt.toISOString(),
                    room: row.room,
                }))}
            />
        </div>
    )
}
