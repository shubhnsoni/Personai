"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function CreateTeamForm({
    creations,
    templates,
}: {
    creations: { id: string; name: string }[]
    templates: { id: string; name: string }[]
}) {
    const router = useRouter()
    const [name, setName] = useState("")
    const [template, setTemplate] = useState(templates[0]?.id || "")
    const [ids, setIds] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    return (
        <form
            className="w-ask"
            onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true); setError("")
                const res = await fetch("/api/workspace/teams", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name, template, creationIds: ids }),
                })
                const data = await res.json().catch(() => ({}))
                setBusy(false)
                if (!res.ok) { setError(data.error || "Could not save"); return }
                router.refresh()
            }}
        >
            <label>Team name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Template
                <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                    {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
            </label>
            <fieldset>
                <legend>AIs in this team</legend>
                {creations.map((item) => (
                    <label key={item.id} className="w-check">
                        <input type="checkbox" checked={ids.includes(item.id)} onChange={(e) => setIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                        {item.name}
                    </label>
                ))}
            </fieldset>
            {error ? <p className="w-error" role="alert">{error}</p> : null}
            <button className="w-btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save team"}</button>
        </form>
    )
}
