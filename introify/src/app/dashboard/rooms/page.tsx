import { prisma } from "@/lib/prisma"
import { ensureHotelProperty } from "@/lib/hotels/store"
import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelRoomsStudio } from "@/components/dashboard/hotel-rooms-studio"

export const dynamic = "force-dynamic"

export default async function HotelRoomsPage() {
    const { profile } = await requireHotelPage("rooms")
    await ensureHotelProperty(profile.id)
    const rooms = await prisma.hotelRoom.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    })
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Rooms" hint="Room numbers become /{slug}/r/{number} with a stored QR." />
            <HotelRoomsStudio
                slug={profile.slug}
                rooms={rooms.map((row) => ({ id: row.id, number: row.number, floor: row.floor, category: row.category, isActive: row.isActive }))}
            />
        </div>
    )
}
