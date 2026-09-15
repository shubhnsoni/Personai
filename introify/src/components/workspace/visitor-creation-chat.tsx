"use client"

import { useState } from "react"

export function VisitorCreationChat({ creationId, name }: { creationId: string; name: string }) {
    const [message, setMessage] = useState("")
    const [log, setLog] = useState<{ role: "you" | "ai"; text: string }[]>([])
    const [busy, setBusy] = useState(false)

    return (
        <form
            className="space-y-3"
            onSubmit={async (event) => {
                event.preventDefault()
                const text = message.trim()
                if (!text || busy) return
                setBusy(true)
                setLog((rows) => [...rows, { role: "you", text }])
                setMessage("")
                const res = await fetch(`/api/public/creations/${creationId}/chat`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ message: text }),
                })
                const data = await res.json().catch(() => ({}))
                setLog((rows) => [...rows, { role: "ai", text: data.reply || data.error || "No reply" }])
                setBusy(false)
            }}
        >
            <label htmlFor="visitor-chat" className="block text-sm font-medium">Ask {name}</label>
            <textarea
                id="visitor-chat"
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full min-h-11 rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm"
            />
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">
                {busy ? "Thinking…" : "Send"}
            </button>
            <div className="space-y-2 text-sm">
                {log.map((row, i) => (
                    <p key={i} className={row.role === "you" ? "rounded-2xl bg-muted px-3 py-2" : "text-muted-foreground"}>
                        {row.text}
                    </p>
                ))}
            </div>
        </form>
    )
}
