import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelRequestsBoard } from "@/components/dashboard/hotel-requests-board"

export const dynamic = "force-dynamic"

export default async function HotelRequestsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    if (!isHotelRole(profile.roleTemplate)) redirect("/dashboard")

    const rows = await prisma.hotelRequest.findMany({
        where: { profileId: profile.id },
        include: { room: { select: { number: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
    })

    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Requests" hint="Accept, then On the way or Scheduled, then Done. Spa, transport, and experiences arrive from guest chat as requests — never as charges." />
            <HotelRequestsBoard
                rows={rows.map((row) => ({
                    id: row.id,
                    type: row.type,
                    status: row.status,
                    department: row.department,
                    itemsJson: row.itemsJson,
                    guestName: row.guestName,
                    notes: row.notes,
                    createdAt: row.createdAt.toISOString(),
                    room: row.room,
                }))}
            />
        </div>
    )
}
