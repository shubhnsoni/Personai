import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"

export default async function DashboardPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")

    const [conversationCount, leadCount, bookingCount, paymentSum] = await Promise.all([
        prisma.conversation.count({ where: { profileId: profile.id } }),
        prisma.visitorLead.count({ where: { profileId: profile.id } }),
        prisma.booking.count({ where: { profileId: profile.id } }),
        prisma.payment.aggregate({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            where: { profileId: profile.id, status: "SUCCEEDED" as any },
            _sum: { amountCents: true }
        })
    ])

    return (
        <div className="space-y-4 p-8 pt-6">
            <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Conversations</h3>
                    </div>
                    <div className="text-2xl font-bold">{conversationCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Leads</h3>
                    </div>
                    <div className="text-2xl font-bold">{leadCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Bookings</h3>
                    </div>
                    <div className="text-2xl font-bold">{bookingCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Revenue</h3>
                    </div>
                    <div className="text-2xl font-bold">${((paymentSum._sum.amountCents || 0) / 100).toFixed(2)}</div>
                </div>
            </div>
        </div>
    )
}
