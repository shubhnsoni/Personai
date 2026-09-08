"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { syncUser } from "@/lib/auth-sync"

export async function getAvailableSlots(
    profileId: string,
    dateStr: string,
    durationMinutes = 30,
    opts?: { partySize?: number; serviceId?: string },
) {
    const date = new Date(`${dateStr}T00:00:00`)
    const { generateSlots } = await import("@/lib/slots")
    const { parsePartySize, isHoldBooking } = await import("@/lib/menu")

    const [weekly, profile, bookings, overrides, service] = await Promise.all([
        prisma.availabilitySchedule.findMany({ where: { profileId } }),
        prisma.profile.findUnique({ where: { id: profileId }, select: { id: true, timezone: true } }),
        prisma.booking.findMany({
            where: {
                profileId,
                status: { not: "CANCELLED" },
                startTime: { gte: date, lt: new Date(date.getTime() + 86400000) },
            },
        }),
        // CalendarOverride is a real model, so this needs no defensive optional call.
        prisma.calendarOverride
            .findMany({
                where: {
                    profileId,
                    date: { gte: date, lt: new Date(date.getTime() + 86400000) },
                },
            })
            .catch(() => []),
        opts?.serviceId
            ? prisma.serviceOffering.findUnique({ where: { id: opts.serviceId } })
            : Promise.resolve(null),
    ])

    if (!profile) return []

    const bufferMinutes = Number((profile as { bufferMinutes?: number }).bufferMinutes || 0)
    const table = service && (service as { kind?: string }).kind === "TABLE"
    const configured = table
        ? Number((service as { covers?: number | null }).covers || (service as { maxBookingsPerDay?: number | null }).maxBookingsPerDay || 0)
        : 0
    const floor = table
        ? await prisma.$queryRaw<Array<{ isReserved: boolean; seats: number | null }>>`
            SELECT "isReserved", seats FROM "RestaurantTable"
            WHERE "profileId" = ${profileId} AND "isActive" = true
        `.catch(() => [])
        : []
    const openTables = floor.filter((row) => !row.isReserved)
    const avgSeats = openTables.length
        ? Math.max(2, Math.round(openTables.reduce((sum, row) => sum + (row.seats || 4), 0) / openTables.length))
        : 4
    const tablesNeeded = (people: number) => Math.max(1, Math.ceil(Math.max(1, people) / avgSeats))
    const coverLimit = table
        ? Math.max(0, floor.length ? (configured > 0 ? Math.min(openTables.length, configured) : openTables.length) : configured || 8)
        : null

    const slots = generateSlots({
        date,
        weekly,
        overrides: (overrides || []).map((o: { date: Date; isBlocked: boolean; startTime: string | null; endTime: string | null }) => ({
            date: o.date.toISOString(),
            isBlocked: o.isBlocked,
            startTime: o.startTime,
            endTime: o.endTime,
        })),
        durationMinutes,
        bufferMinutes,
        coverLimit,
        partySize: table ? tablesNeeded(opts?.partySize || 2) : opts?.partySize,
        busy: bookings.map((b) => ({
            start: b.startTime,
            end: b.endTime,
            covers: table
                ? (isHoldBooking(b.metadata, b.visitorEmail) ? (coverLimit || 999) : tablesNeeded(parsePartySize(b.metadata)))
                : parsePartySize(b.metadata),
        })),
    })
    const { filterPastSlots } = await import("@/lib/menu")
    return filterPastSlots(dateStr, slots)
}

export async function ensureTableService(profileId: string) {
    const existing = await prisma.serviceOffering.findFirst({
        where: { profileId, kind: "TABLE", isActive: true },
        orderBy: { createdAt: "asc" },
    })
    if (existing) return existing
    return prisma.serviceOffering.create({
        data: {
            profileId,
            name: "Reserve a table",
            description: "Dine-in seating",
            priceCents: 0,
            isFree: true,
            durationMinutes: 90,
            currency: "USD",
            isActive: true,
            kind: "TABLE",
            covers: 20,
        },
    })
}

export async function createBooking(data: {
    profileId: string,
    serviceOfferingId: string,
    startTime: string, // ISO string
    visitorName: string,
    visitorEmail?: string
    partySize?: number
    visitorPhone?: string
    notes?: string
}) {
    // Calculate end time based on service duration
    const service = await prisma.serviceOffering.findUnique({
        where: { id: data.serviceOfferingId }
    })

    if (!service) throw new Error("Service not found")

    const start = new Date(data.startTime)
    const end = new Date(start.getTime() + service.durationMinutes * 60000)
    const table = (service as { kind?: string }).kind === "TABLE"
    const partySize = Math.max(1, Math.min(80, Math.floor(data.partySize || 1)))

    if (table) {
        const dateStr = data.startTime.slice(0, 10)
        const time = data.startTime.slice(11, 16)
        const slots = await getAvailableSlots(data.profileId, dateStr, service.durationMinutes, {
            partySize,
            serviceId: service.id,
        })
        if (!slots.includes(time)) throw new Error("That table time is full")
    }

    const digits = (data.visitorPhone || "").replace(/\D/g, "")
    const visitorEmail = data.visitorEmail?.trim() || (digits ? `guest.${digits}@guest.local` : "guest@local")

    let memberId: string | undefined
    try {
        const { upsertMember } = await import("@/lib/members")
        const member = await upsertMember(visitorEmail, data.visitorName)
        memberId = member.id
    } catch {}

    const metadata = table || data.visitorPhone || data.notes
        ? JSON.stringify({
            partySize: table ? partySize : undefined,
            phone: data.visitorPhone || undefined,
            notes: data.notes || undefined,
        })
        : undefined

    const booking = await prisma.booking.create({
        data: {
            profileId: data.profileId,
            serviceOfferingId: data.serviceOfferingId,
            visitorName: data.visitorName,
            visitorEmail,
            memberId,
            startTime: start,
            endTime: end,
            status: service.isFree || service.priceCents === 0 ? "CONFIRMED" : "PENDING_PAYMENT",
            metadata: metadata || undefined,
        }
    })

    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard/inbox")
    return booking
}

export async function setBookingStatus(bookingId: string, status: "CONFIRMED" | "CANCELLED") {
    const user = await syncUser()
    const profileId = user?.profiles[0]?.id
    if (!profileId) throw new Error("Unauthorized")

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking || booking.profileId !== profileId) throw new Error("Not found")

    await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
    })
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard/inbox")
    revalidatePath("/dashboard/money")
}

export async function createHold(startIso: string, minutes = 30, note = "Blocked") {
    const user = await syncUser()
    const profile = user?.profiles[0]
    if (!profile) throw new Error("Unauthorized")

    const start = new Date(startIso)
    const end = new Date(start.getTime() + minutes * 60000)
    let service = await prisma.serviceOffering.findFirst({
        where: { profileId: profile.id },
        orderBy: { createdAt: "asc" },
    })
    if (!service) {
        service = await prisma.serviceOffering.create({
            data: {
                profileId: profile.id,
                name: "Hold",
                description: "Blocked time",
                priceCents: 0,
                isFree: true,
                durationMinutes: minutes,
                isActive: false,
            },
        })
    }

    await prisma.booking.create({
        data: {
            profileId: profile.id,
            serviceOfferingId: service.id,
            visitorName: note,
            visitorEmail: "hold@local",
            startTime: start,
            endTime: end,
            status: "CONFIRMED",
            metadata: JSON.stringify({ hold: true }),
        },
    })
    revalidatePath("/dashboard/calendar")
}
