import { redirect, notFound } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { LeadMagnetForm } from "@/components/dashboard/lead-magnet-form"

export const dynamic = 'force-dynamic'

interface EditLeadMagnetPageProps {
    params: Promise<{ id: string }>
}

export default async function EditLeadMagnetPage({ params }: EditLeadMagnetPageProps) {
    const { id } = await params
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const leadMagnet = await prisma.leadMagnet.findUnique({
        where: { id },
    })

    if (!leadMagnet || leadMagnet.profileId !== profile.id) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="max-w-2xl mx-auto">
                <LeadMagnetForm profileId={profile.id} leadMagnet={leadMagnet} />
            </div>
        </div>
    )
}
