"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface EventData {
    title: string
    description?: string
    eventType: "WEBINAR" | "WORKSHOP" | "MEETUP"
    startTime: string
    endTime: string
    timezone: string
    location?: string
    meetingUrl?: string
    price: number
    isFree: boolean
    maxAttendees?: number
    thumbnailUrl?: string
    isActive: boolean
}

export async function createEvent(profileId: string, data: EventData) {
    await prisma.event.create({
        data: {
            profileId,
            title: data.title,
            description: data.description || null,
            eventType: data.eventType,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            timezone: data.timezone,
            location: data.location || null,
            meetingUrl: data.meetingUrl || null,
            priceCents: data.isFree ? 0 : Math.round(data.price * 100),
            currency: "USD",
            isFree: data.isFree,
            maxAttendees: data.maxAttendees || null,
            thumbnailUrl: data.thumbnailUrl || null,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/events")
}

export async function updateEvent(eventId: string, data: EventData) {
    await prisma.event.update({
        where: { id: eventId },
        data: {
            title: data.title,
            description: data.description || null,
            eventType: data.eventType,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            timezone: data.timezone,
            location: data.location || null,
            meetingUrl: data.meetingUrl || null,
            priceCents: data.isFree ? 0 : Math.round(data.price * 100),
            isFree: data.isFree,
            maxAttendees: data.maxAttendees || null,
            thumbnailUrl: data.thumbnailUrl || null,
            isActive: data.isActive,
        }
    })
    revalidatePath("/dashboard/events")
}

export async function deleteEvent(eventId: string) {
    await prisma.event.delete({
        where: { id: eventId }
    })
    revalidatePath("/dashboard/events")
}
