import Link from "@/components/navigation/transition-link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client"
import { emptyNavCounts, getNavCounts } from "@/lib/nav-counts"
import { extrasOf } from "@/lib/surfaces"
import { cookies } from "next/headers"
import { IMPERSONATE_COOKIE } from "@/lib/admin/impersonate"
import { userIsAdmin } from "@/lib/admin/allowlist"
import { parseLinkStyle, publicShopUrl } from "@/lib/public-url"
import { isHotelRole } from "@/lib/hotels"
import { loadHotelStaffRole } from "@/lib/hotels/desk-access"
import { prisma } from "@/lib/prisma"

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
    let hotelStaffRole: import("@/lib/hotels").HotelStaffRole | null = null
    if (isHotelRole(user.activeProfile.roleTemplate)) {
        const property = await prisma.hotelProperty.findUnique({
            where: { profileId: user.activeProfile.id },
            select: { staffJson: true },
        })
        const access = user.profileAccess[user.activeProfile.id]
        hotelStaffRole = await loadHotelStaffRole({
            userId: user.id,
            profileId: user.activeProfile.id,
            profileUserId: user.activeProfile.userId,
            workspaceRole: access?.role,
            owner: access?.owner,
            staffJson: property?.staffJson,
        })
    }

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
            hotelStaffRole={hotelStaffRole}
        >
            {children}
        </DashboardLayoutClient>
    )
}
