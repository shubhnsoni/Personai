import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client"
import { emptyNavCounts, getNavCounts } from "@/lib/nav-counts"
import { extrasOf } from "@/lib/surfaces"
import { cookies } from "next/headers"
import { IMPERSONATE_COOKIE } from "@/lib/admin/impersonate"
import { userIsAdmin } from "@/lib/admin/allowlist"
import { parseLinkStyle, publicShopUrl } from "@/lib/public-url"

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
        redirect(userIsAdmin(user) ? "/admin" : "/onboarding")
    }

    const counts = await getNavCounts(user.profiles[0].id).catch(() => emptyNavCounts)
    const impersonating = userIsAdmin(user) && Boolean((await cookies()).get(IMPERSONATE_COOKIE)?.value)

    return (
        <DashboardLayoutClient
            slug={user.profiles[0].slug}
            liveHref={publicShopUrl(user.profiles[0].slug, parseLinkStyle(user.profiles[0].linkStyle))}
            name={user.profiles[0].displayName}
            counts={counts}
            role={user.profiles[0].roleTemplate}
            extras={extrasOf(user.profiles[0])}
            impersonating={impersonating}
            isAdmin={userIsAdmin(user)}
        >
            {children}
        </DashboardLayoutClient>
    )
}
