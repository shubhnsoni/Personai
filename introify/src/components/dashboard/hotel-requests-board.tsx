"use client"

import { useMemo, useState, useTransition } from "react"
import { setHotelRequestStatus } from "@/app/actions/hotels"
import { DEFAULT_HOTEL_SLA_MINUTES, HOTEL_REQUEST_DESKS, hotelRequestAdvanceLabel, hotelRequestStatusLabel, nextHotelRequestStatus, slaBadge } from "@/lib/hotels"
import { cn } from "@/lib/utils"

type RequestRow = {
    id: string
    type: string
    status: string
    department: string | null
    itemsJson: string
    guestName: string | null
    notes: string | null
    staffNotes: string | null
    photoUrl: string | null
    priority: string
    createdAt: string
    room: { number: string } | null
}

const FILTERS = ["ALL", ...HOTEL_REQUEST_DESKS] as const
const STATUSES = ["ALL", "REQUESTED", "ACCEPTED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETE"] as const

function itemsLabel(raw: string) {
    try {
        const items = JSON.parse(raw) as Array<{ qty?: number; label?: string }>
        if (!Array.isArray(items) || !items.length) return "Request"
        return items.map((item) => `${item.qty && item.qty > 1 ? `${item.qty} ` : ""}${item.label || "item"}`).join(", ")
    } catch {
        return "Request"
    }
}

function deskOf(row: RequestRow) {
    return row.department || row.type
}

export function HotelRequestsBoard({ rows, sla }: { rows: RequestRow[]; sla?: Record<string, number> }) {
    const [dept, setDept] = useState<(typeof FILTERS)[number]>("ALL")
    const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL")
    const [pending, start] = useTransition()
    const shown = useMemo(() => rows.filter((row) => {
        if (dept !== "ALL" && deskOf(row) !== dept) return false
        if (status !== "ALL" && row.status !== status) return false
        return true
    }), [rows, dept, status])

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                    <button key={item} type="button" onClick={() => setDept(item)} className={cn("min-h-11 rounded-full border px-3 text-xs font-medium transition-transform duration-150 ease-out active:scale-[0.96]", dept === item ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 text-muted-foreground")}>
                        {item === "ALL" ? "All desks" : item.toLowerCase()}
                    </button>
                ))}
                {STATUSES.map((item) => (
                    <button key={item} type="button" onClick={() => setStatus(item)} className={cn("min-h-11 rounded-full border px-3 text-xs font-medium transition-transform duration-150 ease-out active:scale-[0.96]", status === item ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 text-muted-foreground")}>
                        {item === "ALL" ? "All status" : hotelRequestStatusLabel(item)}
                    </button>
                ))}
            </div>
            <div className="divide-y divide-white/8 overflow-hidden rounded-2xl shadow-[0px_0px_0px_1px_oklch(1_0_0_/_0.08)]">
                {shown.length === 0 ? (
                    <p className="px-4 py-10 text-sm text-muted-foreground">No tickets in this filter. Guest chat creates housekeeping, maintenance, spa, transport, and experience requests. Emergencies alert this board — guests are told to call.</p>
                ) : shown.map((row) => {
                    const next = nextHotelRequestStatus(row.status)
                    const badge = slaBadge({
                        department: row.department,
                        status: row.status,
                        createdAt: new Date(row.createdAt),
                    }, sla || DEFAULT_HOTEL_SLA_MINUTES, new Date())
                    return (
                        <div key={row.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", row.type === "EMERGENCY" && "bg-red-400/8")}>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">{itemsLabel(row.itemsJson)}</p>
                                <p className="text-xs text-muted-foreground">
                                    {row.type.replace(/_/g, " ").toLowerCase()}
                                    {row.room ? ` · Room ${row.room.number}` : " · No room"}
                                    {row.guestName ? ` · ${row.guestName}` : ""}
                                    {` · ${hotelRequestStatusLabel(row.status, row.type)}`}
                                    {badge !== "ok" ? ` · ${badge}` : ""}
                                    {row.priority === "URGENT" ? " · urgent" : ""}
                                </p>
                                {row.staffNotes ? <p className="text-xs text-muted-foreground">{row.staffNotes}</p> : null}
                                {row.photoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={row.photoUrl} alt="" className="mt-2 max-h-24 rounded-xl object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                                ) : null}
                            </div>
                            {next ? (
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => start(async () => { await setHotelRequestStatus(row.id, next) })}
                                    className="min-h-11 rounded-full bg-[#00D7FF] px-4 text-xs font-medium text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]"
                                >
                                    {hotelRequestAdvanceLabel(next, row.type)}
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
