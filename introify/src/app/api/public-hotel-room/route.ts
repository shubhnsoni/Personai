import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { findHotelRoom } from "@/lib/hotels/store"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
    const url = new URL(req.url)
    const slug = url.searchParams.get("slug")?.trim().toLowerCase() || ""
    const room = url.searchParams.get("room")?.trim() || ""
    if (!slug || slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !room || room.length > 32) {
        return NextResponse.json({ exists: false })
    }
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { id: true, isPublic: true, roleTemplate: true },
    })
    if (!profile?.isPublic || !isHotelRole(profile.roleTemplate)) {
        return NextResponse.json({ exists: false })
    }
    const hotelRoom = await findHotelRoom(profile.id, room)
    return NextResponse.json({ exists: Boolean(hotelRoom?.isActive) })
}
