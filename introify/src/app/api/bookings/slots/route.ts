import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const date = searchParams.get('date') // YYYY-MM-DD

    if (!profileId || !date) {
        return NextResponse.json({ error: 'Missing profileId or date' }, { status: 400 })
    }

    const dayStart = new Date(`${date}T00:00:00Z`)
    const dayEnd = new Date(`${date}T23:59:59Z`)

    const bookings = await prisma.booking.findMany({
        where: {
            profileId,
            startTime: { gte: dayStart, lte: dayEnd },
            status: { not: 'CANCELLED' },
        },
        select: { startTime: true },
    })

    const bookedSlots = bookings.map(b => {
        const d = new Date(b.startTime)
        return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
    })

    return NextResponse.json({ bookedSlots })
}
