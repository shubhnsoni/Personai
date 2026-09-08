import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ShortLinksList } from "@/components/dashboard/short-links-list"

export const dynamic = 'force-dynamic'

export default async function DashboardLinksPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const shortLinks = await prisma.shortLink.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <ShortLinksList profileId={profile.id} shortLinks={shortLinks} />
        </div>
    )
}
