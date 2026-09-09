import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { CourseForm } from "@/components/dashboard/course-form"

export const dynamic = 'force-dynamic'

export default async function NewCoursePage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!user.activeProfile) redirect("/onboarding")

    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")

    return (
        <div className="flex-1 space-y-4">
            <div className="max-w-2xl mx-auto">
                <CourseForm profileId={profile.id} />
            </div>
        </div>
    )
}
