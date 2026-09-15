"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function ShowcaseToggles({ items }: { items: { id: string; name: string; purpose: string | null; visibility: string }[] }) {
    const router = useRouter()
    const [busy, setBusy] = useState<string | null>(null)

    if (!items.length) {
        return <div className="w-empty"><h2>No AIs yet</h2><p>Create an AI first, then flip it to Showcase.</p></div>
    }

    return (
        <ul className="w-joblist">
            {items.map((item) => (
                <li key={item.id} className="w-jobrow" style={{ cursor: "default" }}>
                    <div className="w-jobcover">{item.name.slice(0, 2).toUpperCase()}</div>
                    <div className="w-jobmeta">
                        <b>{item.name}</b>
                        <small>{item.purpose || "No purpose yet"}</small>
                    </div>
                    <button
                        className="w-btn secondary"
                        type="button"
                        disabled={busy === item.id}
                        onClick={async () => {
                            setBusy(item.id)
                            await fetch(`/api/workspace/creations/${item.id}`, {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ visibility: item.visibility === "SHOWCASE" ? "PRIVATE" : "SHOWCASE" }),
                            })
                            setBusy(null)
                            router.refresh()
                        }}
                    >
                        {item.visibility === "SHOWCASE" ? "On profile" : "Keep private"}
                    </button>
                </li>
            ))}
        </ul>
    )
}
