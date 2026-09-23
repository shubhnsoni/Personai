import type { PrismaClient } from "@prisma/client"
import { resolveKitRole } from "@/lib/role-alias"
import { generateHotelQrCode } from "./qr-code"
import { HAVEN_HOTEL } from "@/lib/demo-shops/stay"
import {
    hotelImageryBackfillPatch,
    HAVEN_HONEST_IMAGE_URL,
    HAVEN_HONEST_LOGO_URL,
} from "./hotel-imagery"
import { DEFAULT_HOTEL_KNOWLEDGE, DEFAULT_HOTEL_MAP_MARKERS, HOTEL_KNOWLEDGE_BUCKETS } from "./knowledge"
import { DEFAULT_HOTEL_SLA_MINUTES } from "./analytics"
import { DEFAULT_HOTEL_UPSELLS } from "./upsells"
import { HOTEL_STAFF_ROLES } from "./staff"

export const TRY_HOTEL = {
    slug: "try-hotel",
    clerkId: "mock-clerk-id-try-hotel",
    email: "try-hotel@introify.com",
    displayName: "Haven Hinoo",
    headline: HAVEN_HOTEL.headline,
    bio: HAVEN_HOTEL.bio,
    welcome: HAVEN_HOTEL.welcome,
    /** E.164 digits — same fixture as hotelProperty.receptionWhatsapp / book smoke. */
    whatsapp: HAVEN_HOTEL.whatsapp,
    rooms: ["101", "102", "103"] as const,
    restaurantSlugs: ["littlehours", "try-restaurant"] as const,
    wifiName: "haven-guest",
    wifiPassword: "haven-hinoo",
    themeColor: "#00D7FF",
    imageUrl: HAVEN_HOTEL.imageUrl,
    shopLogoUrl: HAVEN_HOTEL.shopLogoUrl,
    customInstructions: HAVEN_HOTEL.customInstructions,
}

export const TRY_HOTEL_S3 = {
    stayToken: "haven-demo",
    guestName: "Priya",
    locality: "Ranchi",
    services: ["restaurant", "housekeeping", "concierge", "spa", "transport", "airportTransfer", "activities"] as const,
}

export const TRY_HOTEL_S4 = {
    knowledgeBuckets: HOTEL_KNOWLEDGE_BUCKETS,
    mapMarkerKinds: DEFAULT_HOTEL_MAP_MARKERS.map((row) => row.kind),
    sla: DEFAULT_HOTEL_SLA_MINUTES,
    upsells: DEFAULT_HOTEL_UPSELLS,
    emergencyContact: "112",
}

export const TRY_HOTEL_S5 = {
    groupName: "Haven Collection",
    staffRoles: HOTEL_STAFF_ROLES,
    whiteLabel: false,
}

export type SeedRestaurant = { slug: string; roleTemplate: string; isPublic: boolean }

export type TryHotelSeedState = {
    profile: { slug: string; roleTemplate: string } | null
    rooms: string[]
    propertyQr: boolean
    roomQrs: string[]
    linkedRestaurantSlug: string | null
    availableRestaurants: SeedRestaurant[]
    services?: string[]
    stayToken?: string | null
    knowledgeBuckets?: string[]
    mapMarkerCount?: number
}

export type TryHotelSeedPlan = {
    createProfile: boolean
    addRooms: string[]
    needPropertyQr: boolean
    needRoomQrs: string[]
    connectRestaurant: string | null
    needServices: string[]
    needStay: boolean
    needKnowledge: boolean
    needMap: boolean
    stayToken: string
    skipReason?: string
}

export function pickLinkedRestaurant(candidates: SeedRestaurant[]): string | null {
    const live = candidates.filter((row) => row.isPublic && resolveKitRole(row.roleTemplate) === "RESTAURANT")
    for (const slug of TRY_HOTEL.restaurantSlugs) {
        if (live.some((row) => row.slug === slug)) return slug
    }
    return live[0]?.slug || null
}

export function tryHotelSeedActions(state: TryHotelSeedState): TryHotelSeedPlan {
    if (state.profile && resolveKitRole(state.profile.roleTemplate) !== "HOTEL") {
        return {
            createProfile: false,
            addRooms: [],
            needPropertyQr: false,
            needRoomQrs: [],
            connectRestaurant: null,
            needServices: [],
            needStay: false,
            needKnowledge: false,
            needMap: false,
            stayToken: TRY_HOTEL_S3.stayToken,
            skipReason: "foreign-role",
        }
    }
    const createProfile = !state.profile
    const have = new Set(state.rooms)
    const addRooms = TRY_HOTEL.rooms.filter((number) => !have.has(number))
    const afterRooms = [...TRY_HOTEL.rooms]
    const haveRoomQr = new Set(state.roomQrs)
    const haveServices = new Set(state.services || [])
    const haveBuckets = new Set(state.knowledgeBuckets || [])
    return {
        createProfile,
        addRooms,
        needPropertyQr: !state.propertyQr,
        needRoomQrs: afterRooms.filter((number) => !haveRoomQr.has(number)),
        connectRestaurant: state.linkedRestaurantSlug ? null : pickLinkedRestaurant(state.availableRestaurants),
        needServices: TRY_HOTEL_S3.services.filter((id) => !haveServices.has(id)),
        needStay: state.stayToken !== TRY_HOTEL_S3.stayToken,
        needKnowledge: HOTEL_KNOWLEDGE_BUCKETS.some((bucket) => !haveBuckets.has(bucket)),
        needMap: (state.mapMarkerCount || 0) < DEFAULT_HOTEL_MAP_MARKERS.length,
        stayToken: TRY_HOTEL_S3.stayToken,
    }
}

export async function ensureTryHotelDemo(prisma: PrismaClient) {
    const existing = await prisma.profile.findUnique({
        where: { slug: TRY_HOTEL.slug },
        select: { id: true, slug: true, roleTemplate: true },
    })
    const rooms = existing
        ? await prisma.hotelRoom.findMany({ where: { profileId: existing.id }, select: { id: true, number: true } })
        : []
    const qrs = existing
        ? await prisma.hotelQr.findMany({
            where: { profileId: existing.id },
            select: { kind: true, roomId: true, code: true, label: true },
        })
        : []
    const link = existing
        ? await prisma.hotelRestaurantLink.findFirst({
            where: { hotelProfileId: existing.id },
            include: { restaurantProfile: { select: { slug: true } } },
        })
        : null
    const restaurants = await prisma.profile.findMany({
        where: { slug: { in: [...TRY_HOTEL.restaurantSlugs] }, isPublic: true },
        select: { id: true, slug: true, roleTemplate: true, isPublic: true, displayName: true },
    })
    const propertyRow = existing
        ? await prisma.hotelProperty.findUnique({ where: { profileId: existing.id }, select: { servicesJson: true, mapMarkersJson: true } })
        : null
    const knowledgeRows = existing
        ? await prisma.hotelKnowledge.findMany({ where: { profileId: existing.id }, select: { bucket: true } })
        : []
    const demoStay = existing
        ? await prisma.hotelStay.findUnique({ where: { token: TRY_HOTEL_S3.stayToken }, select: { profileId: true, token: true } })
        : null
    let services: string[] = []
    try {
        const parsed = JSON.parse(propertyRow?.servicesJson || "[]")
        if (Array.isArray(parsed)) services = parsed.filter((item) => typeof item === "string")
    } catch {
        services = []
    }
    const roomById = new Map(rooms.map((row) => [row.id, row.number]))
    const plan = tryHotelSeedActions({
        profile: existing,
        rooms: rooms.map((row) => row.number),
        propertyQr: qrs.some((row) => row.kind === "PROPERTY"),
        roomQrs: qrs.filter((row) => row.kind === "ROOM").map((row) => roomById.get(row.roomId || "") || "").filter(Boolean),
        linkedRestaurantSlug: link?.restaurantProfile.slug || null,
        availableRestaurants: restaurants,
        services,
        stayToken: demoStay && existing && demoStay.profileId === existing.id ? demoStay.token : null,
        knowledgeBuckets: knowledgeRows.map((row) => row.bucket),
        mapMarkerCount: (() => {
            try {
                const parsed = JSON.parse(propertyRow?.mapMarkersJson || "[]")
                return Array.isArray(parsed) ? parsed.length : 0
            } catch {
                return 0
            }
        })(),
    })

    if (plan.skipReason) {
        return { created: false, skipped: [TRY_HOTEL.slug], rooms: rooms.map((row) => row.number), restaurant: link?.restaurantProfile.slug || null, qrs, stayToken: null }
    }

    let profileId = existing?.id
    if (plan.createProfile) {
        const workspace = await prisma.workspace.findUnique({ where: { slug: TRY_HOTEL.slug }, select: { id: true } }).catch(() => null)
        if (workspace) {
            return { created: false, skipped: [TRY_HOTEL.slug], rooms: [], restaurant: null, qrs: [], stayToken: null }
        }
        const byClerk = await prisma.user.findUnique({ where: { clerkId: TRY_HOTEL.clerkId } })
        const byEmail = await prisma.user.findUnique({ where: { email: TRY_HOTEL.email } })
        if ((byClerk && byClerk.email !== TRY_HOTEL.email) || (byEmail && byEmail.clerkId !== TRY_HOTEL.clerkId)) {
            return { created: false, skipped: [TRY_HOTEL.slug], rooms: [], restaurant: null, qrs: [], stayToken: null }
        }
        const user = byClerk || await prisma.user.create({
            data: { clerkId: TRY_HOTEL.clerkId, email: TRY_HOTEL.email, name: TRY_HOTEL.displayName },
        })
        const created = await prisma.profile.create({
            data: {
                userId: user.id,
                slug: TRY_HOTEL.slug,
                displayName: TRY_HOTEL.displayName,
                headline: TRY_HOTEL.headline,
                bio: TRY_HOTEL.bio,
                roleTemplate: "HOTEL",
                primaryGoal: "TAKE_APPOINTMENTS",
                language: "en",
                timezone: "Asia/Kolkata",
                themeColor: TRY_HOTEL.themeColor,
                imageUrl: TRY_HOTEL.imageUrl,
                shopLogoUrl: TRY_HOTEL.shopLogoUrl,
                isPublic: true,
                liveChatEnabled: true,
                welcomeMessageOverride: TRY_HOTEL.welcome,
                whatsapp: TRY_HOTEL.whatsapp,
                personalityConfig: JSON.stringify({
                    tone: "warm",
                    language: "en",
                    responseLength: "medium",
                    customInstructions: TRY_HOTEL.customInstructions,
                }),
            },
        })
        profileId = created.id
        await prisma.profileDocument.createMany({
            data: HAVEN_HOTEL.documents.map((doc) => ({
                profileId: created.id,
                type: doc.type,
                sourceType: "TEXT",
                title: doc.title,
                rawText: doc.rawText,
                visibility: "PUBLIC",
                publicationState: "PUBLISHED",
            })),
        })
    }

    if (!profileId) {
        return { created: false, skipped: [TRY_HOTEL.slug], rooms: [], restaurant: null, qrs: [], stayToken: null }
    }

    const property = await prisma.hotelProperty.findUnique({ where: { profileId } })
    if (!property) {
        await prisma.hotelProperty.create({
            data: {
                profileId,
                checkInTime: "14:00",
                checkOutTime: "11:00",
                wifiName: TRY_HOTEL.wifiName,
                wifiPassword: TRY_HOTEL.wifiPassword,
                roomCount: TRY_HOTEL.rooms.length,
                servicesJson: JSON.stringify([...TRY_HOTEL_S3.services]),
                address: HAVEN_HOTEL.venue?.address?.formatted || "Hinoo Main Road, Hinoo, Ranchi 834002",
                receptionWhatsapp: HAVEN_HOTEL.whatsapp,
                receptionPhone: HAVEN_HOTEL.whatsapp,
                emergencyContact: TRY_HOTEL_S4.emergencyContact,
                timezone: "Asia/Kolkata",
                quietHours: "22:00–07:00",
                parkingInfo: "Street parking on Hinoo Main Road. No valet.",
                propertyHours: "Reception 00:00–23:59",
                mapMarkersJson: JSON.stringify(DEFAULT_HOTEL_MAP_MARKERS),
                slaJson: JSON.stringify(DEFAULT_HOTEL_SLA_MINUTES),
                upsellsJson: JSON.stringify(DEFAULT_HOTEL_UPSELLS),
                groupJson: JSON.stringify({ name: TRY_HOTEL_S5.groupName, hotelProfileIds: [] }),
                whiteLabel: TRY_HOTEL_S5.whiteLabel,
            },
        })
    }

    // P1-4: keep Profile.whatsapp aligned with reception fixture (home + /share read profile.whatsapp).
    const liveProfileWa = await prisma.profile.findUnique({ where: { id: profileId }, select: { whatsapp: true } })
    const waDigits = String(liveProfileWa?.whatsapp || "").replace(/\D/g, "")
    if (!waDigits) {
        await prisma.profile.update({
            where: { id: profileId },
            data: { whatsapp: TRY_HOTEL.whatsapp },
        })
    }

    // P1-5: replace known cafe/creator leakage on Haven showcase profiles (try-hotel + haven-hinoo).
    // Only when imageUrl contains skydine or shopLogoUrl contains try-arjun — never wipe custom uploads.
    const honestImage = TRY_HOTEL.imageUrl || HAVEN_HONEST_IMAGE_URL
    const honestLogo = TRY_HOTEL.shopLogoUrl || HAVEN_HONEST_LOGO_URL
    const havenProfiles = await prisma.profile.findMany({
        where: { slug: { in: [TRY_HOTEL.slug, HAVEN_HOTEL.slug] } },
        select: { id: true, imageUrl: true, shopLogoUrl: true },
    })
    for (const row of havenProfiles) {
        const patch = hotelImageryBackfillPatch({
            imageUrl: row.imageUrl,
            shopLogoUrl: row.shopLogoUrl,
            honestImageUrl: honestImage,
            honestLogoUrl: honestLogo,
        })
        if (patch) {
            await prisma.profile.update({ where: { id: row.id }, data: patch })
        }
    }

    const existingRooms = await prisma.hotelRoom.findMany({ where: { profileId }, select: { id: true, number: true, sortOrder: true } })
    let sort = existingRooms.reduce((max, row) => Math.max(max, row.sortOrder), 0)
    for (const number of plan.addRooms) {
        sort += 1
        await prisma.hotelRoom.upsert({
            where: { profileId_number: { profileId, number } },
            update: { isActive: true, floor: "1", category: "Deluxe" },
            create: { profileId, number, floor: "1", category: "Deluxe", sortOrder: sort },
        })
    }
    const allRooms = await prisma.hotelRoom.findMany({ where: { profileId }, select: { id: true, number: true } })

    if (plan.needPropertyQr) {
        const existingProp = await prisma.hotelQr.findFirst({ where: { profileId, kind: "PROPERTY" } })
        if (!existingProp) {
            await prisma.hotelQr.create({
                data: {
                    profileId,
                    code: generateHotelQrCode(),
                    kind: "PROPERTY",
                    targetType: "PROPERTY",
                    label: "Property",
                },
            })
        }
    }

    for (const number of plan.needRoomQrs) {
        const room = allRooms.find((row) => row.number === number)
        if (!room) continue
        const existingQr = await prisma.hotelQr.findFirst({ where: { profileId, roomId: room.id, kind: "ROOM" } })
        if (existingQr) continue
        await prisma.hotelQr.create({
            data: {
                profileId,
                roomId: room.id,
                code: generateHotelQrCode(),
                kind: "ROOM",
                targetType: "ROOM",
                targetId: room.id,
                label: `Room ${room.number}`,
            },
        })
    }

    const liveProperty = await prisma.hotelProperty.findUnique({ where: { profileId }, select: { servicesJson: true, emergencyContact: true, receptionWhatsapp: true, receptionPhone: true } })
    if (plan.needServices.length) {
        let current: string[] = []
        try {
            const parsed = JSON.parse(liveProperty?.servicesJson || "[]")
            if (Array.isArray(parsed)) current = parsed.filter((item) => typeof item === "string")
        } catch {
            current = []
        }
        const merged = [...new Set([...current, ...plan.needServices])]
        await prisma.hotelProperty.updateMany({
            where: { profileId },
            data: { servicesJson: JSON.stringify(merged) },
        })
    }

    if (plan.needKnowledge) {
        let sort = 0
        for (const doc of DEFAULT_HOTEL_KNOWLEDGE) {
            sort += 1
            const existingDoc = await prisma.hotelKnowledge.findFirst({ where: { profileId, bucket: doc.bucket } })
            if (existingDoc) {
                await prisma.hotelKnowledge.update({
                    where: { id: existingDoc.id },
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

    if (plan.needMap || !liveProperty?.emergencyContact || !liveProperty?.receptionWhatsapp) {
        await prisma.hotelProperty.updateMany({
            where: { profileId },
            data: {
                mapMarkersJson: JSON.stringify(DEFAULT_HOTEL_MAP_MARKERS),
                quietHours: "22:00–07:00",
                parkingInfo: "Street parking on Hinoo Main Road. No valet.",
                propertyHours: "Reception 00:00–23:59",
                emergencyContact: TRY_HOTEL_S4.emergencyContact,
                receptionWhatsapp: HAVEN_HOTEL.whatsapp,
                receptionPhone: HAVEN_HOTEL.whatsapp,
                slaJson: JSON.stringify(DEFAULT_HOTEL_SLA_MINUTES),
                upsellsJson: JSON.stringify(DEFAULT_HOTEL_UPSELLS),
                staffLanguage: "en",
                groupJson: JSON.stringify({ name: TRY_HOTEL_S5.groupName, hotelProfileIds: [] }),
                whiteLabel: TRY_HOTEL_S5.whiteLabel,
            },
        })
    }

    await prisma.hotelProperty.updateMany({
        where: { profileId, OR: [{ groupJson: "{}" }, { groupJson: "" }] },
        data: {
            groupJson: JSON.stringify({ name: TRY_HOTEL_S5.groupName, hotelProfileIds: [] }),
            whiteLabel: TRY_HOTEL_S5.whiteLabel,
        },
    })

    let stayToken: string | null = demoStay?.profileId === profileId ? TRY_HOTEL_S3.stayToken : null
    if (plan.needStay) {
        const clash = await prisma.hotelStay.findUnique({ where: { token: TRY_HOTEL_S3.stayToken }, select: { id: true, profileId: true } })
        if (!clash) {
            const room101 = allRooms.find((row) => row.number === "101") || allRooms[0]
            const now = Date.now()
            await prisma.hotelStay.create({
                data: {
                    profileId,
                    token: TRY_HOTEL_S3.stayToken,
                    guestName: TRY_HOTEL_S3.guestName,
                    roomId: room101?.id || null,
                    arrival: new Date(now - 12 * 60 * 60 * 1000),
                    departure: new Date(now + 36 * 60 * 60 * 1000),
                    language: "en",
                },
            })
            stayToken = TRY_HOTEL_S3.stayToken
        } else if (clash.profileId === profileId) {
            stayToken = TRY_HOTEL_S3.stayToken
        }
    }

    let restaurantSlug = link?.restaurantProfile.slug || null
    if (plan.connectRestaurant) {
        const restaurant = restaurants.find((row) => row.slug === plan.connectRestaurant)
        if (restaurant && resolveKitRole(restaurant.roleTemplate) === "RESTAURANT") {
            await prisma.hotelRestaurantLink.upsert({
                where: {
                    hotelProfileId_restaurantProfileId: {
                        hotelProfileId: profileId,
                        restaurantProfileId: restaurant.id,
                    },
                },
                update: { label: restaurant.displayName },
                create: {
                    hotelProfileId: profileId,
                    restaurantProfileId: restaurant.id,
                    label: restaurant.displayName,
                },
            })
            restaurantSlug = restaurant.slug
        }
    }

    const finalRooms = await prisma.hotelRoom.findMany({ where: { profileId }, select: { number: true } })
    const finalQrs = await prisma.hotelQr.findMany({
        where: { profileId },
        select: { kind: true, code: true, label: true },
    })
    return {
        created: plan.createProfile,
        skipped: plan.createProfile ? [] : [TRY_HOTEL.slug],
        rooms: finalRooms.map((row) => row.number),
        restaurant: restaurantSlug,
        qrs: finalQrs,
        stayToken,
    }
}
