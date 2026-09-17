import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { hotelStayPhase, isHotelRole } from "@/lib/hotels"
import { PublicProfileScreen } from "../../public-profile-screen"

export const dynamic = "force-dynamic"

export default async function HotelStayPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
    const { slug, token } = await params
    const profile = await prisma.profile.findUnique({ where: { slug }, select: { id: true, roleTemplate: true, isPublic: true } })
    if (!profile || !profile.isPublic || !isHotelRole(profile.roleTemplate)) notFound()
    const stay = await prisma.hotelStay.findUnique({
        where: { token },
        include: { room: true },
    })
    if (!stay || stay.profileId !== profile.id) notFound()
    const phase = hotelStayPhase({ arrival: stay.arrival, departure: stay.departure })
    return (
        <PublicProfileScreen
            slug={slug}
            hotelRoom={stay.room?.number}
            stayToken={stay.token}
            stayPhase={phase}
        />
    )
}
