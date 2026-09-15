import Link from "next/link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { ScheduleJobForm } from "@/components/workspace/schedule-job-form"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const [schedules, jobs] = await Promise.all([
        prisma.creationSchedule.findMany({
            where: { creation: { profileId: user.activeProfile.id } },
            include: { creation: { select: { name: true } }, job: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        }),
        prisma.creationJob.findMany({
            where: { creation: { profileId: user.activeProfile.id } },
            select: { id: true, name: true, creationId: true, creation: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        }),
    ])
    const jobOptions = jobs.map((job) => ({
        id: job.id,
        name: job.name,
        creationId: job.creationId,
        creationName: job.creation.name,
    }))

    return (
        <div className="w-page">
            <h1 className="w-h1">Background jobs</h1>
            <p className="w-lede">Scheduled reports stay Read/Create. Spending or sending still needs approval. Nothing here controls desktop software.</p>
            {jobOptions.length ? (
                <section className="w-panel">
                    <h2 className="w-h2">Schedule a job</h2>
                    <ScheduleJobForm jobs={jobOptions} />
                </section>
            ) : null}
            {schedules.length === 0 ? (
                <div className="w-empty">
                    <h2>Nothing scheduled</h2>
                    <p>{jobOptions.length ? "Pick a job above and a daily or weekly cadence." : "Offer a nightly report job, then attach a daily cadence. The owner still approves anything with real-world consequences."}</p>
                    {jobOptions.length ? null : <Link href="/workspace" className="w-btn">Open an AI</Link>}
                </div>
            ) : (
                <ul className="w-notes">
                    {schedules.map((row) => (
                        <li key={row.id}>
                            <b>{row.job.name}</b>
                            <p>{row.creation.name} · {row.cadence} · {row.enabled ? "Running" : "Paused"}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
