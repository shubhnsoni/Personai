import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { findHotelRoom } from "@/lib/hotels/store"
import { PublicProfileScreen } from "../../public-profile-screen"

export const dynamic = "force-dynamic"

export default async function HotelRoomPage({ params }: { params: Promise<{ slug: string; roomNumber: string }> }) {
    const { slug, roomNumber } = await params
    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, roleTemplate: true, isPublic: true } })
    if (!profile || !profile.isPublic || !isHotelRole(profile.roleTemplate)) notFound()
    const room = await findHotelRoom(profile.id, decodeURIComponent(roomNumber))
    if (!room || !room.isActive) notFound()
    await prisma.hotelQr.updateMany({
        where: { profileId: profile.id, roomId: room.id, kind: "ROOM" },
        data: { scanCount: { increment: 1 } },
    })
    return <PublicProfileScreen slug={slug} hotelRoom={room.number} />
}
