import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { ensureHotelProperty } from "@/lib/hotels/store"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelRoomsStudio } from "@/components/dashboard/hotel-rooms-studio"

export const dynamic = "force-dynamic"

export default async function HotelRoomsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    if (!isHotelRole(profile.roleTemplate)) redirect("/dashboard")
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
