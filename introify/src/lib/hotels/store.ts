import { prisma } from "@/lib/prisma"
import { resolveKitRole } from "@/lib/role-alias"
import { DEFAULT_HOTEL_SERVICES, defaultHotelExperiences, defaultSpaCatalogue, defaultTransportOptions } from "./catalogue"
import { departmentForType, type HotelRequestItem, type HotelRequestType } from "./requests"
import { hotelStayPhase, type HotelStayPhase } from "./stay"
import { hotelQrTargetPath } from "./paths"
import { generateHotelQrCode, generateStayToken } from "./qr-code"
import { normalizeRoomNumber } from "./rooms"

export type HotelGuestContext = {
    profileId: string
    slug: string
    displayName: string
    roleTemplate: string
    wifiName: string | null
    wifiPassword: string | null
    checkInTime: string
    checkOutTime: string
    roomNumber: string | null
    roomId: string | null
    stayToken: string | null
    stayId: string | null
    guestName: string | null
    restaurants: { id: string; name: string; slug: string }[]
    amenities: string[]
    services: string[]
    emergencyContact: string | null
    locality: string | null
    stayPhase: HotelStayPhase | null
    spa: { sku: string; label: string; durationMinutes: number }[]
    transport: { sku: string; label: string }[]
    experiences: { sku: string; label: string; summary: string }[]
}

function parseJsonArray(raw: string | null | undefined): string[] {
    try {
        const value = JSON.parse(raw || "[]")
        return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
    } catch {
        return []
    }
}

export async function ensureHotelProperty(profileId: string, seed?: {
    checkInTime?: string
    checkOutTime?: string
    wifiName?: string
    wifiPassword?: string
    roomCount?: number
    services?: string[]
    address?: string
    emergencyContact?: string
    receptionWhatsapp?: string
    timezone?: string
}) {
    const existing = await prisma.hotelProperty.findUnique({ where: { profileId } })
    if (existing) return existing
    return prisma.hotelProperty.create({
        data: {
            profileId,
            checkInTime: seed?.checkInTime || "14:00",
            checkOutTime: seed?.checkOutTime || "11:00",
            wifiName: seed?.wifiName || null,
            wifiPassword: seed?.wifiPassword || null,
            roomCount: seed?.roomCount || null,
            servicesJson: JSON.stringify(seed?.services?.length ? seed.services : [...DEFAULT_HOTEL_SERVICES]),
            address: seed?.address || null,
            emergencyContact: seed?.emergencyContact || null,
            receptionWhatsapp: seed?.receptionWhatsapp || null,
            timezone: seed?.timezone || null,
        },
    })
}

export async function saveHotelProperty(profileId: string, patch: {
    address?: string | null
    receptionPhone?: string | null
    receptionWhatsapp?: string | null
    checkInTime?: string
    checkOutTime?: string
    wifiName?: string | null
    wifiPassword?: string | null
    roomCount?: number | null
    policiesSummary?: string | null
    amenitiesJson?: string
    emergencyContact?: string | null
    servicesJson?: string
    timezone?: string | null
}) {
    await ensureHotelProperty(profileId)
    return prisma.hotelProperty.update({
        where: { profileId },
        data: patch,
    })
}

export async function findHotelRoom(profileId: string, roomNumber: string) {
    const number = normalizeRoomNumber(roomNumber)
    if (!number) return null
    return prisma.hotelRoom.findUnique({
        where: { profileId_number: { profileId, number } },
    })
}

export async function addHotelRooms(profileId: string, numbers: string[], extras?: { floor?: string; category?: string }) {
    const last = await prisma.hotelRoom.findFirst({
        where: { profileId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
    })
    let sort = last?.sortOrder || 0
    const created: Array<{ id: string; number: string }> = []
    for (const raw of numbers) {
        const number = normalizeRoomNumber(raw)
        if (!number) continue
        sort += 1
        const row = await prisma.hotelRoom.upsert({
            where: { profileId_number: { profileId, number } },
            update: { isActive: true, floor: extras?.floor, category: extras?.category },
            create: {
                profileId,
                number,
                floor: extras?.floor || null,
                category: extras?.category || null,
                sortOrder: sort,
            },
        })
        created.push(row)
    }
    await ensureRoomQrs(profileId, created.map((row) => row.id))
    const count = await prisma.hotelRoom.count({ where: { profileId, isActive: true } })
    await prisma.hotelProperty.updateMany({ where: { profileId }, data: { roomCount: count } })
    return created
}

export async function setHotelRoomActive(profileId: string, roomId: string, isActive: boolean) {
    await prisma.hotelRoom.updateMany({ where: { id: roomId, profileId }, data: { isActive } })
}

export async function ensurePropertyQr(profileId: string, label = "Property") {
    const existing = await prisma.hotelQr.findFirst({
        where: { profileId, kind: "PROPERTY" },
    })
    if (existing) return existing
    return prisma.hotelQr.create({
        data: {
            profileId,
            code: generateHotelQrCode(),
            kind: "PROPERTY",
            targetType: "PROPERTY",
            label,
        },
    })
}

export async function ensureRoomQrs(profileId: string, roomIds: string[]) {
    for (const roomId of roomIds) {
        const existing = await prisma.hotelQr.findFirst({ where: { profileId, roomId, kind: "ROOM" } })
        if (existing) continue
        const room = await prisma.hotelRoom.findFirst({ where: { id: roomId, profileId } })
        if (!room) continue
        await prisma.hotelQr.create({
            data: {
                profileId,
                code: generateHotelQrCode(),
                kind: "ROOM",
                targetType: "ROOM",
                targetId: room.id,
                roomId: room.id,
                label: `Room ${room.number}`,
            },
        })
    }
}

export async function resolveHotelQr(code: string) {
    const qr = await prisma.hotelQr.findUnique({
        where: { code },
        include: {
            profile: { select: { slug: true, roleTemplate: true, isPublic: true } },
            room: { select: { number: true } },
            stay: { select: { token: true } },
        },
    })
    if (!qr || !qr.profile.isPublic) return null
    await prisma.hotelQr.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 } } })
    return {
        path: hotelQrTargetPath({
            kind: qr.kind,
            slug: qr.profile.slug,
            roomNumber: qr.room?.number,
            stayToken: qr.stay?.token,
        }),
        qr,
    }
}

export async function connectRestaurant(hotelProfileId: string, restaurantProfileId: string, label?: string) {
    const restaurant = await prisma.profile.findUnique({
        where: { id: restaurantProfileId },
        select: { id: true, displayName: true, roleTemplate: true, slug: true, isPublic: true },
    })
    if (!restaurant || resolveKitRole(restaurant.roleTemplate) !== "RESTAURANT") {
        throw new Error("Connect an Introify restaurant, not a new menu.")
    }
    return prisma.hotelRestaurantLink.upsert({
        where: { hotelProfileId_restaurantProfileId: { hotelProfileId, restaurantProfileId } },
        update: { label: label || restaurant.displayName },
        create: {
            hotelProfileId,
            restaurantProfileId,
            label: label || restaurant.displayName,
        },
    })
}

export async function connectRestaurantBySlug(hotelProfileId: string, slug: string) {
    const restaurant = await prisma.profile.findUnique({
        where: { slug: slug.trim().toLowerCase() },
        select: { id: true, roleTemplate: true },
    })
    if (!restaurant) throw new Error("No public page with that username.")
    return connectRestaurant(hotelProfileId, restaurant.id)
}

export async function disconnectRestaurant(hotelProfileId: string, restaurantProfileId: string) {
    await prisma.hotelRestaurantLink.deleteMany({
        where: { hotelProfileId, restaurantProfileId },
    })
}

export async function listLinkedRestaurants(hotelProfileId: string) {
    const links = await prisma.hotelRestaurantLink.findMany({
        where: { hotelProfileId },
        include: { restaurantProfile: { select: { id: true, displayName: true, slug: true, headline: true, isPublic: true } } },
        orderBy: { createdAt: "asc" },
    })
    return links.map((link) => ({
        id: link.id,
        restaurantProfileId: link.restaurantProfileId,
        name: link.restaurantProfile.displayName,
        slug: link.restaurantProfile.slug,
        headline: link.restaurantProfile.headline,
        isPublic: link.restaurantProfile.isPublic,
        label: link.label,
    }))
}

export async function createHotelRequest(input: {
    profileId: string
    type: HotelRequestType
    items?: HotelRequestItem[]
    roomId?: string | null
    stayId?: string | null
    conversationId?: string | null
    guestName?: string | null
    notes?: string | null
    priority?: string
}) {
    return prisma.hotelRequest.create({
        data: {
            profileId: input.profileId,
            type: input.type,
            itemsJson: JSON.stringify(input.items || []),
            roomId: input.roomId || null,
            stayId: input.stayId || null,
            conversationId: input.conversationId || null,
            guestName: input.guestName || null,
            notes: input.notes || null,
            department: departmentForType(input.type),
            priority: input.priority || "NORMAL",
            status: "REQUESTED",
        },
        include: { room: { select: { number: true } } },
    })
}

export async function advanceHotelRequest(profileId: string, requestId: string, status: string) {
    const allowed = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "ON_THE_WAY", "COMPLETE"]
    if (!allowed.includes(status)) throw new Error("Unknown request status.")
    await prisma.hotelRequest.updateMany({
        where: { id: requestId, profileId },
        data: { status },
    })
}

export async function loadHotelGuestContext(profileId: string, roomNumber?: string | null, stayToken?: string | null): Promise<HotelGuestContext | null> {
    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true, slug: true, displayName: true, roleTemplate: true },
    })
    if (!profile) return null
    const property = await ensureHotelProperty(profileId)
    const restaurants = await listLinkedRestaurants(profileId)
    let room = roomNumber ? await findHotelRoom(profileId, roomNumber) : null
    let stay = stayToken
        ? await prisma.hotelStay.findUnique({ where: { token: stayToken }, include: { room: true } })
        : null
    if (stay && stay.profileId !== profileId) stay = null
    if (stay?.room && !room) room = stay.room
    return {
        profileId: profile.id,
        slug: profile.slug,
        displayName: profile.displayName,
        roleTemplate: profile.roleTemplate,
        wifiName: property.wifiName,
        wifiPassword: property.wifiPassword,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        roomNumber: room?.number || null,
        roomId: room?.id || null,
        stayToken: stay?.token || null,
        stayId: stay?.id || null,
        guestName: stay?.guestName || null,
        restaurants: restaurants.map((row) => ({ id: row.restaurantProfileId, name: row.name, slug: row.slug })),
        amenities: parseJsonArray(property.amenitiesJson),
        services: parseJsonArray(property.servicesJson),
        emergencyContact: property.emergencyContact,
        locality: localityFromAddress(property.address),
        stayPhase: hotelStayPhase({ arrival: stay?.arrival, departure: stay?.departure }),
        spa: defaultSpaCatalogue(),
        transport: defaultTransportOptions(),
        experiences: defaultHotelExperiences(),
    }
}

function localityFromAddress(address?: string | null) {
    if (!address) return null
    if (/\bRanchi\b/i.test(address)) return "Ranchi"
    return null
}

export async function createHotelStay(profileId: string, input: { guestName?: string; roomId?: string; arrival?: Date; departure?: Date }) {
    return prisma.hotelStay.create({
        data: {
            profileId,
            token: generateStayToken(),
            guestName: input.guestName || null,
            roomId: input.roomId || null,
            arrival: input.arrival || null,
            departure: input.departure || null,
        },
    })
}

export async function seedHotelStayDemo(profileId: string) {
    await ensureHotelProperty(profileId, {
        wifiName: "haven-guest",
        wifiPassword: "haven-hinoo",
        services: [...DEFAULT_HOTEL_SERVICES],
        checkInTime: "14:00",
        checkOutTime: "11:00",
    })
    const rooms = await addHotelRooms(profileId, ["101", "102", "103"], { floor: "1", category: "Deluxe" })
    await ensurePropertyQr(profileId)
    if (rooms[0]) {
        await createHotelStay(profileId, { guestName: "Walk-in guest", roomId: rooms[0].id })
    }
    return rooms
}
