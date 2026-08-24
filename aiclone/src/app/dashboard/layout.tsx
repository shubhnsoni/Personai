import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client"
import { emptyNavCounts, getNavCounts } from "@/lib/nav-counts"
import { extrasOf } from "@/lib/surfaces"

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await syncUser()

    if (!user) {
        redirect("/sign-in")
    }

    if (user.profiles.length === 0) {
        redirect("/onboarding")
    }

    const counts = await getNavCounts(user.profiles[0].id).catch(() => emptyNavCounts)

    return (
        <DashboardLayoutClient slug={user.profiles[0].slug} counts={counts} role={user.profiles[0].roleTemplate} extras={extrasOf(user.profiles[0])}>
            {children}
        </DashboardLayoutClient>
    )
}
