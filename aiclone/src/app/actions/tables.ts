"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { tablesForProfile } from "@/lib/restaurant-tables"

async function restaurantOwner() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!user || !profile) throw new Error("Unauthorized")
    if (profile.roleTemplate !== "RESTAURANT") throw new Error("Tables are for restaurant profiles.")
    return profile
}

function newTableCode() {
    return randomBytes(18).toString("base64url")
}

export async function listRestaurantTables() {
    const profile = await restaurantOwner()
    return prisma.restaurantTable.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    })
}

export async function ensureRestaurantTables() {
    const profile = await restaurantOwner()
    return tablesForProfile(profile.id)
}

export async function createRestaurantTable(label: string, seats?: number, zone?: string) {
    const profile = await restaurantOwner()
    const name = label.trim().slice(0, 40)
    if (name.length < 1) throw new Error("Give the table a name.")
    const last = await prisma.restaurantTable.findFirst({
        where: { profileId: profile.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
    })
    const created = await prisma.restaurantTable.create({
        data: {
            profileId: profile.id,
            label: name,
            seats: seats && seats > 0 ? Math.min(24, Math.floor(seats)) : 4,
            zone: (zone || "Ground").trim().slice(0, 40) || "Ground",
            code: newTableCode(),
            sortOrder: (last?.sortOrder || 0) + 1,
        },
    })
    revalidatePath("/dashboard/orders")
    return created
}

export async function setRestaurantTableActive(tableId: string, isActive: boolean) {
    const profile = await restaurantOwner()
    await prisma.restaurantTable.updateMany({
        where: { id: tableId, profileId: profile.id },
        data: { isActive },
    })
    revalidatePath("/dashboard/orders")
}

export async function rotateRestaurantTableCode(tableId: string) {
    const profile = await restaurantOwner()
    await prisma.restaurantTable.updateMany({
        where: { id: tableId, profileId: profile.id },
        data: { code: newTableCode() },
    })
    revalidatePath("/dashboard/orders")
}

export async function setRestaurantTableSeats(tableId: string, seats: number) {
    const profile = await restaurantOwner()
    const n = Math.max(1, Math.min(24, Math.floor(seats)))
    await prisma.restaurantTable.updateMany({
        where: { id: tableId, profileId: profile.id },
        data: { seats: n },
    })
    revalidatePath("/dashboard/orders")
}

export async function setRestaurantTableZone(tableId: string, zone: string) {
    const profile = await restaurantOwner()
    const name = zone.trim().slice(0, 40) || "Ground"
    await prisma.restaurantTable.updateMany({
        where: { id: tableId, profileId: profile.id },
        data: { zone: name },
    })
    revalidatePath("/dashboard/orders")
}

export async function setRestaurantAllSeats(seats: number) {
    const profile = await restaurantOwner()
    const n = Math.max(1, Math.min(24, Math.floor(seats)))
    await prisma.restaurantTable.updateMany({
        where: { profileId: profile.id, isActive: true },
        data: { seats: n },
    })
    revalidatePath("/dashboard/orders")
}

export async function setRestaurantTableReserved(tableId: string, isReserved: boolean) {
    const profile = await restaurantOwner()
    await prisma.$executeRaw`
        UPDATE "RestaurantTable"
        SET "isReserved" = ${isReserved}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${tableId} AND "profileId" = ${profile.id} AND "isActive" = true
    `
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/calendar")
}

export async function setRestaurantTableCount(count: number) {
    const profile = await restaurantOwner()
    const n = Math.max(1, Math.min(120, Math.floor(count)))
    const tables = await tablesForProfile(profile.id)
    if (tables.length < n) {
        const last = tables[tables.length - 1]?.sortOrder || 0
        await prisma.restaurantTable.createMany({
            data: Array.from({ length: n - tables.length }, (_, i) => ({
                profileId: profile.id,
                label: `Table ${tables.length + i + 1}`,
                seats: 4,
                code: newTableCode(),
                sortOrder: last + i + 1,
                isActive: true,
            })),
        })
    }
    const all = await prisma.restaurantTable.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: { id: true },
    })
    const keep = all.slice(0, n).map((row) => row.id)
    const hide = all.slice(n).map((row) => row.id)
    if (keep.length) {
        await prisma.restaurantTable.updateMany({
            where: { id: { in: keep }, profileId: profile.id },
            data: { isActive: true },
        })
    }
    if (hide.length) {
        await prisma.restaurantTable.updateMany({
            where: { id: { in: hide }, profileId: profile.id },
            data: { isActive: false },
        })
    }
    await prisma.serviceOffering.updateMany({
        where: { profileId: profile.id, kind: "TABLE" },
        data: { covers: n },
    })
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard/services")
}
