import { prisma } from "@/lib/prisma"
import { resolveKitRole } from "@/lib/role-alias"
import { DEFAULT_HOTEL_SERVICES, defaultHotelExperiences, defaultSpaCatalogue, defaultTransportOptions } from "./catalogue"
import { departmentForType, type HotelRequestItem, type HotelRequestType } from "./requests"
import { hotelStayPhase, type HotelStayPhase } from "./stay"
import { hotelQrTargetPath } from "./paths"
import { generateHotelQrCode, generateStayToken } from "./qr-code"
import { normalizeRoomNumber } from "./rooms"
import { DEFAULT_HOTEL_KNOWLEDGE, parseHotelMapMarkers, type HotelKnowledgeDoc, type HotelMapMarker } from "./knowledge"
import { parseHotelSlaJson, summarizeHotelAnalytics } from "./analytics"
import { DEFAULT_HOTEL_UPSELLS, parseHotelUpsells } from "./upsells"
import { detectGuestLanguage, staffNoteFromGuest } from "./language"
import { hotelEmailCopy, hotelNotifyPlan } from "./notifications"
import { emailCanSend, sendEmail } from "@/lib/email"

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
    receptionPhone: string | null
    receptionWhatsapp: string | null
    quietHours: string | null
    parkingInfo: string | null
    propertyHours: string | null
    knowledge: HotelKnowledgeDoc[]
    mapMarkers: HotelMapMarker[]
    mapImageUrl: string | null
    upsells: ReturnType<typeof parseHotelUpsells>
    staffLanguage: string
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
    quietHours?: string | null
    parkingInfo?: string | null
    propertyHours?: string | null
    mapImageUrl?: string | null
    mapMarkersJson?: string
    slaJson?: string
    upsellsJson?: string
    staffLanguage?: string
    staffJson?: string
    groupJson?: string
    whiteLabel?: boolean
    webhookUrl?: string | null
    integrationsJson?: string
}) {
    await ensureHotelProperty(profileId)
    return prisma.hotelProperty.update({
        where: { profileId },
        data: {
            ...patch,
            staffLanguage: patch.staffLanguage || undefined,
        },
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
    photoUrl?: string | null
    guestLanguage?: string | null
    staffNotes?: string | null
}) {
    const guestLanguage = input.guestLanguage || (input.notes ? detectGuestLanguage(input.notes) : "en")
    const staffNotes = input.staffNotes || (input.notes
        ? staffNoteFromGuest(input.notes, { kind: input.type.toLowerCase(), sku: input.items?.[0]?.sku }, "en")
        : null)
    const created = await prisma.hotelRequest.create({
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
            priority: input.priority || (input.type === "EMERGENCY" ? "URGENT" : "NORMAL"),
            status: "REQUESTED",
            photoUrl: input.photoUrl || null,
            guestLanguage,
            staffNotes,
        },
        include: { room: { select: { number: true } } },
    })
    const roomBit = created.room?.number ? `Room ${created.room.number}` : "No room"
    const title = input.type === "EMERGENCY" ? `Emergency · ${roomBit}` : `${input.type.replace(/_/g, " ")} · ${roomBit}`
    const body = staffNotes || input.notes || input.type
    const department = created.department || departmentForType(input.type)
    await prisma.hotelStaffNotice.create({
        data: {
            profileId: input.profileId,
            requestId: created.id,
            kind: input.type === "EMERGENCY" ? "EMERGENCY" : "REQUEST",
            title,
            body,
            department,
            channel: "in_app",
        },
    })
    const owner = await prisma.profile.findUnique({
        where: { id: input.profileId },
        select: { displayName: true, user: { select: { email: true } } },
    })
    const plan = hotelNotifyPlan({
        department,
        type: input.type,
        ownerEmail: owner?.user.email,
        emailConfigured: emailCanSend(),
    })
    const emailStep = plan.find((step) => step.channel === "email")
    if (emailStep && !emailStep.stub && emailStep.to) {
        const copy = hotelEmailCopy({ title, body, hotelName: owner?.displayName })
        await sendEmail({ to: emailStep.to, subject: copy.subject, html: `<p>${copy.text.replace(/\n/g, "<br/>")}</p>`, text: copy.text }).catch(() => false)
    }
    return created
}

export async function attachHotelRequestPhoto(profileId: string, requestId: string, photoUrl: string) {
    await prisma.hotelRequest.updateMany({
        where: { id: requestId, profileId },
        data: { photoUrl },
    })
}

export async function listHotelKnowledge(profileId: string) {
    return prisma.hotelKnowledge.findMany({
        where: { profileId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
}

export async function upsertHotelKnowledge(profileId: string, docs: HotelKnowledgeDoc[]) {
    const existing = await prisma.hotelKnowledge.findMany({ where: { profileId }, select: { id: true, bucket: true } })
    let sort = 0
    for (const doc of docs) {
        sort += 1
        const row = existing.find((item) => item.bucket === doc.bucket)
        if (row) {
            await prisma.hotelKnowledge.update({
                where: { id: row.id },
                data: { title: doc.title, body: doc.body, guestVisible: doc.guestVisible, sortOrder: sort },
            })
        } else {
            await prisma.hotelKnowledge.create({
                data: {
                    profileId,
                    bucket: doc.bucket,
                    title: doc.title,
                    body: doc.body,
                    guestVisible: doc.guestVisible,
                    sortOrder: sort,
                },
            })
        }
    }
}

export async function saveHotelKnowledgeRow(profileId: string, input: {
    id?: string
    bucket: string
    title: string
    body: string
    guestVisible: boolean
}) {
    if (input.id) {
        await prisma.hotelKnowledge.updateMany({
            where: { id: input.id, profileId },
            data: { bucket: input.bucket, title: input.title, body: input.body, guestVisible: input.guestVisible },
        })
        return
    }
    const last = await prisma.hotelKnowledge.findFirst({ where: { profileId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
    await prisma.hotelKnowledge.create({
        data: {
            profileId,
            bucket: input.bucket,
            title: input.title,
            body: input.body,
            guestVisible: input.guestVisible,
            sortOrder: (last?.sortOrder || 0) + 1,
        },
    })
}

export async function deleteHotelKnowledgeRow(profileId: string, id: string) {
    await prisma.hotelKnowledge.deleteMany({ where: { id, profileId } })
}

export async function listHotelNotices(profileId: string, take = 20) {
    return prisma.hotelStaffNotice.findMany({
        where: { profileId },
        orderBy: { createdAt: "desc" },
        take,
    })
}

export async function markHotelNoticeRead(profileId: string, id: string) {
    await prisma.hotelStaffNotice.updateMany({
        where: { id, profileId, readAt: null },
        data: { readAt: new Date() },
    })
}

export async function markAllHotelNoticesRead(profileId: string) {
    await prisma.hotelStaffNotice.updateMany({
        where: { profileId, readAt: null },
        data: { readAt: new Date() },
    })
}

export async function loadHotelAnalytics(profileId: string) {
    const [requests, qrs, messages, property] = await Promise.all([
        prisma.hotelRequest.findMany({
            where: { profileId },
            select: { type: true, department: true, status: true, createdAt: true, updatedAt: true },
        }),
        prisma.hotelQr.findMany({
            where: { profileId },
            select: { code: true, label: true, kind: true, scanCount: true },
        }),
        prisma.message.findMany({
            where: { conversation: { profileId }, senderType: "VISITOR" },
            select: { text: true },
            orderBy: { createdAt: "desc" },
            take: 200,
        }),
        prisma.hotelProperty.findUnique({ where: { profileId }, select: { slaJson: true } }),
    ])
    return summarizeHotelAnalytics({
        now: new Date(),
        requests,
        qrs,
        questions: messages.map((row) => row.text).filter((text) => text.includes("?")),
        sla: parseHotelSlaJson(property?.slaJson),
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
    const knowledgeRows = await prisma.hotelKnowledge.findMany({
        where: { profileId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    let room = roomNumber ? await findHotelRoom(profileId, roomNumber) : null
    let stay = stayToken
        ? await prisma.hotelStay.findUnique({ where: { token: stayToken }, include: { room: true } })
        : null
    if (stay && stay.profileId !== profileId) stay = null
    if (stay?.room && !room) room = stay.room
    const knowledge: HotelKnowledgeDoc[] = knowledgeRows.map((row) => {
        const seeded = DEFAULT_HOTEL_KNOWLEDGE.find((item) => item.bucket === row.bucket)
        return {
            bucket: row.bucket as HotelKnowledgeDoc["bucket"],
            title: row.title,
            body: row.body,
            guestVisible: row.guestVisible,
            aliases: seeded?.aliases || [row.title, row.bucket.toLowerCase()],
        }
    })
    const mapMarkers = parseHotelMapMarkers(property.mapMarkersJson)
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
        receptionPhone: property.receptionPhone,
        receptionWhatsapp: property.receptionWhatsapp,
        quietHours: property.quietHours,
        parkingInfo: property.parkingInfo,
        propertyHours: property.propertyHours,
        knowledge,
        mapMarkers,
        mapImageUrl: property.mapImageUrl,
        upsells: parseHotelUpsells(property.upsellsJson),
        staffLanguage: property.staffLanguage || "en",
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
