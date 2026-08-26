"use client"

import { useTransition } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { setBookingStatus } from "@/app/actions/bookings"
import { toast } from "sonner"
import { reservationLabel, parseReservation } from "@/lib/menu"

export type CalBooking = {
    id: string
    visitorName: string
    visitorEmail: string
    service: string
    startTime: string
    endTime: string
    status: string
    metadata?: string | null
}

function dayKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dayLabel(d: Date, todayKey: string) {
    const key = dayKey(d)
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" })
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    if (key === todayKey) return `Today · ${date}`
    return `${weekday} · ${date}`
}

export function CalendarWeek({ bookings }: { bookings: CalBooking[] }) {
    const [pending, startTransition] = useTransition()
    const now = new Date()
    const todayKey = dayKey(now)

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + i)
        return d
    })

    const byDay = new Map<string, CalBooking[]>()
    for (const b of bookings) {
        const key = dayKey(new Date(b.startTime))
        const list = byDay.get(key) || []
        list.push(b)
        byDay.set(key, list)
    }

    const setStatus = (id: string, status: "CONFIRMED" | "CANCELLED") => {
        startTransition(async () => {
            try {
                await setBookingStatus(id, status)
                toast.success(status === "CONFIRMED" ? "Confirmed" : "Cancelled")
            } catch {
                toast.error("Could not update booking")
            }
        })
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Next 7 days</p>
            <div className="space-y-2">
                {days.map((day) => {
                    const key = dayKey(day)
                    const items = (byDay.get(key) || []).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
                    return (
                        <div key={key} className={cn("studio-panel overflow-hidden rounded-2xl", key === todayKey && "ring-1 ring-cyan-400/30")}>
                            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
                                <p className={cn("text-xs font-medium", key === todayKey && "text-[#00D7FF]")}>{dayLabel(day, todayKey)}</p>
                                <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
                            </div>
                            {items.length === 0 ? (
                                <p className="px-3 py-2.5 text-xs text-muted-foreground">Open</p>
                            ) : (
                                items.map((b) => (
                                    <BookingRow key={b.id} booking={b} pending={pending} onStatus={setStatus} />
                                ))
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function BookingRow({
    booking,
    pending,
    onStatus,
}: {
    booking: CalBooking
    pending?: boolean
    onStatus?: (id: string, status: "CONFIRMED" | "CANCELLED") => void
}) {
    const start = new Date(booking.startTime)
    const cancelled = booking.status === "CANCELLED"
    const confirmed = booking.status === "CONFIRMED"

    return (
        <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0">
            <div className="min-w-0">
                <p className={cn("truncate text-sm font-medium", cancelled && "line-through text-muted-foreground")}>
                    {booking.visitorName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {reservationLabel(booking.metadata, booking.service)} · {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                    {parseReservation(booking.metadata).phone || booking.visitorEmail}
                </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {booking.status.replaceAll("_", " ").toLowerCase()}
                </span>
                {onStatus && !cancelled && (
                    <div className="flex gap-1">
                        {!confirmed && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-full px-2 text-[11px]"
                                disabled={pending}
                                onClick={() => onStatus(booking.id, "CONFIRMED")}
                            >
                                Confirm
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-full px-2 text-[11px] text-destructive"
                            disabled={pending}
                            onClick={() => onStatus(booking.id, "CANCELLED")}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
