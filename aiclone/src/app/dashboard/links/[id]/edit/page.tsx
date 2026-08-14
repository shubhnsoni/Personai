import { redirect, notFound } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ShortLinkForm } from "@/components/dashboard/short-link-form"

export const dynamic = 'force-dynamic'

interface EditShortLinkPageProps {
    params: Promise<{ id: string }>
}

export default async function EditShortLinkPage({ params }: EditShortLinkPageProps) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { id } = await params

    const { prisma } = await import("@/lib/prisma")
    const shortLink = await prisma.shortLink.findFirst({
        where: {
            id,
            profileId: profile.id,
        },
    })

    if (!shortLink) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="max-w-2xl mx-auto">
                <ShortLinkForm profileId={profile.id} shortLink={shortLink} />
            </div>
        </div>
    )
}
