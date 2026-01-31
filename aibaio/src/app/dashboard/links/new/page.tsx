import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ShortLinkForm } from "@/components/dashboard/short-link-form"

export default async function NewShortLinkPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="max-w-2xl mx-auto">
                <ShortLinkForm profileId={profile.id} />
            </div>
        </div>
    )
}
