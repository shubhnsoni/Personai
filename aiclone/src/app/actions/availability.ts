"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function updateAvailability(profileId: string, schedules: { dayOfWeek: number, startTime: string, endTime: string, isEnabled: boolean }[]) {
    // Transaction to replace schedules
    await prisma.$transaction(async (tx) => {
        // Delete existing
        await tx.availabilitySchedule.deleteMany({
            where: { profileId }
        })

        // Create new
        if (schedules.length > 0) {
            await tx.availabilitySchedule.createMany({
                data: schedules.map(s => ({
                    profileId,
                    dayOfWeek: s.dayOfWeek,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    isEnabled: s.isEnabled
                }))
            })
        }
    })

    revalidatePath("/dashboard/calendar")
}
