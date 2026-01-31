import { prisma } from "@/lib/prisma"

export default async function AdminPage() {
    const [userCount, profileCount, bookingCount, paymentSum] = await Promise.all([
        prisma.user.count(),
        prisma.profile.count(),
        prisma.booking.count(),
        prisma.payment.aggregate({
            where: { status: "SUCCEEDED" as any },
            _sum: { amountCents: true }
        })
    ])

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Users</h3>
                    </div>
                    <div className="text-2xl font-bold">{userCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Profiles</h3>
                    </div>
                    <div className="text-2xl font-bold">{profileCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Bookings</h3>
                    </div>
                    <div className="text-2xl font-bold">{bookingCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Revenue</h3>
                    </div>
                    <div className="text-2xl font-bold">${((paymentSum._sum.amountCents || 0) / 100).toFixed(2)}</div>
                </div>
            </div>
        </div>
    )
}
