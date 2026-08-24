import { prisma } from "@/lib/prisma"
import { calendarNoun, extrasOf, hasSurface } from "@/lib/surfaces"

export type HomeSeriesPoint = {
    date: string
    visits: number
    conversations: number
    leads: number
    revenue: number
}

export type HomeStats = {
    visits: number
    visits7: number
    chats: number
    chats30: number
    leads?: number
    leads7?: number
    bookings?: number
    upcoming?: number
    bookingNoun: string
    revenueCents?: number
    sales?: number
    menuViews?: number
    reserves?: number
    enrollments?: number
    series: HomeSeriesPoint[]
    funnel: { visits: number; chats: number; leads: number; buys: number }
    sources: { ref: string; n: number }[]
    unanswered: number
}

function dayKey(d: Date) {
    return new Date(d).toISOString().split("T")[0]
}

function lastDays(n: number) {
    const now = Date.now()
    const days: string[] = []
    for (let i = n - 1; i >= 0; i--) {
        days.push(dayKey(new Date(now - i * 86400000)))
    }
    return days
}

function countByDay(dates: Date[]) {
    const map: Record<string, number> = {}
    for (const d of dates) map[dayKey(d)] = (map[dayKey(d)] || 0) + 1
    return map
}

export async function buildHomeStats(profile: {
    id: string
    roleTemplate: string
    personalityConfig?: string | null
}): Promise<HomeStats> {
    const extras = extrasOf(profile)
    const role = profile.roleTemplate
    const now = new Date()
    const thirty = new Date(now.getTime() - 30 * 86400000)
    const seven = new Date(now.getTime() - 7 * 86400000)
    const showLeads = hasSurface(role, "leads", extras)
    const showCal = hasSurface(role, "calendar", extras)
    const showSales = hasSurface(role, "sales", extras)
    const showShop = hasSurface(role, "shop", extras)
    const restaurant = role === "RESTAURANT"
    const showCourses = hasSurface(role, "courses", extras)

    const [
        visits,
        visits7,
        chats,
        chats30,
        leadCount,
        leads7,
        bookingCount,
        upcoming,
        paymentSum,
        purchases,
        enrollments,
        visitRows,
        convRows,
        leadRows,
        payRows,
        waiting,
        sourceRows,
        menuViews,
        reserves,
    ] = await Promise.all([
        prisma.profileEvent.count({ where: { profileId: profile.id, name: "visit" } }).catch(() => 0),
        prisma.profileEvent.count({ where: { profileId: profile.id, name: "visit", createdAt: { gte: seven } } }).catch(() => 0),
        prisma.conversation.count({ where: { profileId: profile.id } }),
        prisma.conversation.count({ where: { profileId: profile.id, startedAt: { gte: thirty } } }),
        showLeads ? prisma.visitorLead.count({ where: { profileId: profile.id } }) : Promise.resolve(0),
        showLeads ? prisma.visitorLead.count({ where: { profileId: profile.id, createdAt: { gte: seven } } }) : Promise.resolve(0),
        showCal ? prisma.booking.count({ where: { profileId: profile.id } }) : Promise.resolve(0),
        showCal ? prisma.booking.count({ where: { profileId: profile.id, startTime: { gte: now } } }) : Promise.resolve(0),
        showSales
            ? prisma.payment.aggregate({ where: { profileId: profile.id, status: "SUCCEEDED" }, _sum: { amountCents: true } })
            : Promise.resolve({ _sum: { amountCents: 0 } }),
        showSales
            ? prisma.productPurchase.count({ where: { product: { profileId: profile.id }, status: "COMPLETED" } })
            : Promise.resolve(0),
        showCourses
            ? prisma.courseEnrollment.count({ where: { course: { profileId: profile.id }, status: { in: ["ACTIVE", "COMPLETED"] } } })
            : Promise.resolve(0),
        prisma.profileEvent.findMany({
            where: { profileId: profile.id, name: "visit", createdAt: { gte: thirty } },
            select: { createdAt: true },
        }).catch(() => [] as { createdAt: Date }[]),
        prisma.conversation.findMany({
            where: { profileId: profile.id, startedAt: { gte: thirty } },
            select: { startedAt: true },
        }),
        showLeads
            ? prisma.visitorLead.findMany({
                where: { profileId: profile.id, createdAt: { gte: thirty } },
                select: { createdAt: true },
            })
            : Promise.resolve([] as { createdAt: Date }[]),
        showSales
            ? prisma.payment.findMany({
                where: { profileId: profile.id, status: "SUCCEEDED", createdAt: { gte: thirty } },
                select: { amountCents: true, createdAt: true },
            })
            : Promise.resolve([] as { amountCents: number; createdAt: Date }[]),
        prisma.conversation.findMany({
            where: { profileId: profile.id, lastMessageAt: { gte: thirty } },
            select: { messages: { take: 1, orderBy: { createdAt: "desc" }, select: { role: true } } },
        }),
        prisma.profileEvent.findMany({
            where: { profileId: profile.id, createdAt: { gte: thirty } },
            select: { ref: true },
        }).catch(() => [] as { ref: string | null }[]),
        restaurant
            ? prisma.profileEvent.count({ where: { profileId: profile.id, name: "menu_view" } }).catch(() => 0)
            : Promise.resolve(0),
        restaurant
            ? prisma.profileEvent.count({ where: { profileId: profile.id, name: "reserve_open" } }).catch(() => 0)
            : Promise.resolve(0),
    ])

    const days = lastDays(30)
    const visitDay = countByDay(visitRows.map((r) => r.createdAt))
    const chatDay = countByDay(convRows.map((r) => r.startedAt))
    const leadDay = countByDay(leadRows.map((r) => r.createdAt))
    const revDay: Record<string, number> = {}
    for (const p of payRows) {
        const k = dayKey(p.createdAt)
        revDay[k] = (revDay[k] || 0) + p.amountCents / 100
    }

    const series = days.map((date) => ({
        date,
        visits: visitDay[date] || 0,
        conversations: chatDay[date] || 0,
        leads: leadDay[date] || 0,
        revenue: revDay[date] || 0,
    }))

    const sourceMap = new Map<string, number>()
    for (const row of sourceRows) {
        const key = (row.ref || "direct").slice(0, 40)
        sourceMap.set(key, (sourceMap.get(key) || 0) + 1)
    }
    const sources = [...sourceMap.entries()]
        .map(([ref, n]) => ({ ref, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5)

    const unanswered = waiting.filter((c) => c.messages[0]?.role === "user").length
    const revenueCents = paymentSum._sum.amountCents || 0
    const sales = purchases + enrollments

    return {
        visits,
        visits7,
        chats,
        chats30,
        leads: showLeads ? leadCount : undefined,
        leads7: showLeads ? leads7 : undefined,
        bookings: showCal ? bookingCount : undefined,
        upcoming: showCal ? upcoming : undefined,
        bookingNoun: calendarNoun(role),
        revenueCents: showSales ? revenueCents : undefined,
        sales: showSales ? sales : undefined,
        menuViews: restaurant && showShop ? menuViews : undefined,
        reserves: restaurant && showCal ? reserves : undefined,
        enrollments: showCourses ? enrollments : undefined,
        series,
        funnel: { visits, chats, leads: leadCount, buys: sales },
        sources,
        unanswered,
    }
}
