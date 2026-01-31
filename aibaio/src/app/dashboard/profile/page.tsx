import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { ProfileEditor } from "@/components/dashboard/profile-editor"

export default async function DashboardProfilePage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = await prisma.profile.findUnique({
        where: { id: user.profiles[0].id },
        include: {
            workExperiences: true,
            projects: true
        }
    })

    if (!profile) redirect("/onboarding")

    const presets = await prisma.welcomeAnimationPreset.findMany()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <ProfileEditor profile={profile} presets={presets} />
        </div>
    )
}
