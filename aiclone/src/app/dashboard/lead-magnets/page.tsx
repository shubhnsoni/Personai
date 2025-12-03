import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { LeadMagnetsList } from "@/components/dashboard/lead-magnets-list"

export default async function DashboardLeadMagnetsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

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
        <div className="flex-1 space-y-4 p-8 pt-6">
            <LeadMagnetsList profileId={profile.id} leadMagnets={leadMagnets} />
        </div>
    )
}
