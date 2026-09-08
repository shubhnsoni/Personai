"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export const LARGE_PARTY_MIN = 12
export const LARGE_PARTY_MAX = 80
const CHIP_COUNT = 12

function clampParty(n: number, max = LARGE_PARTY_MAX) {
    if (!Number.isFinite(n)) return 1
    return Math.max(1, Math.min(max, Math.floor(n)))
}

export function PartySizePicker({
    value,
    onChange,
    className,
    label = "Party",
    max = LARGE_PARTY_MAX,
    hidden,
}: {
    value: number
    onChange: (n: number) => void
    className?: string
    label?: string
    max?: number
    hidden?: boolean
}) {
    const cap = Math.max(1, Math.floor(max) || LARGE_PARTY_MAX)
    const people = clampParty(value, cap)
    const chips = Math.min(CHIP_COUNT, cap)
    const digits = String(cap).length
    const [draft, setDraft] = useState<string | null>(null)
    if (hidden) return null
    return (
        <div className={className}>
            <p className="mb-2 text-xs text-zinc-500">{label}</p>
            <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: chips }, (_, i) => i + 1).map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        className={cn(
                            "h-10 w-10 rounded-full text-sm",
                            people === n ? "bg-cyan-500 text-zinc-950" : "bg-white/8 text-zinc-300",
                        )}
                    >
                        {n}
                    </button>
                ))}
                <div className="flex h-10 items-center rounded-full bg-white/8">
                    <button
                        type="button"
                        aria-label={label === "Party" ? "Fewer people" : `Fewer ${label.toLowerCase()}`}
                        className="flex h-10 w-10 items-center justify-center text-zinc-200 disabled:text-zinc-600"
                        disabled={people <= 1}
                        onClick={() => onChange(people - 1)}
                    >
                        <Minus className="h-4 w-4" />
                    </button>
                    <input
                        type="text"
                        inputMode="numeric"
                        aria-label={label === "Party" ? "Party size" : label}
                        value={draft ?? String(people)}
                        onFocus={() => setDraft(String(people))}
                        onBlur={() => {
                            if (draft === "" || draft == null) onChange(people)
                            else onChange(clampParty(Number(draft), cap))
                            setDraft(null)
                        }}
                        onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "").slice(0, digits)
                            setDraft(raw)
                            if (raw) onChange(clampParty(Number(raw), cap))
                        }}
                        className={cn(
                            "h-10 w-12 bg-transparent text-center text-sm tabular-nums outline-none",
                            people > chips ? "font-semibold text-cyan-400" : "text-zinc-100",
                        )}
                    />
                    <button
                        type="button"
                        aria-label={label === "Party" ? "More people" : `More ${label.toLowerCase()}`}
                        className="flex h-10 w-10 items-center justify-center text-zinc-200 disabled:text-zinc-600"
                        disabled={people >= cap}
                        onClick={() => onChange(people + 1)}
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>
            {label === "Party" && people > CHIP_COUNT ? (
                <p className="mt-2 text-[12px] text-zinc-400">
                    {people >= 20
                        ? `Table for ${people} — we’ll join tables. The restaurant usually confirms by WhatsApp.`
                        : `Table for ${people} — we’ll join tables.`}
                </p>
            ) : null}
        </div>
    )
}
