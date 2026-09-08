"use server"

import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { revalidatePath } from "next/cache"

export async function ensureCalendarToken() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!profile) throw new Error("Unauthorized")

    const existing = await prisma.$queryRaw<Array<{ calendarToken: string | null }>>`
        SELECT "calendarToken" FROM "Profile" WHERE "id" = ${profile.id}
    `
    const token = existing[0]?.calendarToken
    if (token) return token

    const next = randomBytes(18).toString("base64url")
    await prisma.$executeRaw`
        UPDATE "Profile" SET "calendarToken" = ${next} WHERE "id" = ${profile.id}
    `
    revalidatePath("/dashboard/calendar")
    return next
}

export async function rotateCalendarToken() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!profile) throw new Error("Unauthorized")
    const next = randomBytes(18).toString("base64url")
    await prisma.$executeRaw`
        UPDATE "Profile" SET "calendarToken" = ${next} WHERE "id" = ${profile.id}
    `
    revalidatePath("/dashboard/calendar")
    return next
}
