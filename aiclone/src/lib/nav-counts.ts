import { prisma } from "@/lib/prisma"

export type NavCounts = {
    conversations: number
    leads: number
    leadsNew: number
    bookings: number
    orders: number
    payments: number
    services: number
    products: number
    courses: number
    events: number
    communities: number
    content: number
    links: number
    leadMagnets: number
    sparks: Record<string, number[]>
}

export const emptyNavCounts: NavCounts = {
    conversations: 0,
    leads: 0,
    leadsNew: 0,
    bookings: 0,
    orders: 0,
    payments: 0,
    services: 0,
    products: 0,
    courses: 0,
    events: 0,
    communities: 0,
    content: 0,
    links: 0,
    leadMagnets: 0,
    sparks: {},
}

export async function getNavCounts(profileId: string): Promise<NavCounts> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    try {
    const [
        conversations,
        leads,
        leadsNew,
        bookings,
        orders,
        payments,
        services,
        products,
        courses,
        events,
        communities,
        content,
        links,
        leadMagnets,
        chatDays,
        leadDays,
        bookDays,
        payDays,
        buyDays,
        enrollDays,
        eventDays,
    ] = await Promise.all([
        prisma.conversation.count({ where: { profileId } }),
        prisma.visitorLead.count({ where: { profileId } }),
        prisma.visitorLead.count({ where: { profileId, createdAt: { gte: weekAgo } } }),
        prisma.booking.count({ where: { profileId, startTime: { gte: new Date() } } }),
        prisma.productPurchase.count({
            where: { product: { profileId }, status: "COMPLETED" },
        }),
        prisma.payment.count({ where: { profileId, status: "SUCCEEDED" } }),
        prisma.serviceOffering.count({ where: { profileId } }),
        prisma.digitalProduct.count({ where: { profileId } }),
        prisma.course.count({ where: { profileId } }),
        prisma.event.count({ where: { profileId } }),
        prisma.community.count({ where: { profileId } }),
        prisma.profileDocument.count({ where: { profileId } }),
        prisma.shortLink.count({ where: { profileId } }),
        prisma.leadMagnet.count({ where: { profileId } }),
        prisma.conversation.findMany({
            where: { profileId, startedAt: { gte: weekAgo } },
            select: { startedAt: true },
        }),
        prisma.visitorLead.findMany({
            where: { profileId, createdAt: { gte: weekAgo } },
            select: { createdAt: true },
        }),
        prisma.booking.findMany({
            where: { profileId, createdAt: { gte: weekAgo } },
            select: { createdAt: true },
        }),
        prisma.payment.findMany({
            where: { profileId, status: "SUCCEEDED", createdAt: { gte: weekAgo } },
            select: { createdAt: true },
        }),
        prisma.productPurchase.findMany({
            where: { product: { profileId }, status: "COMPLETED", createdAt: { gte: weekAgo } },
            select: { createdAt: true },
        }),
        prisma.courseEnrollment.findMany({
            where: { course: { profileId }, enrolledAt: { gte: weekAgo } },
            select: { enrolledAt: true },
        }),
        prisma.eventRegistration.findMany({
            where: { event: { profileId }, createdAt: { gte: weekAgo } },
            select: { createdAt: true },
        }),
    ])

    const days = lastSevenDays()
    const sparks: Record<string, number[]> = {
        "/dashboard": spark(chatDays.map((d) => d.startedAt), days),
        "/dashboard/inbox": spark(chatDays.map((d) => d.startedAt), days),
        "/dashboard/leads": spark(leadDays.map((d) => d.createdAt), days),
        "/dashboard/calendar": spark(bookDays.map((d) => d.createdAt), days),
        "/dashboard/services": spark(bookDays.map((d) => d.createdAt), days),
        "/dashboard/money": spark(payDays.map((d) => d.createdAt), days),
        "/dashboard/products": spark(buyDays.map((d) => d.createdAt), days),
        "/dashboard/courses": spark(enrollDays.map((d) => d.enrolledAt), days),
        "/dashboard/events": spark(eventDays.map((d) => d.createdAt), days),
    }

    return {
        conversations,
        leads,
        leadsNew,
        bookings,
        orders,
        payments,
        services,
        products,
        courses,
        events,
        communities,
        content,
        links,
        leadMagnets,
        sparks,
    }
    } catch {
        return emptyNavCounts
    }
}

function lastSevenDays() {
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - i)
        days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    }
    return days
}

function spark(dates: Date[], days: string[]) {
    const map = Object.fromEntries(days.map((d) => [d, 0]))
    for (const date of dates) {
        const d = new Date(date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        if (key in map) map[key] += 1
    }
    return days.map((d) => map[d])
}

export function countForHref(counts: NavCounts, href: string): { value: number; fresh?: number; spark?: number[] } | null {
    let stat: { value: number; fresh?: number } | null = null
    switch (href) {
        case "/dashboard":
            stat = { value: counts.conversations }
            break
        case "/dashboard/profile":
            stat = { value: counts.content }
            break
        case "/dashboard/inbox":
            stat = { value: counts.conversations }
            break
        case "/dashboard/conversations":
            stat = { value: counts.conversations }
            break
        case "/dashboard/leads":
            stat = { value: counts.leads, fresh: counts.leadsNew }
            break
        case "/dashboard/money":
            stat = { value: counts.orders }
            break
        case "/dashboard/products":
            stat = { value: counts.products }
            break
        case "/dashboard/calendar":
            stat = { value: counts.bookings }
            break
        case "/dashboard/orders":
            stat = { value: counts.orders }
            break
        case "/dashboard/payments":
            stat = { value: counts.payments }
            break
        case "/dashboard/services":
            stat = { value: counts.services }
            break
        case "/dashboard/courses":
            stat = { value: counts.courses }
            break
        case "/dashboard/events":
            stat = { value: counts.events }
            break
        case "/dashboard/community":
            stat = { value: counts.communities }
            break
        case "/dashboard/content":
            stat = { value: counts.content }
            break
        case "/dashboard/links":
            stat = { value: counts.links }
            break
        case "/dashboard/lead-magnets":
            stat = { value: counts.leadMagnets }
            break
        default:
            stat = null
    }
    if (!stat) return null
    const series = counts.sparks?.[href]
    return series ? { ...stat, spark: series } : stat
}
