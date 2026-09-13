"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function IntentIntroduction({ entries, defaultText }: { entries: Array<{ id: string; intent: string; text: string }>; defaultText?: string | null }) {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = entries.find(entry => entry.id === selectedId) || null

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose what brings you here">
                {entries.map(entry => (
                    <button
                        key={entry.id}
                        type="button"
                        aria-pressed={selectedId === entry.id}
                        onClick={() => setSelectedId(current => current === entry.id ? null : entry.id)}
                        className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium",
                            selectedId === entry.id ? "border-foreground bg-foreground text-background" : "border-border/70 text-foreground",
                        )}
                    >
                        {entry.intent}
                    </button>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">{selected ? selected.text : (defaultText || "")}</p>
        </div>
    )
}
