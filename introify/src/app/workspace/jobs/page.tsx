import Link from "next/link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { jobsEmptyCopy, listProfileJobRuns } from "@/lib/creation-jobs"
import { listCreations } from "@/lib/creations"

export const dynamic = "force-dynamic"

const labels: Record<string, string> = {
    queued: "Queued",
    running: "Running",
    needs_approval: "Needs approval",
    done: "Done",
    failed: "Failed",
}

export default async function JobsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const items = await listProfileJobRuns(user.activeProfile.id)
    const creations = await listCreations(user.activeProfile.id)
    const empty = jobsEmptyCopy(creations.length)

    return (
        <div className="w-page">
            <div className="w-titlebar">
                <div>
                    <h1 className="w-h1">Jobs</h1>
                    <p className="w-lede">Only real runs for your AIs. No marketplace hires.</p>
                </div>
                <Link href="/workspace" className="w-btn secondary">Open an AI</Link>
            </div>
            {items.length === 0 ? (
                <div className="w-empty">
                    <h2>{empty.title}</h2>
                    <p>{empty.body}</p>
                    <Link href={empty.href} className="w-btn">{empty.cta}</Link>
                </div>
            ) : (
                <div className="w-joblist">
                    {items.map((run) => (
                        <Link key={run.id} href={`/workspace/result/${run.id}`} className="w-jobrow">
                            <div className="w-jobcover">{run.creation.name.slice(0, 3).toUpperCase()}</div>
                            <div className="w-jobmeta">
                                <b>{run.job?.name || "Job"}</b>
                                <small>{run.creation.name} · {new Date(run.createdAt).toLocaleString()}</small>
                            </div>
                            <span className={`w-jtag ${run.status === "done" ? "done" : run.status === "failed" ? "wait" : "prog"}`}>
                                {labels[run.status] || run.status}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
