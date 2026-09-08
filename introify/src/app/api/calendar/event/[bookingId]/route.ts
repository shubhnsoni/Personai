import type { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildIcs, icsResponse } from '@/lib/ics'
import {
    ownershipRefusalResponse,
    requireOwnedResource,
} from '@/lib/security'

export const dynamic = 'force-dynamic'

type BookingDb = Pick<Prisma.TransactionClient, 'booking'>

type BookingEventDependencies = Readonly<{
    db: BookingDb
    requireOwnedResource: typeof requireOwnedResource
    ownershipRefusalResponse: typeof ownershipRefusalResponse
    buildIcs: typeof buildIcs
    icsResponse: typeof icsResponse
}>

const productionDependencies: BookingEventDependencies = {
    db: prisma,
    requireOwnedResource,
    ownershipRefusalResponse,
    buildIcs,
    icsResponse,
}

export function createBookingEventGet(
    dependencies: BookingEventDependencies = productionDependencies,
) {
    return async function bookingEventGet(
        request: NextRequest,
        { params }: { params: Promise<{ bookingId: string }> },
    ) {
        const { bookingId } = await params
        const claimedProfileId = new URL(request.url).searchParams.get('profileId') ?? undefined
        const owned = await dependencies.requireOwnedResource({
            resourceId: bookingId,
            claimedProfileId,
            findOwned: ({ resourceId, profile }) => dependencies.db.booking.findFirst({
                where: {
                    id: resourceId,
                    profileId: profile.id,
                    status: { not: 'CANCELLED' },
                },
                select: {
                    id: true,
                    visitorName: true,
                    startTime: true,
                    endTime: true,
                    status: true,
                    profile: {
                        select: { displayName: true, timezone: true },
                    },
                    serviceOffering: {
                        select: { name: true },
                    },
                },
            }),
        })

        if (!owned.ok) return dependencies.ownershipRefusalResponse(owned.refusal)

        const booking = owned.value.resource
        const ics = dependencies.buildIcs({
            name: booking.profile.displayName,
            timezone: booking.profile.timezone || 'UTC',
            events: [{
                id: booking.id,
                title: `${booking.serviceOffering.name} with ${booking.profile.displayName}`,
                description: `${booking.serviceOffering.name}\n${booking.visitorName}`,
                start: booking.startTime,
                end: booking.endTime,
                status: booking.status,
            }],
        })

        return dependencies.icsResponse(ics, 'booking.ics')
    }
}

export const GET = createBookingEventGet()
