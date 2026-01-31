import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { EventsList } from "@/components/dashboard/events-list"

export default async function DashboardEventsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    const { prisma } = await import("@/lib/prisma")
    const events = await prisma.event.findMany({
        where: { profileId: profile.id },
        orderBy: { startTime: "desc" },
        include: {
            _count: {
                select: {
                    registrations: true,
                }
            }
        }
    })

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <EventsList profileId={profile.id} events={events} />
        </div>
    )
}
