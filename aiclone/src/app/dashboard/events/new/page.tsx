import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { EventForm } from "@/components/dashboard/event-form"

export const dynamic = 'force-dynamic'

export default async function NewEventPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="max-w-2xl mx-auto">
                <EventForm profileId={profile.id} />
            </div>
        </div>
    )
}
