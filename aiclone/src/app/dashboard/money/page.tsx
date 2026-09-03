import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { MoneyBoard, type MoneyPerson } from "@/components/dashboard/money-board"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

export default async function DashboardMoneyPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "sales", profile)
    if (profile.roleTemplate === "RESTAURANT") redirect("/dashboard/orders")
    const restaurant = false

    const [restaurantOrders, productPurchases, courseEnrollments, eventRegistrations, communityMembers, bookings, payments] = await Promise.all([
        prisma.order.findMany({
            where: { profileId: profile.id },
            include: { lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
            orderBy: { placedAt: "desc" },
        }),
        prisma.productPurchase.findMany({
            where: { product: { profileId: profile.id } },
            include: { product: true },
            orderBy: { createdAt: "desc" },
        }),
        prisma.courseEnrollment.findMany({
            where: { course: { profileId: profile.id } },
            include: { course: true },
            orderBy: { enrolledAt: "desc" },
        }),
        prisma.eventRegistration.findMany({
            where: { event: { profileId: profile.id } },
            include: { event: true },
            orderBy: { createdAt: "desc" },
        }),
        prisma.communityMember.findMany({
            where: { community: { profileId: profile.id } },
            include: { community: true },
            orderBy: { createdAt: "desc" },
        }),
        prisma.booking.findMany({
            where: { profileId: profile.id },
            include: { serviceOffering: true },
            orderBy: { createdAt: "desc" },
        }),
        prisma.payment.findMany({
            where: { profileId: profile.id, status: "SUCCEEDED" },
        }),
    ])

    const paidByProvider = new Map(payments.map((p) => [p.providerPaymentId || p.id, p.amountCents]))
    const paidByBooking = new Map(payments.filter((p) => p.bookingId).map((p) => [p.bookingId as string, p.amountCents]))

    const paidFor = (paymentId: string | null | undefined, fallback = 0) => {
        if (!paymentId) return 0
        return paidByProvider.get(paymentId) ?? fallback
    }

    const peopleMap = new Map<string, MoneyPerson>()
    const touch = (email: string, name: string | null | undefined, item: MoneyPerson["items"][number]) => {
        if (!email || email === "hold@local") return
        const key = email.toLowerCase()
        const cur = peopleMap.get(key) || { email, name: name || email, items: [] }
        if (name && cur.name === cur.email) cur.name = name
        cur.items.push(item)
        peopleMap.set(key, cur)
    }

    if (restaurant) {
        for (const order of restaurantOrders) {
            if (!order.guestEmail) continue
            const summary = order.lines.map((line) => `${line.qty}× ${line.titleSnapshot}`).join(", ")
            touch(order.guestEmail, order.guestName, {
                id: order.id,
                kind: "product",
                title: `Order #${order.number}${summary ? ` · ${summary}` : ""}`,
                status: order.status,
                amountCents: order.status === "CANCELLED" ? 0 : order.totalCents,
                at: order.placedAt.toISOString(),
                receiptHref: `/dashboard/orders/${order.id}/receipt`,
            })
        }
    } else {
        for (const purchase of productPurchases) {
            touch(purchase.visitorEmail, purchase.visitorName, {
                id: purchase.id,
                kind: "product",
                title: purchase.product.title,
                status: purchase.status,
                amountCents: purchase.status === "REFUNDED" ? 0 : purchase.paymentId ? paidFor(purchase.paymentId, purchase.product.priceCents) : purchase.product.priceCents,
                at: purchase.createdAt.toISOString(),
                receiptHref: `/dashboard/orders/${purchase.id}/receipt`,
                canConfirm: purchase.status === "PENDING",
            })
        }
    }
    for (const e of courseEnrollments) {
        touch(e.visitorEmail, e.visitorName, {
            id: e.id,
            kind: "course",
            title: e.course.title,
            status: e.status,
            amountCents: e.status === "CANCELLED" ? 0 : paidFor(e.paymentId, e.paymentId ? e.course.priceCents : 0),
            at: e.enrolledAt.toISOString(),
        })
    }
    for (const r of eventRegistrations) {
        touch(r.visitorEmail, r.visitorName, {
            id: r.id,
            kind: "event",
            title: r.event.title,
            status: r.status,
            amountCents: r.status === "CANCELLED" ? 0 : paidFor(r.paymentId, r.paymentId ? r.event.priceCents : 0),
            at: r.createdAt.toISOString(),
        })
    }
    for (const m of communityMembers) {
        touch(m.visitorEmail, m.visitorName, {
            id: m.id,
            kind: "room",
            title: m.community.name,
            status: m.status,
            amountCents: m.status === "CANCELLED" ? 0 : paidFor(m.paymentId, m.paymentId ? m.community.priceCents : 0),
            at: m.createdAt.toISOString(),
        })
    }
    for (const b of bookings) {
        touch(b.visitorEmail, b.visitorName, {
            id: b.id,
            kind: "call",
            title: b.serviceOffering.name,
            status: b.status,
            amountCents: b.status === "CANCELLED" ? 0 : (paidByBooking.get(b.id) ?? (b.paymentId ? b.serviceOffering.priceCents : 0)),
            at: b.createdAt.toISOString(),
        })
    }

    const stripeRevenue = payments.reduce((sum, payment) => sum + payment.amountCents, 0)
    const legacyCashRevenue = productPurchases
        .filter((purchase) => purchase.status === "COMPLETED" && !purchase.paymentId)
        .reduce((sum, purchase) => sum + purchase.product.priceCents, 0)
    const restaurantRevenue = restaurantOrders
        .filter((order) => order.status === "PAID" && order.payStatus === "PAID")
        .reduce((sum, order) => sum + order.totalCents, 0)
    const totalRevenue = restaurant ? restaurantRevenue : stripeRevenue + legacyCashRevenue
    const productsSold = restaurant
        ? restaurantOrders
            .filter((order) => order.status === "PAID" && order.payStatus === "PAID")
            .reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.qty, 0), 0)
        : productPurchases.filter((purchase) => purchase.status === "COMPLETED").length

    return (
        <MoneyBoard
            people={[...peopleMap.values()]}
            stats={{
                revenueCents: totalRevenue,
                products: productsSold,
                courses: courseEnrollments.length,
                events: eventRegistrations.length,
                members: communityMembers.filter((m) => m.status === "ACTIVE").length,
            }}
        />
    )
}
