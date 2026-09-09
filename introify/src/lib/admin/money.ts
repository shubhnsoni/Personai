import { prisma } from "@/lib/prisma"

export const MONEY_KINDS = ["ORDER", "PURCHASE", "BOOKING", "COURSE", "EVENT", "COMMUNITY", "AR", "METAL"] as const
export type MoneyKind = (typeof MONEY_KINDS)[number]

export const CONSUMER_KINDS: MoneyKind[] = ["ORDER", "PURCHASE", "BOOKING", "COURSE", "EVENT", "COMMUNITY"]

export type MoneyEventInput = {
    profileId: string
    kind: MoneyKind
    subjectId: string
    amountCents: number
    currency?: string | null
    payMethod?: string | null
    payStatus: string
    visitorEmail?: string | null
    createdAt?: Date
}

export function formatAdminMoney(amountCents: number, currency = "USD") {
    const code = (currency || "USD").toUpperCase()
    const value = Math.abs(amountCents) / 100
    const formatted = code === "INR"
        ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
        : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const sign = amountCents < 0 ? "-" : ""
    if (code === "INR") return `${sign}₹${formatted}`
    return `${sign}${code} ${formatted}`
}

export async function recordMoneyEvent(input: MoneyEventInput) {
    if (!input.profileId || !input.subjectId) return
    const amountCents = Math.round(Number(input.amountCents) || 0)
    const data = {
        profileId: input.profileId,
        kind: input.kind,
        subjectId: input.subjectId,
        amountCents,
        currency: (input.currency || "USD").toUpperCase().slice(0, 8),
        payMethod: input.payMethod ? String(input.payMethod).toUpperCase().slice(0, 24) : null,
        payStatus: input.payStatus.slice(0, 24),
        visitorEmail: input.visitorEmail?.slice(0, 180) || null,
        createdAt: input.createdAt || new Date(),
    }
    await prisma.moneyEvent.upsert({
        where: { kind_subjectId: { kind: input.kind, subjectId: input.subjectId } },
        create: data,
        update: {
            amountCents: data.amountCents,
            currency: data.currency,
            payMethod: data.payMethod,
            payStatus: data.payStatus,
            visitorEmail: data.visitorEmail,
        },
    }).catch(() => {})
}

const PAID = { payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } }

export async function moneyTotals(since?: Date, kinds: MoneyKind[] = CONSUMER_KINDS) {
    const where = {
        kind: { in: kinds },
        ...PAID,
        ...(since ? { createdAt: { gte: since } } : {}),
    }
    const [agg, count] = await Promise.all([
        prisma.moneyEvent.aggregate({ where, _sum: { amountCents: true } }).catch(() => ({ _sum: { amountCents: 0 } })),
        prisma.moneyEvent.count({ where }).catch(() => 0),
    ])
    return { amountCents: agg._sum.amountCents || 0, count }
}

export async function moneyTotalsByCurrency(since?: Date, kinds: MoneyKind[] = CONSUMER_KINDS) {
    const where = {
        kind: { in: kinds },
        ...PAID,
        ...(since ? { createdAt: { gte: since } } : {}),
    }
    const rows = await prisma.moneyEvent.groupBy({
        by: ["currency"],
        where,
        _sum: { amountCents: true },
        _count: true,
    }).catch((): Array<{ currency: string; _sum: { amountCents: number | null }; _count: number }> => [])
    return rows.map((row) => ({
        currency: (row.currency || "USD").toUpperCase(),
        amountCents: row._sum.amountCents || 0,
        count: row._count,
    }))
}

export async function backfillMoneyEvents() {
    const existing = await prisma.moneyEvent.count().catch(() => -1)
    if (existing !== 0) return existing

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [orders, purchases, bookings, courses, events, communities] = await Promise.all([
        prisma.order.findMany({
            where: { payStatus: "PAID", placedAt: { gte: since } },
            select: {
                id: true,
                profileId: true,
                totalCents: true,
                currency: true,
                payMethod: true,
                payStatus: true,
                guestEmail: true,
                paidAt: true,
                placedAt: true,
            },
            take: 2000,
        }).catch(() => []),
        prisma.productPurchase.findMany({
            where: { status: "COMPLETED", createdAt: { gte: since } },
            select: {
                id: true,
                visitorEmail: true,
                payMethod: true,
                confirmedAt: true,
                createdAt: true,
                product: { select: { profileId: true, priceCents: true, currency: true } },
            },
            take: 2000,
        }).catch(() => []),
        prisma.payment.findMany({
            where: { status: "SUCCEEDED", bookingId: { not: null }, createdAt: { gte: since } },
            select: {
                id: true,
                profileId: true,
                bookingId: true,
                amountCents: true,
                currency: true,
                createdAt: true,
            },
            take: 1000,
        }).catch(() => []),
        prisma.courseEnrollment.findMany({
            where: { paymentId: { not: null }, enrolledAt: { gte: since } },
            select: {
                id: true,
                visitorEmail: true,
                enrolledAt: true,
                course: { select: { profileId: true, priceCents: true, currency: true } },
            },
            take: 1000,
        }).catch(() => []),
        prisma.eventRegistration.findMany({
            where: { paymentId: { not: null }, createdAt: { gte: since } },
            select: {
                id: true,
                visitorEmail: true,
                createdAt: true,
                event: { select: { profileId: true, priceCents: true, currency: true } },
            },
            take: 1000,
        }).catch(() => []),
        prisma.communityMember.findMany({
            where: { paymentId: { not: null }, createdAt: { gte: since } },
            select: {
                id: true,
                visitorEmail: true,
                createdAt: true,
                community: { select: { profileId: true, priceCents: true, currency: true } },
            },
            take: 1000,
        }).catch(() => []),
    ])

    for (const row of orders) {
        await recordMoneyEvent({
            profileId: row.profileId,
            kind: "ORDER",
            subjectId: row.id,
            amountCents: row.totalCents,
            currency: row.currency,
            payMethod: row.payMethod,
            payStatus: "PAID",
            visitorEmail: row.guestEmail,
            createdAt: row.paidAt || row.placedAt,
        })
    }
    for (const row of purchases) {
        await recordMoneyEvent({
            profileId: row.product.profileId,
            kind: "PURCHASE",
            subjectId: row.id,
            amountCents: row.product.priceCents,
            currency: row.product.currency,
            payMethod: row.payMethod || "UPI",
            payStatus: "PAID",
            visitorEmail: row.visitorEmail,
            createdAt: row.confirmedAt || row.createdAt,
        })
    }
    for (const row of bookings) {
        if (!row.bookingId) continue
        await recordMoneyEvent({
            profileId: row.profileId,
            kind: "BOOKING",
            subjectId: row.bookingId,
            amountCents: row.amountCents,
            currency: row.currency,
            payMethod: "STRIPE",
            payStatus: "PAID",
            createdAt: row.createdAt,
        })
    }
    for (const row of courses) {
        await recordMoneyEvent({
            profileId: row.course.profileId,
            kind: "COURSE",
            subjectId: row.id,
            amountCents: row.course.priceCents,
            currency: row.course.currency,
            payMethod: "STRIPE",
            payStatus: "PAID",
            visitorEmail: row.visitorEmail,
            createdAt: row.enrolledAt,
        })
    }
    for (const row of events) {
        await recordMoneyEvent({
            profileId: row.event.profileId,
            kind: "EVENT",
            subjectId: row.id,
            amountCents: row.event.priceCents,
            currency: row.event.currency,
            payMethod: "STRIPE",
            payStatus: "PAID",
            visitorEmail: row.visitorEmail,
            createdAt: row.createdAt,
        })
    }
    for (const row of communities) {
        await recordMoneyEvent({
            profileId: row.community.profileId,
            kind: "COMMUNITY",
            subjectId: row.id,
            amountCents: row.community.priceCents,
            currency: row.community.currency,
            payMethod: "STRIPE",
            payStatus: "PAID",
            visitorEmail: row.visitorEmail,
            createdAt: row.createdAt,
        })
    }

    return prisma.moneyEvent.count().catch(() => 0)
}

export async function ensureMoneyBackfill() {
    const count = await prisma.moneyEvent.count().catch(() => -1)
    if (count === 0) await backfillMoneyEvents()
}

export function shopPipeline(input: {
    isPublic: boolean
    suspendedAt?: Date | null
    setupPending: number
    sessions7d: number
    chats: number
    paid7d: number
    paid14d: number
}) {
    if (input.suspendedAt) return "suspended"
    if (input.paid7d > 0) return "selling"
    if (input.paid14d > 0) return "dormant"
    if (!input.isPublic) return "signed-up"
    if (input.setupPending > 0) return "setup"
    if (input.sessions7d === 0) return "silent"
    if (input.chats === 0) return "no-chat"
    return "no-money"
}
