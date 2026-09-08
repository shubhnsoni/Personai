"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { syncUser } from "@/lib/auth-sync"

const db = prisma as typeof prisma & {
    calendarOverride: {
        findMany: (args: unknown) => Promise<Array<{
            id: string
            date: Date
            isBlocked: boolean
            startTime: string | null
            endTime: string | null
            note: string | null
        }>>
        deleteMany: (args: unknown) => Promise<unknown>
        create: (args: unknown) => Promise<unknown>
    }
}

async function ownerProfile() {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!profile) throw new Error("Unauthorized")
    return profile
}

export async function updateAvailability(
    profileId: string,
    schedules: { dayOfWeek: number; startTime: string; endTime: string; isEnabled: boolean }[],
    extras?: { timezone?: string; bufferMinutes?: number }
) {
    const profile = await ownerProfile()
    if (profile.id !== profileId) throw new Error("Unauthorized")

    await prisma.$transaction(async (tx) => {
        await tx.availabilitySchedule.deleteMany({ where: { profileId } })
        if (schedules.length > 0) {
            await tx.availabilitySchedule.createMany({
                data: schedules.map((s) => ({
                    profileId,
                    dayOfWeek: s.dayOfWeek,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    isEnabled: s.isEnabled,
                })),
            })
        }
        if (extras) {
            await tx.$executeRaw`
                UPDATE "Profile"
                SET "timezone" = ${extras.timezone || "UTC"},
                    "bufferMinutes" = ${typeof extras.bufferMinutes === "number" ? extras.bufferMinutes : 0}
                WHERE "id" = ${profileId}
            `
        }
    })

    revalidatePath("/dashboard/calendar")
}

export async function upsertCalendarOverride(data: {
    date: string
    isBlocked: boolean
    startTime?: string
    endTime?: string
    note?: string
}) {
    const profile = await ownerProfile()
    const day = new Date(`${data.date}T00:00:00`)
    await db.calendarOverride.deleteMany({
        where: { profileId: profile.id, date: day },
    })
    await db.calendarOverride.create({
        data: {
            profileId: profile.id,
            date: day,
            isBlocked: data.isBlocked,
            startTime: data.startTime || null,
            endTime: data.endTime || null,
            note: data.note || null,
        },
    })
    revalidatePath("/dashboard/calendar")
}

export async function clearCalendarOverride(date: string) {
    const profile = await ownerProfile()
    await db.calendarOverride.deleteMany({
        where: { profileId: profile.id, date: new Date(`${date}T00:00:00`) },
    })
    revalidatePath("/dashboard/calendar")
}
