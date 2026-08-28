"use server"

import { prisma } from "@/lib/prisma"
import { executeOwnedResourceWrite, requireOwnedProfile, unwrapOwnershipResult } from "@/lib/security"
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

function eventWrite(data: EventData) {
    return {
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
}

export async function createEvent(profileId: string, data: EventData) {
    const { profile } = unwrapOwnershipResult(await requireOwnedProfile({ claimedProfileId: profileId }))
    await prisma.event.create({
        data: {
            profileId: profile.id,
            ...eventWrite(data),
            currency: "USD",
        },
    })
    revalidatePath("/dashboard/events")
}

export async function updateEvent(eventId: string, data: EventData) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: eventId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.event.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: eventWrite(data),
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/events")
}

export async function deleteEvent(eventId: string) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: eventId,
        writeOwned: async ({ resourceId, profile }) => {
            const deleted = await prisma.event.deleteMany({
                where: { id: resourceId, profileId: profile.id },
            })
            return deleted.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/events")
}

export async function setEventActive(eventId: string, isActive: boolean) {
    unwrapOwnershipResult(await executeOwnedResourceWrite({
        resourceId: eventId,
        writeOwned: async ({ resourceId, profile }) => {
            const updated = await prisma.event.updateMany({
                where: { id: resourceId, profileId: profile.id },
                data: { isActive },
            })
            return updated.count === 1 ? true : null
        },
    }))
    revalidatePath("/dashboard/events")
}
