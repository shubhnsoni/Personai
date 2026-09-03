import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"

function newTableCode() {
    return randomBytes(18).toString("base64url")
}

async function withReserved(profileId: string, rows: Array<{ id: string }>) {
    const flags = await prisma.$queryRaw<Array<{ id: string; isReserved: boolean }>>`
        SELECT id, "isReserved" FROM "RestaurantTable" WHERE "profileId" = ${profileId}
    `
    const reserved = new Set(flags.filter((row) => row.isReserved).map((row) => row.id))
    return rows.map((row) => ({ ...row, isReserved: reserved.has(row.id) }))
}

export async function tablesForProfile(profileId: string) {
    const existing = await prisma.restaurantTable.findMany({
        where: { profileId },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    })
    if (existing.length) return withReserved(profileId, existing)
    await prisma.restaurantTable.createMany({
        data: Array.from({ length: 8 }, (_, i) => ({
            profileId,
            label: `Table ${i + 1}`,
            seats: 4,
            code: newTableCode(),
            sortOrder: i + 1,
        })),
    })
    const rows = await prisma.restaurantTable.findMany({
        where: { profileId },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    })
    return withReserved(profileId, rows)
}
