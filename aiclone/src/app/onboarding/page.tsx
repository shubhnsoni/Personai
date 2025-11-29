import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export default async function OnboardingPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    if (user.profiles.length > 0) {
        redirect("/dashboard")
    }

    const presets = await prisma.welcomeAnimationPreset.findMany()

    return <OnboardingWizard presets={presets} userId={user.id} />
}
