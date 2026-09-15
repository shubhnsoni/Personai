"use client"

import { useState } from "react"

export function HireJobForm({ creationId, jobId, checkoutOpen }: { creationId: string; jobId: string; checkoutOpen: boolean }) {
    const [prompt, setPrompt] = useState("")
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)

    return (
        <form
            className="mt-3 space-y-2"
            onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setMessage("")
                const res = await fetch(`/api/public/creations/${creationId}/orders`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ jobId, prompt }),
                })
                const data = await res.json().catch(() => ({}))
                setMessage(data.error || data.message || "Could not start checkout.")
                setBusy(false)
            }}
        >
            <label className="block text-xs font-medium">
                Input for this job
                <textarea className="mt-1 w-full min-h-11 rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </label>
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">
                {busy ? "Checking…" : checkoutOpen ? "Hire this job" : "Hire this job"}
            </button>
            {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
            {!checkoutOpen ? <p className="text-xs text-muted-foreground">Paid checkout is not open yet. The job is listed; no charge is taken.</p> : null}
        </form>
    )
}
