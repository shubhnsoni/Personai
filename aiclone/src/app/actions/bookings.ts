"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getAvailableSlots(profileId: string, dateStr: string) {
    // dateStr is YYYY-MM-DD
    const date = new Date(dateStr)
    const dayOfWeek = date.getDay() // 0-6

    // Get schedule for this day
    const schedule = await prisma.availabilitySchedule.findFirst({
        where: { profileId, dayOfWeek, isEnabled: true }
    })

    if (!schedule) return []

    // Generate slots
    // Simple implementation: 30 min slots from start to end
    // In real app, check duration of service and existing bookings

    const slots = []
    let current = new Date(`${dateStr}T${schedule.startTime}`)
    const end = new Date(`${dateStr}T${schedule.endTime}`)

    // Get existing bookings for this day
    const startOfDay = new Date(dateStr)
    const endOfDay = new Date(dateStr)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const bookings = await prisma.booking.findMany({
        where: {
            profileId,
            startTime: { gte: startOfDay, lt: endOfDay }
        }
    })

    while (current < end) {
        // Check if slot overlaps with any booking
        const slotEnd = new Date(current.getTime() + 30 * 60000) // 30 mins

        const isTaken = bookings.some(b => {
            return (current >= b.startTime && current < b.endTime) ||
                (slotEnd > b.startTime && slotEnd <= b.endTime)
        })

        if (!isTaken) {
            slots.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
        }

        current = slotEnd
    }

    return slots
}

export async function createBooking(data: {
    profileId: string,
    serviceOfferingId: string,
    startTime: string, // ISO string
    visitorName: string,
    visitorEmail: string
}) {
    // Calculate end time based on service duration
    const service = await prisma.serviceOffering.findUnique({
        where: { id: data.serviceOfferingId }
    })

    if (!service) throw new Error("Service not found")

    const start = new Date(data.startTime)
    const end = new Date(start.getTime() + service.durationMinutes * 60000)

    const booking = await prisma.booking.create({
        data: {
            profileId: data.profileId,
            serviceOfferingId: data.serviceOfferingId,
            visitorName: data.visitorName,
            visitorEmail: data.visitorEmail,
            startTime: start,
            endTime: end,
            status: "PENDING_PAYMENT" // Or CONFIRMED if free
        }
    })

    // revalidatePath(`/${data.slug}`) // We don't have slug here, but it's fine
    return booking
}
