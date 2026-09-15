"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Link2, MessageCircle, Play, Upload } from "lucide-react"
import { isPubliclyReachable, knowledgeFromUpload, publicCreationPath } from "@/lib/creations"

type Creation = {
    id: string
    name: string
    slug: string
    purpose: string | null
    description: string | null
    instructions: string | null
    visibility: string
    allowVisitorChat: boolean
    createdAt: string
    profileSlug: string
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
    const [jobPrice, setJobPrice] = useState("")
    const [jobOffer, setJobOffer] = useState(false)
    const [chat, setChat] = useState("")
    const [log, setLog] = useState<{ role: "you" | "ai"; text: string }[]>([])
    const [busy, setBusy] = useState<string | null>(null)
    const [message, setMessage] = useState("")
    const [ok, setOk] = useState(false)
    const publicPath = publicCreationPath(creation.profileSlug, creation.slug)
    const shareable = isPubliclyReachable(visibility)

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

    function flash(text: string, success = false) {
        setMessage(text)
        setOk(success)
    }

    async function addKnowledge(title: string, rawText: string) {
        const res = await fetch(`/api/workspace/creations/${creation.id}/knowledge`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title, rawText }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Could not save")
        router.refresh()
    }

    return (
        <div className="w-page">
            <Link href="/workspace" className="w-back"><ArrowLeft size={16} aria-hidden="true" /> My AIs</Link>
            <div className="w-titlebar">
                <div>
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
                        <select value={visibility} onChange={(e) => {
                            const next = e.target.value
                            setVisibility(next)
                            if (next === "PRIVATE") setAllowVisitorChat(false)
                        }}>
                            <option value="PRIVATE">Private</option>
                            <option value="UNLISTED">Unlisted — anyone with the link</option>
                            <option value="SHOWCASE">Showcase — on your public page</option>
                        </select>
                    </label>
                    <label className="w-check">
                        <input
                            type="checkbox"
                            checked={allowVisitorChat}
                            disabled={visibility === "PRIVATE"}
                            onChange={(e) => setAllowVisitorChat(e.target.checked)}
                            aria-label="People with the link may chat"
                        />
                        People with the link may chat
                    </label>
                </div>
                {shareable ? (
                    <p className="w-lede">
                        <Link href={publicPath} className="w-ghost" target="_blank" rel="noreferrer">Open public page</Link>
                        <Link href={`/workspace/reputation/${creation.id}`} className="w-ghost">Reputation</Link>
                    </p>
                ) : (
                    <p className="w-lede">
                        <Link href={`/workspace/reputation/${creation.id}`} className="w-ghost">Reputation</Link>
                    </p>
                )}
                <div className="w-inline-actions">
                    <button className="w-btn" type="button" disabled={busy === "save"} onClick={async () => {
                        setBusy("save"); flash("")
                        try {
                            await patch({ name, purpose, instructions, visibility, allowVisitorChat })
                            flash("Saved.", true)
                        } catch (error) {
                            flash(error instanceof Error ? error.message : "Save failed")
                        }
                        setBusy(null)
                    }}>{busy === "save" ? "Saving…" : "Save"}</button>
                    {shareable ? (
                        <button className="w-btn secondary" type="button" onClick={async () => {
                            const url = `${window.location.origin}${publicPath}`
                            await navigator.clipboard.writeText(url).catch(() => {})
                            flash("Link copied.", true)
                        }}><Link2 size={16} aria-hidden="true" /> Copy link</button>
                    ) : null}
                </div>
            </section>

            <section className="w-panel">
                <h2 className="w-h2">Knowledge</h2>
                <p className="w-lede">Notes, examples, corrections, or a text file. This is teaching, not model training.</p>
                <label className="w-field">Add a note<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                <div className="w-inline-actions">
                    <button className="w-btn secondary" type="button" disabled={busy === "note"} onClick={async () => {
                        setBusy("note")
                        try {
                            await addKnowledge("Note", note)
                            setNote("")
                            flash("Note saved.", true)
                        } catch (error) {
                            flash(error instanceof Error ? error.message : "Could not save")
                        }
                        setBusy(null)
                    }}>{busy === "note" ? "Saving…" : "Save note"}</button>
                    <label className="w-btn secondary" style={{ cursor: "pointer" }}>
                        <Upload size={16} aria-hidden="true" /> Add a text file
                        <input
                            type="file"
                            accept=".txt,.md,.markdown,.csv,.json"
                            hidden
                            onChange={async (event) => {
                                const file = event.target.files?.[0]
                                event.target.value = ""
                                if (!file) return
                                setBusy("file")
                                try {
                                    const text = await file.text()
                                    const item = knowledgeFromUpload(file.name, text)
                                    await addKnowledge(item.title, item.rawText)
                                    flash(`Added ${item.title}.`, true)
                                } catch (error) {
                                    flash(error instanceof Error ? error.message : "Could not read that file")
                                }
                                setBusy(null)
                            }}
                        />
                    </label>
                </div>
                {creation.knowledge.length === 0 ? (
                    <p className="w-lede">No notes yet. Add one example of how you actually work.</p>
                ) : (
                    <ul className="w-notes">
                        {creation.knowledge.map((item) => (
                            <li key={item.id}><b>{item.title}</b><p>{item.rawText}</p></li>
                        ))}
                    </ul>
                )}
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
                    {log.length === 0 ? <p className="w-q">Try a real brief. This is the same AI visitors will meet if you share the link.</p> : null}
                    {log.map((row, i) => <p key={i} className={row.role === "you" ? "w-a" : "w-q"}>{row.text}</p>)}
                </div>
            </section>

            <section className="w-panel">
                <h2 className="w-h2">Define and run a job</h2>
                <label className="w-field">Job name<input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="3 logo motion directions" /></label>
                <label className="w-field">Input for this run<textarea rows={4} value={jobInput} onChange={(e) => setJobInput(e.target.value)} placeholder="Logo: a forest mark. Brand is quiet, premium, no bounce." /></label>
                <label className="w-field">Price in ₹ (optional)<input inputMode="numeric" value={jobPrice} onChange={(e) => setJobPrice(e.target.value)} placeholder="499" /></label>
                <label className="w-check">
                    <input type="checkbox" checked={jobOffer} onChange={(e) => setJobOffer(e.target.checked)} />
                    Offer this as a hireable job
                </label>
                <button className="w-btn" type="button" disabled={busy === "job"} onClick={async () => {
                    setBusy("job"); flash("")
                    let jobId: string | undefined
                    if (jobOffer) {
                        const offered = await fetch(`/api/workspace/creations/${creation.id}/jobs`, {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                                name: jobName || "Untitled job",
                                inputHint: jobInput,
                                offered: true,
                                priceCents: Math.round(Number(jobPrice || "0") * 100),
                            }),
                        })
                        const offeredData = await offered.json().catch(() => ({}))
                        if (!offered.ok) {
                            setBusy(null)
                            flash(offeredData.error || "Could not offer that job.")
                            return
                        }
                        jobId = offeredData.job?.id
                    }
                    const res = await fetch(`/api/workspace/creations/${creation.id}/run`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ jobId, jobName: jobName || "Untitled job", prompt: jobInput }),
                    })
                    const data = await res.json().catch(() => ({}))
                    setBusy(null)
                    if (!res.ok) { flash(data.error || "Run failed"); return }
                    router.push(`/workspace/result/${data.run.id}`)
                }}><Play size={16} aria-hidden="true" />{busy === "job" ? "Running…" : "Run job"}</button>
                {creation.jobs.length ? (
                    <ul className="w-notes">{creation.jobs.map((job) => <li key={job.id}><b>{job.name}</b></li>)}</ul>
                ) : <p className="w-lede">A job is a concrete piece of work — a report, three directions, a list — not “access to the bot”.</p>}
            </section>
            {message ? <p className={ok ? "w-status" : "w-error"} role="status">{message}</p> : null}
        </div>
    )
}
