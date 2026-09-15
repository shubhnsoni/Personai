"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function AttachSkillForm({
    creations,
}: {
    creations: { id: string; name: string }[]
}) {
    const router = useRouter()
    const [hostId, setHostId] = useState(creations[0]?.id || "")
    const [usesId, setUsesId] = useState(creations[1]?.id || creations[0]?.id || "")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    if (creations.length < 2) return null

    return (
        <form
            className="w-ask"
            onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setError("")
                const res = await fetch("/api/workspace/skills", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ hostId, usesId }),
                })
                const data = await res.json().catch(() => ({}))
                setBusy(false)
                if (!res.ok) {
                    setError(data.error || "Could not attach that skill.")
                    return
                }
                router.refresh()
            }}
        >
            <label>This AI
                <select value={hostId} onChange={(event) => setHostId(event.target.value)}>
                    {creations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
            </label>
            <label>Uses
                <select value={usesId} onChange={(event) => setUsesId(event.target.value)}>
                    {creations.map((item) => <option key={`uses-${item.id}`} value={item.id}>{item.name}</option>)}
                </select>
            </label>
            {error ? <p className="w-error" role="alert">{error}</p> : null}
            <button className="w-btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Attach skill"}</button>
        </form>
    )
}
