import Link from "next/link"
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

    if (!user.activeProfile) {
        return <div className="mx-auto max-w-5xl px-4 py-8"><nav className="mb-8 flex gap-5 text-sm"><Link href="/dashboard/team">Team</Link><Link href="/dashboard/billing">Billing</Link><Link href="/onboarding">Create a business</Link></nav>{children}</div>
    }

    const counts = await getNavCounts(user.activeProfile.id).catch(() => emptyNavCounts)
    const impersonating = userIsAdmin(user) && Boolean((await cookies()).get(IMPERSONATE_COOKIE)?.value)

    return (
        <DashboardLayoutClient
            activeProfileId={user.activeProfile.id}
            businesses={user.accessibleProfiles.map((profile) => ({ id: profile.id, name: profile.displayName, role: user.profileAccess[profile.id]?.role || "VIEWER" }))}
            slug={user.activeProfile.slug}
            liveHref={publicShopUrl(user.activeProfile.slug, parseLinkStyle(user.activeProfile.linkStyle))}
            name={user.activeProfile.displayName}
            counts={counts}
            role={user.activeProfile.roleTemplate}
            extras={extrasOf(user.activeProfile)}
            impersonating={impersonating}
            isAdmin={userIsAdmin(user)}
        >
            {children}
        </DashboardLayoutClient>
    )
}
