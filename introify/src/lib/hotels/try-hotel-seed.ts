import type { PrismaClient } from "@prisma/client"
import { resolveKitRole } from "@/lib/role-alias"
import { DEFAULT_HOTEL_SERVICES } from "./catalogue"
import { generateHotelQrCode } from "./qr-code"
import { HAVEN_HOTEL } from "@/lib/demo-shops/stay"

export const TRY_HOTEL = {
    slug: "try-hotel",
    clerkId: "mock-clerk-id-try-hotel",
    email: "try-hotel@introify.com",
    displayName: "Haven Hinoo",
    headline: HAVEN_HOTEL.headline,
    bio: HAVEN_HOTEL.bio,
    welcome: HAVEN_HOTEL.welcome,
    rooms: ["101", "102", "103"] as const,
    restaurantSlugs: ["littlehours", "try-restaurant"] as const,
    wifiName: "haven-guest",
    wifiPassword: "haven-hinoo",
    themeColor: "#00D7FF",
    imageUrl: HAVEN_HOTEL.imageUrl,
    shopLogoUrl: HAVEN_HOTEL.shopLogoUrl,
    customInstructions: HAVEN_HOTEL.customInstructions,
}

export type SeedRestaurant = { slug: string; roleTemplate: string; isPublic: boolean }

export type TryHotelSeedState = {
    profile: { slug: string; roleTemplate: string } | null
    rooms: string[]
    propertyQr: boolean
    roomQrs: string[]
    linkedRestaurantSlug: string | null
    availableRestaurants: SeedRestaurant[]
}

export type TryHotelSeedPlan = {
    createProfile: boolean
    addRooms: string[]
    needPropertyQr: boolean
    needRoomQrs: string[]
    connectRestaurant: string | null
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
            skipReason: "foreign-role",
        }
    }
    const createProfile = !state.profile
    const have = new Set(state.rooms)
    const addRooms = TRY_HOTEL.rooms.filter((number) => !have.has(number))
    const afterRooms = [...TRY_HOTEL.rooms]
    const haveRoomQr = new Set(state.roomQrs)
    return {
        createProfile,
        addRooms,
        needPropertyQr: !state.propertyQr,
        needRoomQrs: afterRooms.filter((number) => !haveRoomQr.has(number)),
        connectRestaurant: state.linkedRestaurantSlug ? null : pickLinkedRestaurant(state.availableRestaurants),
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
    const roomById = new Map(rooms.map((row) => [row.id, row.number]))
    const plan = tryHotelSeedActions({
        profile: existing,
        rooms: rooms.map((row) => row.number),
        propertyQr: qrs.some((row) => row.kind === "PROPERTY"),
        roomQrs: qrs.filter((row) => row.kind === "ROOM").map((row) => roomById.get(row.roomId || "") || "").filter(Boolean),
        linkedRestaurantSlug: link?.restaurantProfile.slug || null,
        availableRestaurants: restaurants,
    })

    if (plan.skipReason) {
        return { created: false, skipped: [TRY_HOTEL.slug], rooms: rooms.map((row) => row.number), restaurant: link?.restaurantProfile.slug || null, qrs }
    }

    let profileId = existing?.id
    if (plan.createProfile) {
        const workspace = await prisma.workspace.findUnique({ where: { slug: TRY_HOTEL.slug }, select: { id: true } }).catch(() => null)
        if (workspace) {
            return { created: false, skipped: [TRY_HOTEL.slug], rooms: [], restaurant: null, qrs: [] }
        }
        const byClerk = await prisma.user.findUnique({ where: { clerkId: TRY_HOTEL.clerkId } })
        const byEmail = await prisma.user.findUnique({ where: { email: TRY_HOTEL.email } })
        if ((byClerk && byClerk.email !== TRY_HOTEL.email) || (byEmail && byEmail.clerkId !== TRY_HOTEL.clerkId)) {
            return { created: false, skipped: [TRY_HOTEL.slug], rooms: [], restaurant: null, qrs: [] }
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
        return { created: false, skipped: [TRY_HOTEL.slug], rooms: [], restaurant: null, qrs: [] }
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
                servicesJson: JSON.stringify([...DEFAULT_HOTEL_SERVICES]),
                address: HAVEN_HOTEL.venue?.address?.formatted || "Hinoo Main Road, Hinoo, Ranchi 834002",
                receptionWhatsapp: HAVEN_HOTEL.whatsapp,
                timezone: "Asia/Kolkata",
            },
        })
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
    }
}
