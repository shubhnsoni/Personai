import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ServicesManager } from "@/components/dashboard/services-manager"

export default async function DashboardServicesPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const services = await prisma.serviceOffering.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <ServicesManager profileId={profile.id} services={services} />
        </div>
    )
}
