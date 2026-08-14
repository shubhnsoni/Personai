import { redirect, notFound } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { CommunityForm } from "@/components/dashboard/community-form"

export const dynamic = 'force-dynamic'

interface EditCommunityPageProps {
    params: Promise<{ id: string }>
}

export default async function EditCommunityPage({ params }: EditCommunityPageProps) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { id } = await params

    const { prisma } = await import("@/lib/prisma")
    const community = await prisma.community.findFirst({
        where: {
            id,
            profileId: profile.id,
        },
    })

    if (!community) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="max-w-2xl mx-auto">
                <CommunityForm profileId={profile.id} community={community} />
            </div>
        </div>
    )
}
