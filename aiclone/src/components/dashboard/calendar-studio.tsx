"use client"

import { useMemo, useState, useTransition } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { setBookingStatus, createHold } from "@/app/actions/bookings"
import { BookingSheet } from "@/components/dashboard/booking-sheet"
import type { CalBooking } from "@/components/dashboard/calendar-week"
import { reservationLabel } from "@/lib/menu"
import { dayKey } from "@/lib/slots"
import { AvailabilitySettings } from "@/components/dashboard/availability-settings"
import { CalendarSyncSheet } from "@/components/dashboard/calendar-sync-sheet"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { AvailabilitySchedule } from "@prisma/client"

type CalView = "month" | "week" | "day" | "agenda"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const START_HOUR = 7
const END_HOUR = 23
const HOUR_PX = 52

function startOfWeek(d: Date) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    x.setDate(x.getDate() - x.getDay())
    return x
}

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addDays(d: Date, n: number) {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
}

function sameDay(a: Date, b: Date) {
    return dayKey(a) === dayKey(b)
}

export function CalendarStudio({
    bookings,
    profileId,
    timezone,
    bufferMinutes,
    schedules,
    icsUrl,
    noun = "Bookings",
}: {
    bookings: CalBooking[]
    profileId: string
    timezone: string
    bufferMinutes: number
    schedules: AvailabilitySchedule[]
    icsUrl: string
    noun?: string
}) {
    const [cursor, setCursor] = useState(() => new Date())
    const [view, setView] = useState<CalView>(() => {
        if (typeof window === "undefined") return "month"
        const saved = localStorage.getItem("pl-cal-view")
        if (saved === "week" || saved === "day" || saved === "agenda" || saved === "month") return saved
        return window.matchMedia("(min-width: 768px)").matches ? "week" : "month"
    })
    const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()))
    const [open, setOpen] = useState<CalBooking | null>(null)
    const [hoursOpen, setHoursOpen] = useState(false)
    const [syncOpen, setSyncOpen] = useState(false)
    const [pending, startTransition] = useTransition()

    const persistView = (next: CalView) => {
        setView(next)
        localStorage.setItem("pl-cal-view", next)
    }

    const today = new Date()
    const label = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })

    const shift = (dir: number) => {
        const next = new Date(cursor)
        if (view === "month") next.setMonth(next.getMonth() + dir)
        else if (view === "day") next.setDate(next.getDate() + dir)
        else next.setDate(next.getDate() + dir * 7)
        setCursor(next)
    }

    const weekDays = useMemo(() => {
        const start = startOfWeek(cursor)
        return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }, [cursor])

    const monthCells = useMemo(() => {
        const start = startOfWeek(startOfMonth(cursor))
        return Array.from({ length: 42 }, (_, i) => addDays(start, i))
    }, [cursor])

    const byDay = useMemo(() => {
        const map = new Map<string, CalBooking[]>()
        for (const b of bookings) {
            if (b.status === "CANCELLED") continue
            const key = dayKey(new Date(b.startTime))
            const list = map.get(key) || []
            list.push(b)
            map.set(key, list)
        }
        for (const list of map.values()) {
            list.sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
        }
        return map
    }, [bookings])

    const setStatus = (id: string, status: "CONFIRMED" | "CANCELLED") => {
        startTransition(async () => {
            try {
                await setBookingStatus(id, status)
                toast.success(status === "CONFIRMED" ? "Confirmed" : "Cancelled")
                setOpen(null)
            } catch {
                toast.error("Could not update")
            }
        })
    }

    const blockSlot = (iso: string) => {
        startTransition(async () => {
            try {
                await createHold(iso, 30, "Blocked")
                toast.success("Time blocked")
            } catch {
                toast.error("Could not block")
            }
        })
    }

    const selectedItems = byDay.get(selectedDay) || []

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold tracking-tight">{label}</h1>
                    <p className="text-[11px] text-muted-foreground">{timezone.replace(/_/g, " ")} · {bufferMinutes}m buffer</p>
                </div>
                <div className="flex shrink-0 rounded-full border border-border/70 p-0.5">
                    {(["month", "week", "day", "agenda"] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => persistView(v)}
                            className={cn(
                                "rounded-full px-2 py-1 text-xs capitalize",
                                view === v ? "bg-foreground text-background" : "text-muted-foreground"
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {view === "month" && (
                <MonthGrid
                    cells={monthCells}
                    cursor={cursor}
                    today={today}
                    selectedDay={selectedDay}
                    byDay={byDay}
                    onSelect={(d) => {
                        setSelectedDay(dayKey(d))
                        setCursor(d)
                    }}
                    onOpen={setOpen}
                />
            )}

            {(view === "week" || view === "day") && (
                <WeekGrid
                    days={view === "day" ? [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())] : weekDays}
                    today={today}
                    byDay={byDay}
                    pending={pending}
                    onOpen={setOpen}
                    onBlock={blockSlot}
                />
            )}

            {view === "agenda" && (
                <AgendaList
                    days={view === "agenda" ? weekDays : weekDays}
                    byDay={byDay}
                    onOpen={setOpen}
                />
            )}

            {view === "month" && (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <p className="border-b border-border/50 px-3 py-2 text-xs font-medium">
                        {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    {selectedItems.length === 0 ? (
                        <div className="flex items-center justify-between px-3 py-3">
                            <p className="text-xs text-muted-foreground">No {noun.toLowerCase()} yet</p>
                            <Button
                                variant="outline"
                                className="h-7 rounded-full px-2.5 text-[11px]"
                                disabled={pending}
                                onClick={() => blockSlot(new Date(`${selectedDay}T07:00:00`).toISOString())}
                            >
                                Block 7am
                            </Button>
                        </div>
                    ) : (
                        selectedItems.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => setOpen(b)}
                                className="flex w-full items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left last:border-b-0"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{b.visitorName}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        {b.service} · {new Date(b.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}

            <BookingSheet booking={open} onClose={() => setOpen(null)} pending={pending} onStatus={setStatus} />
            <CalendarSyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} icsUrl={icsUrl} />

            <Sheet open={hoursOpen} onOpenChange={setHoursOpen}>
                <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl">
                    <SheetHeader>
                        <SheetTitle>Hours</SheetTitle>
                    </SheetHeader>
                    <div className="px-1 pb-6">
                        <AvailabilitySettings
                            profileId={profileId}
                            schedules={schedules}
                            timezone={timezone}
                            bufferMinutes={bufferMinutes}
                            compact
                        />
                    </div>
                </SheetContent>
            </Sheet>

            <StudioDock>
                <div className="flex min-w-0 items-center gap-1.5">
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => shift(-1)} aria-label="Previous">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => shift(1)} aria-label="Next">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-9 shrink-0 rounded-full px-3 text-xs"
                        onClick={() => {
                            setCursor(new Date())
                            setSelectedDay(dayKey(new Date()))
                        }}
                    >
                        Today
                    </Button>
                    <Button variant="outline" className="h-9 rounded-full" onClick={() => setSyncOpen(true)}>
                        <CalendarDays className="mr-1 h-4 w-4" /> Sync
                    </Button>
                </div>
                <Button className="shrink-0 rounded-full" onClick={() => setHoursOpen(true)}>
                    <Clock className="mr-1 h-4 w-4" /> Set hours
                </Button>
            </StudioDock>
        </div>
    )
}

function MonthGrid({
    cells,
    cursor,
    today,
    selectedDay,
    byDay,
    onSelect,
    onOpen,
}: {
    cells: Date[]
    cursor: Date
    today: Date
    selectedDay: string
    byDay: Map<string, CalBooking[]>
    onSelect: (d: Date) => void
    onOpen: (b: CalBooking) => void
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="grid grid-cols-7 border-b border-border/50">
                {WEEKDAYS.map((d) => (
                    <div key={d} className="py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {cells.map((d) => {
                    const key = dayKey(d)
                    const items = byDay.get(key) || []
                    const inMonth = d.getMonth() === cursor.getMonth()
                    const isToday = sameDay(d, today)
                    const selected = key === selectedDay
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelect(d)}
                            onDoubleClick={() => items[0] && onOpen(items[0])}
                            className={cn(
                                "flex min-h-14 flex-col items-center gap-1 border-b border-r border-border/40 px-1 py-1.5 last:border-r-0",
                                !inMonth && "bg-muted/20 text-muted-foreground",
                                selected && "bg-foreground/5"
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                                    isToday && "bg-foreground text-background"
                                )}
                            >
                                {d.getDate()}
                            </span>
                            {items.length > 0 && (
                                <span className="flex gap-0.5">
                                    {items.slice(0, 3).map((b) => (
                                        <span
                                            key={b.id}
                                            className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                b.status === "CONFIRMED" ? "bg-emerald-500" : "bg-amber-400"
                                            )}
                                        />
                                    ))}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function WeekGrid({
    days,
    today,
    byDay,
    pending,
    onOpen,
    onBlock,
}: {
    days: Date[]
    today: Date
    byDay: Map<string, CalBooking[]>
    pending: boolean
    onOpen: (b: CalBooking) => void
    onBlock: (iso: string) => void
}) {
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
    const now = new Date()
    const showNow = days.some((d) => sameDay(d, now)) && now.getHours() >= START_HOUR && now.getHours() < END_HOUR
    const nowTop = ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * HOUR_PX
    const cols = `3rem repeat(${days.length}, minmax(0,1fr))`

    return (
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70 bg-card">
            <div
                className={cn("sticky top-0 z-10 grid border-b border-border/50 bg-card/95 backdrop-blur", days.length > 1 && "min-w-[640px]")}
                style={{ gridTemplateColumns: cols }}
            >
                <div />
                {days.map((d) => (
                    <div
                        key={dayKey(d)}
                        className={cn("px-1 py-2 text-center", sameDay(d, today) && "text-foreground")}
                    >
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{WEEKDAYS[d.getDay()]}</p>
                        <p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums", sameDay(d, today) && "bg-foreground text-background")}>
                            {d.getDate()}
                        </p>
                    </div>
                ))}
            </div>
            <div
                className={cn("relative grid", days.length > 1 && "min-w-[640px]")}
                style={{ gridTemplateColumns: cols }}
            >
                <div>
                    {hours.map((h) => (
                        <div key={h} className="h-[52px] pr-1 text-right text-[10px] tabular-nums text-muted-foreground">
                            {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
                        </div>
                    ))}
                </div>
                {days.map((d) => {
                    const items = byDay.get(dayKey(d)) || []
                    return (
                        <div key={dayKey(d)} className={cn("relative border-l border-border/40", sameDay(d, today) && "bg-foreground/[0.02]")}>
                            {hours.map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    disabled={pending}
                                    onClick={() => {
                                        const iso = new Date(d)
                                        iso.setHours(h, 0, 0, 0)
                                        onBlock(iso.toISOString())
                                    }}
                                    className="h-[52px] w-full border-b border-border/30 hover:bg-muted/40"
                                    aria-label={`Block ${h}:00`}
                                />
                            ))}
                            {items.map((b) => {
                                const start = new Date(b.startTime)
                                const end = new Date(b.endTime)
                                const gridH = (END_HOUR - START_HOUR) * HOUR_PX
                                const rawTop = ((start.getHours() * 60 + start.getMinutes() - START_HOUR * 60) / 60) * HOUR_PX
                                const rawH = ((end.getTime() - start.getTime()) / 3600000) * HOUR_PX
                                const minH = 44
                                const top = Math.max(0, Math.min(rawTop, gridH - minH))
                                const height = Math.min(gridH - top, Math.max(minH, rawH))
                                const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                                return (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onOpen(b)
                                        }}
                                        className={cn(
                                            "absolute inset-x-0.5 z-[1] flex flex-col justify-center gap-0.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-none shadow-sm",
                                            b.visitorEmail === "hold@local"
                                                ? "bg-muted text-muted-foreground"
                                                : b.status === "CONFIRMED"
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-amber-500 text-white"
                                        )}
                                        style={{ top, height }}
                                    >
                                        <span className="truncate font-medium">{time} · {b.visitorName.split(" ")[0]}</span>
                                        <span className="truncate opacity-80">{reservationLabel(b.metadata, b.service)}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )
                })}
                {showNow && (
                    <div
                        className="pointer-events-none absolute right-0 left-12 z-10 border-t-2 border-rose-500"
                        style={{ top: nowTop }}
                    >
                        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                )}
            </div>
        </div>
    )
}

function AgendaList({
    days,
    byDay,
    onOpen,
}: {
    days: Date[]
    byDay: Map<string, CalBooking[]>
    onOpen: (b: CalBooking) => void
}) {
    return (
        <div className="space-y-2">
            {days.map((d) => {
                const items = byDay.get(dayKey(d)) || []
                return (
                    <div key={dayKey(d)} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                        <p className="border-b border-border/50 px-3 py-2 text-xs font-medium">
                            {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            <span className="ml-2 text-muted-foreground">{items.length}</span>
                        </p>
                        {items.length === 0 ? (
                            <p className="px-3 py-2.5 text-xs text-muted-foreground">Open</p>
                        ) : (
                            items.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => onOpen(b)}
                                    className="flex w-full items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{b.visitorName}</p>
                                        <p className="truncate text-[11px] text-muted-foreground">
                                            {new Date(b.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                            {" · "}
                                            {reservationLabel(b.metadata, b.service)}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )
            })}
        </div>
    )
}
