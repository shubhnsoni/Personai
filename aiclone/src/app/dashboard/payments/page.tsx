import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { PaymentsList } from "@/components/dashboard/payments-list"

export const dynamic = 'force-dynamic'

export default async function DashboardPaymentsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const payments = await prisma.payment.findMany({
        where: { profileId: profile.id },
        include: {
            booking: {
                include: { serviceOffering: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Payments</h2>
            </div>
            <PaymentsList payments={payments} />
        </div>
    )
}
