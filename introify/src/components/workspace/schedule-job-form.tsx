"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { scheduleCadences } from "@/lib/workspace-teams"

export function ScheduleJobForm({
    jobs,
}: {
    jobs: { id: string; name: string; creationId: string; creationName: string }[]
}) {
    const router = useRouter()
    const [jobId, setJobId] = useState(jobs[0]?.id || "")
    const [cadence, setCadence] = useState("daily")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const selected = useMemo(() => jobs.find((job) => job.id === jobId), [jobs, jobId])

    if (!jobs.length) return null

    return (
        <form
            className="w-ask"
            onSubmit={async (event) => {
                event.preventDefault()
                if (!selected) return
                setBusy(true)
                setError("")
                const res = await fetch("/api/workspace/schedules", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ creationId: selected.creationId, jobId: selected.id, cadence }),
                })
                const data = await res.json().catch(() => ({}))
                setBusy(false)
                if (!res.ok) {
                    setError(data.error || "Could not schedule that job.")
                    return
                }
                router.refresh()
            }}
        >
            <label>Job
                <select value={jobId} onChange={(event) => setJobId(event.target.value)}>
                    {jobs.map((job) => (
                        <option key={job.id} value={job.id}>{job.creationName} · {job.name}</option>
                    ))}
                </select>
            </label>
            <label>Cadence
                <select value={cadence} onChange={(event) => setCadence(event.target.value)}>
                    {scheduleCadences().map((item) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
            </label>
            {error ? <p className="w-error" role="alert">{error}</p> : null}
            <button className="w-btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Schedule"}</button>
        </form>
    )
}
