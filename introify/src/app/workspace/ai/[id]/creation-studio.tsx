"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Play, MessageCircle } from "lucide-react"

type Creation = {
    id: string
    name: string
    purpose: string | null
    description: string | null
    instructions: string | null
    visibility: string
    allowVisitorChat: boolean
    createdAt: string
    knowledge: { id: string; title: string; rawText: string }[]
    jobs: { id: string; name: string; description: string | null }[]
    _count: { runs: number }
}

export function CreationStudio({ creation }: { creation: Creation }) {
    const router = useRouter()
    const [name, setName] = useState(creation.name)
    const [purpose, setPurpose] = useState(creation.purpose || "")
    const [instructions, setInstructions] = useState(creation.instructions || "")
    const [visibility, setVisibility] = useState(creation.visibility)
    const [allowVisitorChat, setAllowVisitorChat] = useState(creation.allowVisitorChat)
    const [note, setNote] = useState("")
    const [jobName, setJobName] = useState("")
    const [jobInput, setJobInput] = useState("")
    const [chat, setChat] = useState("")
    const [log, setLog] = useState<{ role: "you" | "ai"; text: string }[]>([])
    const [busy, setBusy] = useState<string | null>(null)
    const [message, setMessage] = useState("")

    async function patch(body: Record<string, unknown>) {
        const res = await fetch(`/api/workspace/creations/${creation.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Save failed")
        router.refresh()
    }

    return (
        <div className="w-page">
            <Link href="/workspace" className="w-back"><ArrowLeft size={16} aria-hidden="true" /> My AIs</Link>
            <div className="w-titlebar">
                <div>
                    <p className="w-kicker">Creation</p>
                    <h1 className="w-h1">{name}</h1>
                    <p className="w-lede">Created {new Date(creation.createdAt).toLocaleDateString()} · {creation._count.runs} completed jobs</p>
                </div>
                <span className={`w-chip vis-${visibility.toLowerCase()}`}>{visibility.toLowerCase()}</span>
            </div>

            <section className="w-panel">
                <h2 className="w-h2">Identity</h2>
                <label className="w-field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="w-field">Purpose<input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
                <label className="w-field">Instructions<textarea rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label>
                <div className="w-inline-actions">
                    <label>Visibility
                        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                            <option value="PRIVATE">Private</option>
                            <option value="UNLISTED">Unlisted</option>
                            <option value="SHOWCASE">Showcase</option>
                        </select>
                    </label>
                    <label className="w-check">
                        <input type="checkbox" checked={allowVisitorChat} disabled={visibility !== "SHOWCASE"} onChange={(e) => setAllowVisitorChat(e.target.checked)} />
                        Visitors may chat when showcased
                    </label>
                </div>
                <button className="w-btn" type="button" disabled={busy === "save"} onClick={async () => {
                    setBusy("save"); setMessage("")
                    try {
                        await patch({ name, purpose, instructions, visibility, allowVisitorChat })
                        setMessage("Saved.")
                    } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Save failed")
                    }
                    setBusy(null)
                }}>{busy === "save" ? "Saving…" : "Save"}</button>
            </section>

            <section className="w-panel">
                <h2 className="w-h2">Knowledge</h2>
                <p className="w-lede">Notes, examples, and corrections. This is teaching, not model training.</p>
                <label className="w-field">Add a note<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                <button className="w-btn secondary" type="button" disabled={busy === "note"} onClick={async () => {
                    setBusy("note")
                    const res = await fetch(`/api/workspace/creations/${creation.id}/knowledge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Note", rawText: note }) })
                    const data = await res.json().catch(() => ({}))
                    setBusy(null)
                    if (!res.ok) { setMessage(data.error || "Could not save"); return }
                    setNote(""); router.refresh()
                }}>Save note</button>
                <ul className="w-notes">
                    {creation.knowledge.map((item) => (
                        <li key={item.id}><b>{item.title}</b><p>{item.rawText}</p></li>
                    ))}
                </ul>
            </section>

            <section className="w-panel">
                <h2 className="w-h2">Use this AI</h2>
                <form className="w-ask" onSubmit={async (event) => {
                    event.preventDefault()
                    const text = chat.trim()
                    if (!text) return
                    setBusy("chat"); setLog((rows) => [...rows, { role: "you", text }]); setChat("")
                    const res = await fetch(`/api/workspace/creations/${creation.id}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) })
                    const data = await res.json().catch(() => ({}))
                    setBusy(null)
                    setLog((rows) => [...rows, { role: "ai", text: data.reply || data.error || "No reply" }])
                }}>
                    <label htmlFor="creator-chat">Ask as the creator</label>
                    <textarea id="creator-chat" rows={3} value={chat} onChange={(e) => setChat(e.target.value)} />
                    <button className="w-btn" type="submit" disabled={busy === "chat"}><MessageCircle size={16} aria-hidden="true" />{busy === "chat" ? "Thinking…" : "Send"}</button>
                </form>
                <div className="w-transcript">
                    {log.map((row, i) => <p key={i} className={row.role === "you" ? "w-a" : "w-q"}>{row.text}</p>)}
                </div>
            </section>

            <section className="w-panel">
                <h2 className="w-h2">Define and run a job</h2>
                <label className="w-field">Job name<input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="3 logo motion directions" /></label>
                <label className="w-field">Input for this run<textarea rows={4} value={jobInput} onChange={(e) => setJobInput(e.target.value)} placeholder="Logo: a forest mark. Brand is quiet, premium, no bounce." /></label>
                <button className="w-btn" type="button" disabled={busy === "job"} onClick={async () => {
                    setBusy("job"); setMessage("")
                    const res = await fetch(`/api/workspace/creations/${creation.id}/run`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ jobName: jobName || "Untitled job", prompt: jobInput }),
                    })
                    const data = await res.json().catch(() => ({}))
                    setBusy(null)
                    if (!res.ok) { setMessage(data.error || "Run failed"); return }
                    router.push(`/workspace/result/${data.run.id}`)
                }}><Play size={16} aria-hidden="true" />{busy === "job" ? "Running…" : "Run job"}</button>
                {creation.jobs.length ? (
                    <ul className="w-notes">{creation.jobs.map((job) => <li key={job.id}><b>{job.name}</b></li>)}</ul>
                ) : null}
            </section>
            {message ? <p className="w-error" role="status">{message}</p> : null}
        </div>
    )
}
