import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { CommunitiesList } from "@/components/dashboard/communities-list"

export default async function DashboardCommunityPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const communities = await prisma.community.findMany({
        where: { profileId: profile.id },
        include: {
            _count: {
                select: { members: true }
            }
        },
        orderBy: { createdAt: "desc" },
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <CommunitiesList profileId={profile.id} communities={communities} />
        </div>
    )
}
