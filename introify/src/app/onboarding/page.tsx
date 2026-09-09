import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { userIsAdmin } from "@/lib/admin/allowlist"

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
    searchParams,
}: {
    searchParams: Promise<{ shop?: string; billingAccountId?: string }>
}) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const { shop, billingAccountId } = await searchParams
    if (user.profiles.length > 0 && !billingAccountId) redirect("/dashboard")
    if (billingAccountId) {
        const account = await prisma.billingAccount.findUnique({ where: { id: billingAccountId }, select: { ownerUserId: true } })
        if (!account || account.ownerUserId !== user.id) redirect("/dashboard/team")
    }
    if (userIsAdmin(user) && shop !== "1") {
        redirect("/admin")
    }

    const presets = await prisma.welcomeAnimationPreset.findMany()

    return <OnboardingWizard activate billingAccountId={billingAccountId} presets={presets} suggestedName={user.name || ""} />
}
