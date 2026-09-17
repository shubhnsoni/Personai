"use client"

import { useMemo, useState, useTransition } from "react"
import { setHotelRequestStatus } from "@/app/actions/hotels"
import { nextHotelRequestStatus } from "@/lib/hotels"
import { cn } from "@/lib/utils"

type RequestRow = {
    id: string
    type: string
    status: string
    department: string | null
    itemsJson: string
    guestName: string | null
    notes: string | null
    createdAt: string
    room: { number: string } | null
}

const FILTERS = ["ALL", "HOUSEKEEPING", "MAINTENANCE", "RECEPTION"] as const
const STATUSES = ["ALL", "REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETE"] as const

function itemsLabel(raw: string) {
    try {
        const items = JSON.parse(raw) as Array<{ qty?: number; label?: string }>
        if (!Array.isArray(items) || !items.length) return "Request"
        return items.map((item) => `${item.qty && item.qty > 1 ? `${item.qty} ` : ""}${item.label || "item"}`).join(", ")
    } catch {
        return "Request"
    }
}

export function HotelRequestsBoard({ rows }: { rows: RequestRow[] }) {
    const [dept, setDept] = useState<(typeof FILTERS)[number]>("ALL")
    const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL")
    const [pending, start] = useTransition()
    const shown = useMemo(() => rows.filter((row) => {
        if (dept !== "ALL" && (row.department || row.type) !== dept) return false
        if (status !== "ALL" && row.status !== status) return false
        return true
    }), [rows, dept, status])

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                    <button key={item} type="button" onClick={() => setDept(item)} className={cn("min-h-11 rounded-full border px-3 text-xs font-medium transition-transform duration-150 active:scale-[0.96]", dept === item ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 text-muted-foreground")}>
                        {item === "ALL" ? "All desks" : item.toLowerCase()}
                    </button>
                ))}
                {STATUSES.map((item) => (
                    <button key={item} type="button" onClick={() => setStatus(item)} className={cn("min-h-11 rounded-full border px-3 text-xs font-medium transition-transform duration-150 active:scale-[0.96]", status === item ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 text-muted-foreground")}>
                        {item === "ALL" ? "All status" : item.replace("_", " ").toLowerCase()}
                    </button>
                ))}
            </div>
            <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8">
                {shown.length === 0 ? (
                    <p className="px-4 py-10 text-sm text-muted-foreground">No tickets in this filter. Guest chat creates housekeeping requests.</p>
                ) : shown.map((row) => {
                    const next = nextHotelRequestStatus(row.status)
                    return (
                        <div key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">{itemsLabel(row.itemsJson)}</p>
                                <p className="text-xs text-muted-foreground">
                                    {row.room ? `Room ${row.room.number}` : "No room"}
                                    {row.guestName ? ` · ${row.guestName}` : ""}
                                    {` · ${row.status.toLowerCase().replace("_", " ")}`}
                                </p>
                            </div>
                            {next ? (
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => start(async () => { await setHotelRequestStatus(row.id, next) })}
                                    className="min-h-11 rounded-full bg-[#00D7FF] px-4 text-xs font-medium text-[#061018] transition-transform duration-150 active:scale-[0.96]"
                                >
                                    {next === "ACCEPTED" ? "Accept" : next === "IN_PROGRESS" ? "In progress" : "Complete"}
                                </button>
                            ) : (
                                <span className="text-xs text-muted-foreground">Done</span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
