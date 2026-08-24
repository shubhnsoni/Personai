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

    const [productPurchases, courseEnrollments, eventRegistrations, communityMembers, bookings, payments] = await Promise.all([
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

    for (const p of productPurchases) {
        touch(p.visitorEmail, p.visitorName, {
            id: p.id,
            kind: "product",
            title: p.product.title,
            status: p.status,
            amountCents: p.status === "REFUNDED" ? 0 : p.paymentId ? paidFor(p.paymentId, p.product.priceCents) : p.product.priceCents,
            at: p.createdAt.toISOString(),
            receiptHref: `/dashboard/orders/${p.id}/receipt`,
            canConfirm: p.status === "PENDING",
        })
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

    const stripeRevenue = payments.reduce((sum, p) => sum + p.amountCents, 0)
    const cashRevenue = productPurchases
        .filter((p) => p.status === "COMPLETED" && !p.paymentId)
        .reduce((sum, p) => sum + p.product.priceCents, 0)
    const totalRevenue = stripeRevenue + cashRevenue

    return (
        <MoneyBoard
            people={[...peopleMap.values()]}
            stats={{
                revenueCents: totalRevenue,
                products: productPurchases.filter((p) => p.status === "COMPLETED").length,
                courses: courseEnrollments.length,
                events: eventRegistrations.length,
                members: communityMembers.filter((m) => m.status === "ACTIVE").length,
            }}
        />
    )
}
