import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { userIsAdmin } from "@/lib/admin/allowlist"

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
    searchParams,
}: {
    searchParams: Promise<{ shop?: string }>
}) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    if (user.profiles.length > 0) {
        redirect("/dashboard")
    }

    const { shop } = await searchParams
    if (userIsAdmin(user) && shop !== "1") {
        redirect("/admin")
    }

    const presets = await prisma.welcomeAnimationPreset.findMany()

    return <OnboardingWizard presets={presets} suggestedName={user.name || ""} />
}
