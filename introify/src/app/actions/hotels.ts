"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireProfileAccess, unwrapOwnershipResult } from "@/lib/security"
import { isHotelRole } from "@/lib/hotels"
import { resolveKitRole } from "@/lib/role-alias"
import {
    addHotelRooms,
    advanceHotelRequest,
    connectRestaurant,
    connectRestaurantBySlug,
    createHotelStay,
    disconnectRestaurant,
    ensureHotelProperty,
    ensurePropertyQr,
    ensureRoomQrs,
    findHotelRoom,
    listLinkedRestaurants,
    saveHotelProperty,
    setHotelRoomActive,
} from "@/lib/hotels/store"

async function hotelOwner() {
    const { profile } = unwrapOwnershipResult(await requireProfileAccess({ permission: "operations.write" }))
    if (!isHotelRole(profile.roleTemplate)) throw new Error("This desk is for hotel profiles.")
    await ensureHotelProperty(profile.id, { receptionWhatsapp: profile.whatsapp || undefined, timezone: profile.timezone || undefined })
    return profile
}

function touch() {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/requests")
    revalidatePath("/dashboard/rooms")
    revalidatePath("/dashboard/qr")
    revalidatePath("/dashboard/restaurants")
}

export async function saveHotelSetup(input: {
    address?: string
    receptionPhone?: string
    receptionWhatsapp?: string
    checkInTime?: string
    checkOutTime?: string
    wifiName?: string
    wifiPassword?: string
    roomCount?: number
    policiesSummary?: string
    amenities?: string[]
    emergencyContact?: string
    services?: string[]
}) {
    const profile = await hotelOwner()
    await saveHotelProperty(profile.id, {
        address: input.address?.trim() || null,
        receptionPhone: input.receptionPhone?.trim() || null,
        receptionWhatsapp: input.receptionWhatsapp?.trim() || null,
        checkInTime: input.checkInTime?.trim() || "14:00",
        checkOutTime: input.checkOutTime?.trim() || "11:00",
        wifiName: input.wifiName?.trim() || null,
        wifiPassword: input.wifiPassword?.trim() || null,
        roomCount: input.roomCount && input.roomCount > 0 ? Math.floor(input.roomCount) : null,
        policiesSummary: input.policiesSummary?.trim() || null,
        amenitiesJson: JSON.stringify(input.amenities || []),
        emergencyContact: input.emergencyContact?.trim() || null,
        servicesJson: JSON.stringify(input.services || []),
    })
    if (input.receptionWhatsapp?.trim()) {
        await prisma.profile.update({
            where: { id: profile.id },
            data: { whatsapp: input.receptionWhatsapp.trim() },
        })
    }
    touch()
}

export async function addHotelRoomNumbers(raw: string, floor?: string, category?: string) {
    const profile = await hotelOwner()
    const numbers = raw.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)
    if (!numbers.length) throw new Error("Add at least one room number.")
    const created = await addHotelRooms(profile.id, numbers, { floor, category })
    touch()
    return created.length
}

export async function setHotelRoomLive(roomId: string, isActive: boolean) {
    const profile = await hotelOwner()
    await setHotelRoomActive(profile.id, roomId, isActive)
    touch()
}

export async function generateHotelQrs() {
    const profile = await hotelOwner()
    await ensurePropertyQr(profile.id)
    const rooms = await prisma.hotelRoom.findMany({ where: { profileId: profile.id, isActive: true }, select: { id: true } })
    await ensureRoomQrs(profile.id, rooms.map((row) => row.id))
    touch()
}

export async function listStaffRestaurantChoices() {
    const { profile, actor } = unwrapOwnershipResult(await requireProfileAccess({ permission: "operations.write" }))
    const rows = await prisma.profile.findMany({
        where: { id: { in: actor.profiles.map((item) => item.id) }, NOT: { id: profile.id } },
        select: { id: true, displayName: true, slug: true, roleTemplate: true },
    })
    return rows
        .filter((item) => resolveKitRole(item.roleTemplate) === "RESTAURANT")
        .map((item) => ({ id: item.id, name: item.displayName, slug: item.slug }))
}

export async function connectHotelRestaurant(restaurantProfileId: string) {
    const profile = await hotelOwner()
    await connectRestaurant(profile.id, restaurantProfileId)
    touch()
}

export async function connectHotelRestaurantSlug(slug: string) {
    const profile = await hotelOwner()
    await connectRestaurantBySlug(profile.id, slug)
    touch()
}

export async function removeHotelRestaurant(restaurantProfileId: string) {
    const profile = await hotelOwner()
    await disconnectRestaurant(profile.id, restaurantProfileId)
    touch()
}

export async function setHotelRequestStatus(requestId: string, status: string) {
    const profile = await hotelOwner()
    await advanceHotelRequest(profile.id, requestId, status)
    touch()
}

export async function createStayLink(roomId: string, guestName?: string) {
    const profile = await hotelOwner()
    const room = await findHotelRoom(profile.id, roomId).catch(() => null)
    const byId = await prisma.hotelRoom.findFirst({ where: { id: roomId, profileId: profile.id } })
    const target = byId || room
    if (!target) throw new Error("Unknown room.")
    const stay = await createHotelStay(profile.id, { roomId: target.id, guestName })
    touch()
    return stay.token
}

export async function hotelLinkedRestaurants() {
    const profile = await hotelOwner()
    return listLinkedRestaurants(profile.id)
}
