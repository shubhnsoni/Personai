"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CalendarLinks } from "@/components/calendar/calendar-links"
import { createBooking, getAvailableSlots } from "@/app/actions/bookings"
import { localDateKey } from "@/lib/menu"
import { whatsappHref } from "@/lib/commerce"
import { cn } from "@/lib/utils"

type TableService = {
    id: string
    name: string
    durationMinutes: number
    kind?: string | null
    covers?: number | null
    isFree?: boolean
    priceCents?: number
}

function dayOptions(count = 7) {
    const out: { key: string; label: string; sub: string }[] = []
    const now = new Date()
    for (let i = 0; i < count; i++) {
        const d = new Date(now)
        d.setDate(now.getDate() + i)
        const key = localDateKey(d)
        const weekday = d.toLocaleDateString(undefined, { weekday: "short" })
        out.push({
            key,
            label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday,
            sub: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        })
    }
    return out
}

export function ReserveSheet({
    open,
    onClose,
    profile,
    service,
}: {
    open: boolean
    onClose: () => void
    profile: { id: string; displayName: string; whatsapp?: string | null }
    service: TableService | null
}) {
    const [partySize, setPartySize] = useState(2)
    const [date, setDate] = useState(localDateKey())
    const [slots, setSlots] = useState<string[]>([])
    const [time, setTime] = useState("")
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [notes, setNotes] = useState("")
    const [busy, setBusy] = useState(false)
    const [booked, setBooked] = useState<{ id: string; start: Date; end: Date } | null>(null)
    const days = useMemo(() => dayOptions(), [])

    useEffect(() => {
        if (!open || !service) return
        setLoading(true)
        setTime("")
        getAvailableSlots(profile.id, date, service.durationMinutes || 90, {
            partySize,
            serviceId: service.id,
        })
            .then(setSlots)
            .catch(() => setSlots([]))
            .finally(() => setLoading(false))
    }, [open, date, partySize, profile.id, service])

    function reset() {
        setPartySize(2)
        setDate(localDateKey())
        setTime("")
        setName("")
        setPhone("")
        setNotes("")
        setBooked(null)
        setBusy(false)
    }

    async function hold() {
        if (!service || !time || !name.trim() || !phone.trim()) return
        setBusy(true)
        try {
            const created = await createBooking({
                profileId: profile.id,
                serviceOfferingId: service.id,
                startTime: `${date}T${time}:00`,
                visitorName: name.trim(),
                visitorPhone: phone.trim(),
                partySize,
                notes: notes.trim() || undefined,
            })
            setBooked({
                id: created.id,
                start: new Date(created.startTime),
                end: new Date(created.endTime),
            })
            toast.success("Table reserved")
        } catch {
            toast.error("That time just filled. Pick another.")
            const next = await getAvailableSlots(profile.id, date, service.durationMinutes || 90, {
                partySize,
                serviceId: service.id,
            }).catch(() => [])
            setSlots(next)
            setTime("")
        } finally {
            setBusy(false)
        }
    }

    const wa = whatsappHref(
        profile.whatsapp,
        `Hi ${profile.displayName}, table for ${partySize} on ${date}${time ? ` at ${time}` : ""} — ${name || ""} ${phone || ""}`.trim(),
    )

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    reset()
                    onClose()
                }
            }}
        >
            <SheetContent
                side="bottom"
                className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[1.75rem] border-white/10 bg-zinc-950 p-0 text-zinc-100"
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
                {booked ? (
                    <div className="space-y-4 px-5 py-8 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                            <CheckCircle className="h-7 w-7 text-emerald-400" />
                        </div>
                        <SheetHeader className="space-y-1 p-0">
                            <SheetTitle className="text-xl text-white">Table reserved</SheetTitle>
                            <SheetDescription className="text-zinc-400">
                                {profile.displayName} · table for {partySize} · {date} at {time}
                            </SheetDescription>
                        </SheetHeader>
                        <CalendarLinks
                            event={{
                                id: booked.id,
                                title: `Table for ${partySize} at ${profile.displayName}`,
                                start: booked.start,
                                end: booked.end,
                            }}
                            icsHref={`/api/calendar/event/${booked.id}`}
                        />
                        <Button
                            className="h-11 w-full rounded-full bg-white text-zinc-950"
                            onClick={() => {
                                reset()
                                onClose()
                            }}
                        >
                            Done
                        </Button>
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-3 pb-4">
                            <SheetHeader className="space-y-1 p-0 text-left">
                                <SheetTitle className="text-lg text-white">Reserve a table</SheetTitle>
                                <SheetDescription>Party, time, phone. We hold it for you.</SheetDescription>
                            </SheetHeader>

                            <div>
                                <p className="mb-2 text-xs text-zinc-500">Party</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setPartySize(n)}
                                            className={cn(
                                                "h-10 w-10 rounded-full text-sm",
                                                partySize === n ? "bg-cyan-500 text-zinc-950" : "bg-white/8 text-zinc-300",
                                            )}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs text-zinc-500">When</p>
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {days.map((d) => (
                                        <button
                                            key={d.key}
                                            type="button"
                                            onClick={() => setDate(d.key)}
                                            className={cn(
                                                "shrink-0 rounded-2xl px-3 py-2 text-left",
                                                date === d.key ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300",
                                            )}
                                        >
                                            <p className="text-sm font-medium">{d.label}</p>
                                            <p className="text-[11px] opacity-70">{d.sub}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs text-zinc-500">Time</p>
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                                    </div>
                                ) : slots.length ? (
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {slots.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setTime(s)}
                                                className={cn(
                                                    "h-10 rounded-xl text-sm tabular-nums",
                                                    time === s ? "bg-cyan-500 text-zinc-950" : "bg-white/8 text-zinc-300",
                                                )}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="py-4 text-center text-sm text-zinc-500">
                                        No tables left this day
                                        {wa ? (
                                            <>
                                                {" · "}
                                                <a href={wa} target="_blank" rel="noreferrer" className="text-cyan-400">
                                                    WhatsApp us
                                                </a>
                                            </>
                                        ) : null}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2.5">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Name"
                                    className="h-12 rounded-2xl border-white/10 bg-zinc-900 text-base"
                                />
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Phone"
                                    inputMode="tel"
                                    className="h-12 rounded-2xl border-white/10 bg-zinc-900 text-base"
                                />
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notes — window, high chair, allergy"
                                    rows={2}
                                    className="rounded-2xl border-white/10 bg-zinc-900"
                                />
                            </div>
                        </div>
                        <div className="shrink-0 border-t border-white/10 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
                            <Button
                                className="h-11 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                                disabled={busy || !time || !name.trim() || !phone.trim()}
                                onClick={() => void hold()}
                            >
                                {busy ? "Holding…" : `Hold table for ${partySize}`}
                            </Button>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
