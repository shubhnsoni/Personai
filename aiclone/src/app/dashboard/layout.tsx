import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client"

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

    return (
        <DashboardLayoutClient slug={user.profiles[0].slug}>
            {children}
        </DashboardLayoutClient>
    )
}
