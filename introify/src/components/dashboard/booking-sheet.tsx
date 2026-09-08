"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { CalBooking } from "@/components/dashboard/calendar-week"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { CalendarLinks } from "@/components/calendar/calendar-links"
import { parseReservation, reservationLabel } from "@/lib/menu"
import { whatsappHref } from "@/lib/commerce"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"

export function BookingSheet({
    booking,
    onClose,
    pending,
    onStatus,
}: {
    booking: CalBooking | null
    onClose: () => void
    pending?: boolean
    onStatus?: (id: string, status: "CONFIRMED" | "CANCELLED") => void
}) {
    if (!booking) return null
    const start = new Date(booking.startTime)
    const end = new Date(booking.endTime)
    const cancelled = booking.status === "CANCELLED"
    const confirmed = booking.status === "CONFIRMED"
    const hold = booking.visitorEmail === "hold@local"
    const res = parseReservation(booking.metadata)
    const table = Boolean(res.partySize && booking.metadata && /partySize/.test(booking.metadata))
    const wa = res.phone ? whatsappHref(res.phone, `Hi ${booking.visitorName}, about your table for ${res.partySize}`) : null

    return (
        <Sheet open={!!booking} onOpenChange={(open) => { if (!open) onClose() }}>
            <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetHeader>
                    <SheetTitle>{hold ? "Blocked time" : table ? `Table for ${res.partySize}` : booking.visitorName}</SheetTitle>
                </SheetHeader>
                <div className="space-y-3 px-4 pb-4">
                    <p className="text-sm text-muted-foreground">
                        {start.toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                        })}
                        {" – "}
                        {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </p>
                    <p className="text-sm">{table ? reservationLabel(booking.metadata, booking.service) : booking.service}</p>
                    {table ? (
                        <p className="text-sm text-muted-foreground">
                            {booking.visitorName}
                            {res.phone ? ` · ${res.phone}` : ""}
                            {res.notes ? ` · ${res.notes}` : ""}
                        </p>
                    ) : null}
                    {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-zinc-950" aria-label="WhatsApp guest">
                            <WhatsAppIcon className="h-4 w-4" />
                        </a>
                    ) : null}
                    {!hold && (
                        <button
                            type="button"
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(booking.visitorEmail)
                                    toast.success("Email copied")
                                } catch {
                                    toast.error(booking.visitorEmail)
                                }
                            }}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            {booking.visitorEmail}
                        </button>
                    )}
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {booking.status.replaceAll("_", " ").toLowerCase()}
                    </p>
                    {!hold && !cancelled && (
                        <CalendarLinks
                            event={{
                                id: booking.id,
                                title: `${booking.service} · ${booking.visitorName}`,
                                description: booking.visitorEmail,
                                start,
                                end,
                            }}
                            icsHref={`/api/calendar/event/${booking.id}`}
                        />
                    )}
                    {onStatus && !cancelled && (
                        <div className="flex gap-2 pt-2">
                            {!confirmed && (
                                <Button className="flex-1 rounded-full" disabled={pending} onClick={() => onStatus(booking.id, "CONFIRMED")}>
                                    Confirm
                                </Button>
                            )}
                            <Button
                                variant={confirmed ? "outline" : "ghost"}
                                className="flex-1 rounded-full text-destructive"
                                disabled={pending}
                                onClick={() => onStatus(booking.id, "CANCELLED")}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
