import { redirect, notFound } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { EventForm } from "@/components/dashboard/event-form"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "events", profile)

    const { id } = await params
    const { prisma } = await import("@/lib/prisma")
    const event = await prisma.event.findFirst({
        where: { id, profileId: profile.id },
    })

    if (!event) notFound()

    return (
        <div className="flex-1 space-y-4">
            <div className="max-w-2xl mx-auto">
                <EventForm profileId={profile.id} event={event} embedded />
            </div>
        </div>
    )
}
