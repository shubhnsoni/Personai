import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ContentManager } from "@/components/dashboard/content-manager"

export default async function DashboardContentPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    // Fetch documents (syncUser includes profiles, but maybe not deep relations if not specified)
    // syncUser implementation: include: { profiles: true }
    // So I need to fetch documents separately or update syncUser.
    // Better to fetch here.

    const { prisma } = await import("@/lib/prisma")
    const documents = await prisma.profileDocument.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <ContentManager profileId={profile.id} documents={documents} />
        </div>
    )
}
