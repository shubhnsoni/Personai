import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { needById, needByRole, type NeedId } from "@/lib/onboarding-needs"

export const dynamic = "force-dynamic"

export default async function QaOnboardPage({
    searchParams,
}: {
    searchParams: Promise<{ need?: string; role?: string }>
}) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const q = await searchParams
    const picked = q.need ? needById(q.need) : q.role ? needByRole(q.role) : needById("page")
    const presets = await prisma.welcomeAnimationPreset.findMany()

    return (
        <OnboardingWizard
            presets={presets}
            userId={user.id}
            suggestedName={picked.title}
            initialNeed={picked.id as NeedId}
            activate
        />
    )
}
