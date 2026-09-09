import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { LeadMagnetsList } from "@/components/dashboard/lead-magnets-list"
import { requireShopDigital } from "@/lib/require-surface"

export const dynamic = 'force-dynamic'

export default async function DashboardLeadMagnetsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!user.activeProfile) redirect("/onboarding")

    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    requireShopDigital(profile.roleTemplate, profile)

    const { prisma } = await import("@/lib/prisma")
    const leadMagnets = await prisma.leadMagnet.findMany({
        where: { profileId: profile.id },
        include: {
            _count: {
                select: { submissions: true }
            }
        },
        orderBy: { createdAt: "desc" },
    })

    return (
        <div className="flex-1 space-y-4">
            <LeadMagnetsList profileId={profile.id} leadMagnets={leadMagnets} />
        </div>
    )
}
