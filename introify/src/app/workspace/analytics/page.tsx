import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { listCreations } from "@/lib/creations"
import { listProfileJobRuns } from "@/lib/creation-jobs"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const [creations, runs] = await Promise.all([
        listCreations(user.activeProfile.id),
        listProfileJobRuns(user.activeProfile.id),
    ])
    const done = runs.filter((run) => run.status === "done").length
    return (
        <div className="w-page">
            <h1 className="w-h1">Activity</h1>
            <p className="w-lede">Only counts we can defend. Empty vanity dashboards stay out of Phase 1.</p>
            <ul className="w-card-grid">
                <li className="w-creation-card"><div><h2>{creations.length}</h2><p>AIs</p></div></li>
                <li className="w-creation-card"><div><h2>{done}</h2><p>Completed jobs</p></div></li>
            </ul>
        </div>
    )
}
