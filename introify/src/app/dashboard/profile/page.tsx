import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { YouStudio } from "@/components/dashboard/you-studio"

export const dynamic = "force-dynamic"

export default async function DashboardProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = await prisma.profile.findUnique({
        where: { id: user.profiles[0].id },
        include: {
            workExperiences: true,
            projects: true,
        },
    })

    if (!profile) redirect("/onboarding")

    const [presets, documents] = await Promise.all([
        prisma.welcomeAnimationPreset.findMany(),
        prisma.profileDocument.findMany({
            where: { profileId: profile.id },
            orderBy: { createdAt: "desc" },
        }),
    ])

    const { tab } = await searchParams
    const defaultTab =
        tab === "import" ? "import" : tab === "story" ? "story" : tab === "knowledge" || tab === "brain" ? "knowledge" : "profile"

    return (
        <YouStudio
            defaultTab={defaultTab}
            profile={profile}
            presets={presets}
            documents={documents}
        />
    )
}
