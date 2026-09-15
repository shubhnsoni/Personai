import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { getOwnedRun } from "@/lib/creation-jobs"

export const dynamic = "force-dynamic"

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const { id } = await params
    const run = await getOwnedRun(user.activeProfile.id, id)
    if (!run) notFound()

    return (
        <div className="w-page">
            <Link href="/workspace/jobs" className="w-back">← Jobs</Link>
            <h1 className="w-h1">{run.job?.name || "Result"}</h1>
            <p className="w-lede">{run.creation.name} · {run.status} · {new Date(run.createdAt).toLocaleString()}</p>
            <section className="w-panel">
                <h2 className="w-h2">Input</h2>
                <pre className="w-artifact">{run.input}</pre>
            </section>
            <section className="w-panel">
                <h2 className="w-h2">Deliverable</h2>
                {run.status === "failed" ? <p className="w-error">{run.error}</p> : <pre className="w-artifact">{run.output || "Still running."}</pre>}
            </section>
            <Link href={`/workspace/ai/${run.creation.id}`} className="w-btn">Improve this AI from the result</Link>
        </div>
    )
}
