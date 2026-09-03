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
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { LARGE_PARTY_MIN, PartySizePicker } from "@/components/booking/party-size-picker"

type TableService = {
    id: string
    name: string
    durationMinutes: number
    kind?: string | null
    covers?: number | null
    isFree?: boolean
    priceCents?: number
}

export type ReserveMode = "table" | "session"
export type ReserveConfirmLabel =
    | "Hold table"
    | "Book session"
    | "Book consult"
    | "Book treatment"
    | "Request visit"

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

function sessionCopy(confirmLabel?: ReserveConfirmLabel) {
    switch (confirmLabel) {
        case "Book consult":
            return { title: "Book a consult", description: "Time and phone. We’ll hold it.", success: "Consult booked", empty: "No times left this day", toast: "Consult booked" }
        case "Book treatment":
            return { title: "Book a treatment", description: "Time and phone. We’ll hold it.", success: "Treatment booked", empty: "No times left this day", toast: "Treatment booked" }
        case "Request visit":
            return { title: "Request a visit", description: "Time and phone. We’ll request it.", success: "Visit requested", empty: "No times left this day", toast: "Visit requested" }
        default:
            return { title: "Book a session", description: "Time and phone. We’ll hold it.", success: "Session booked", empty: "No times left this day", toast: "Session booked" }
    }
}

export function ReserveSheet({
    open,
    onClose,
    profile,
    service,
    mode = "table",
    partyLabel,
    hideParty,
    confirmLabel,
}: {
    open: boolean
    onClose: () => void
    profile: { id: string; displayName: string; whatsapp?: string | null }
    service: TableService | null
    mode?: ReserveMode
    partyLabel?: string
    hideParty?: boolean
    confirmLabel?: ReserveConfirmLabel
}) {
    const isSession = mode === "session"
    const copy = isSession ? sessionCopy(confirmLabel) : null
    const defaultParty = isSession || hideParty ? 1 : 2
    const [partySize, setPartySize] = useState(defaultParty)
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
        const duration = service.durationMinutes || (isSession ? 30 : 90)
        getAvailableSlots(
            profile.id,
            date,
            duration,
            isSession
                ? { serviceId: service.id }
                : { partySize, serviceId: service.id },
        )
            .then(setSlots)
            .catch(() => setSlots([]))
            .finally(() => setLoading(false))
    }, [open, date, partySize, profile.id, service, isSession])

    function reset() {
        setPartySize(defaultParty)
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
            const extra = isSession
                ? (!hideParty && partyLabel === "Attendees" && partySize > 1 ? `${partySize} attendees` : "")
                : (partySize >= LARGE_PARTY_MIN ? `Large group of ${partySize} — join tables` : "")
            const created = await createBooking({
                profileId: profile.id,
                serviceOfferingId: service.id,
                startTime: `${date}T${time}:00`,
                visitorName: name.trim(),
                visitorPhone: phone.trim(),
                partySize: isSession && hideParty ? undefined : partySize,
                notes: [extra, notes.trim()].filter(Boolean).join(". ") || undefined,
            })
            setBooked({
                id: created.id,
                start: new Date(created.startTime),
                end: new Date(created.endTime),
            })
            toast.success(isSession ? copy!.toast : "Table reserved")
        } catch {
            toast.error("That time just filled. Pick another.")
            const duration = service.durationMinutes || (isSession ? 30 : 90)
            const next = await getAvailableSlots(
                profile.id,
                date,
                duration,
                isSession
                    ? { serviceId: service.id }
                    : { partySize, serviceId: service.id },
            ).catch(() => [])
            setSlots(next)
            setTime("")
        } finally {
            setBusy(false)
        }
    }

    const wa = whatsappHref(
        profile.whatsapp,
        isSession
            ? `Hi ${profile.displayName}, ${service?.name || "session"} on ${date}${time ? ` at ${time}` : ""} — ${name || ""} ${phone || ""}`.trim()
            : `Hi ${profile.displayName}, table for ${partySize} on ${date}${time ? ` at ${time}` : ""} — ${name || ""} ${phone || ""}`.trim(),
    )

    const confirmText = busy
        ? (isSession ? "Booking…" : "Holding…")
        : isSession
            ? (confirmLabel || "Book session")
            : partySize >= LARGE_PARTY_MIN
                ? `Request tables for ${partySize}`
                : `Hold table for ${partySize}`

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
                            <SheetTitle className="text-xl text-white">{isSession ? copy!.success : "Table reserved"}</SheetTitle>
                            <SheetDescription className="text-zinc-400">
                                {isSession
                                    ? `${profile.displayName} · ${service?.name || "Session"} · ${date} at ${time}`
                                    : `${profile.displayName} · table for ${partySize} · ${date} at ${time}`}
                            </SheetDescription>
                        </SheetHeader>
                        <CalendarLinks
                            event={{
                                id: booked.id,
                                title: isSession
                                    ? `${service?.name || "Session"} with ${profile.displayName}`
                                    : `Table for ${partySize} at ${profile.displayName}`,
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
                                <SheetTitle className="text-lg text-white">{isSession ? copy!.title : "Reserve a table"}</SheetTitle>
                                <SheetDescription>
                                    {isSession
                                        ? [service?.name, service?.durationMinutes ? `${service.durationMinutes} min` : null, copy!.description].filter(Boolean).join(" · ")
                                        : "Party, time, phone. We hold it for you."}
                                </SheetDescription>
                            </SheetHeader>

                            <PartySizePicker
                                value={partySize}
                                onChange={setPartySize}
                                label={partyLabel}
                                hidden={hideParty}
                            />

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
                                        {isSession ? copy!.empty : "No tables left this day"}
                                        {wa ? (
                                            <>
                                                {" · "}
                                                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-zinc-950" aria-label="WhatsApp">
                                                    <WhatsAppIcon className="h-4 w-4" />
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
                                    placeholder={isSession ? "Notes — agenda, add-on, access" : "Notes — window, high chair, allergy"}
                                    rows={2}
                                    className="rounded-2xl border-white/10 bg-zinc-900"
                                />
                            </div>
                        </div>
                        <div className="shrink-0 space-y-2 border-t border-white/10 px-5 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
                            {!isSession && partySize >= 20 && wa ? (
                                <a
                                    href={wa}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-semibold text-zinc-950"
                                >
                                    <WhatsAppIcon className="h-4 w-4" />
                                    WhatsApp for {partySize}
                                </a>
                            ) : null}
                            <Button
                                className="h-11 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                                disabled={busy || !time || !name.trim() || !phone.trim()}
                                onClick={() => void hold()}
                            >
                                {confirmText}
                            </Button>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
