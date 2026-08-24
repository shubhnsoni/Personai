"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Event } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PhotoStage } from "@/components/shop/photo-stage"
import { createEvent, updateEvent, type EventData } from "@/app/actions/events"
import { OfferFooter, OfferSheet, LiveRow, MoreToggle, PillRow, uploadOne } from "@/components/dashboard/offer-sheet"

function toLocal(date?: Date | string) {
    if (!date) return ""
    const d = new Date(date)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function plusHour(start: string) {
    if (!start) return ""
    const d = new Date(start)
    if (Number.isNaN(d.getTime())) return ""
    d.setHours(d.getHours() + 1)
    return toLocal(d)
}

export function EventForm({
    profileId,
    event,
    open,
    onOpenChange,
    embedded,
}: {
    profileId: string
    event?: Event | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    embedded?: boolean
}) {
    const router = useRouter()
    const editing = !!event
    const [more, setMore] = useState(Boolean(embedded))
    const [title, setTitle] = useState("")
    const [eventType, setEventType] = useState<"WEBINAR" | "WORKSHOP" | "MEETUP">("WEBINAR")
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [timezone, setTimezone] = useState("Asia/Kolkata")
    const [price, setPrice] = useState("")
    const [photo, setPhoto] = useState<string | null>(null)
    const [description, setDescription] = useState("")
    const [location, setLocation] = useState("")
    const [meetingUrl, setMeetingUrl] = useState("")
    const [maxAttendees, setMaxAttendees] = useState("")
    const [live, setLive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (!embedded && !open) return
        setMore(Boolean(embedded) || Boolean(event))
        setTitle(event?.title || "")
        setEventType((event?.eventType as "WEBINAR" | "WORKSHOP" | "MEETUP") || "WEBINAR")
        setStartTime(toLocal(event?.startTime))
        setEndTime(toLocal(event?.endTime))
        setTimezone(event?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata")
        setPrice(event && !event.isFree ? String(event.priceCents / 100) : "")
        setPhoto(event?.thumbnailUrl || null)
        setDescription(event?.description || "")
        setLocation(event?.location || "")
        setMeetingUrl(event?.meetingUrl || "")
        setMaxAttendees(event?.maxAttendees != null ? String(event.maxAttendees) : "")
        setLive(event?.isActive ?? true)
    }, [open, event, embedded])

    async function save() {
        if (!title.trim() || !startTime) return
        setBusy(true)
        try {
            const data: EventData = {
                title: title.trim(),
                description: description.trim() || undefined,
                eventType,
                startTime,
                endTime: endTime || plusHour(startTime),
                timezone,
                location: location.trim() || undefined,
                meetingUrl: meetingUrl.trim() || undefined,
                price: parseFloat(price) || 0,
                isFree: !price || parseFloat(price) === 0,
                maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
                thumbnailUrl: photo || undefined,
                isActive: live,
            }
            if (editing && event) await updateEvent(event.id, data)
            else await createEvent(profileId, data)
            toast.success(editing ? "Saved" : "Event live")
            onOpenChange?.(false)
            router.refresh()
            if (embedded) router.push("/dashboard/events")
        } catch {
            toast.error("Could not save")
        } finally {
            setBusy(false)
        }
    }

    const fields = (
        <>
            <PhotoStage
                photos={photo ? [photo] : []}
                active={0}
                onSelect={() => {}}
                onRemove={() => setPhoto(null)}
                uploading={uploading}
                emptyLabel="Cover"
                onAdd={async (files) => {
                    setUploading(true)
                    try {
                        const url = files[0] ? await uploadOne(files[0]) : null
                        if (url) setPhoto(url)
                    } finally {
                        setUploading(false)
                    }
                }}
            />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event name" autoFocus={!embedded} className="h-12 rounded-2xl border-border/70 text-base" />
            <PillRow
                value={eventType}
                onChange={setEventType}
                options={[
                    { id: "WEBINAR", label: "Webinar" },
                    { id: "WORKSHOP", label: "Workshop" },
                    { id: "MEETUP", label: "Meetup" },
                ]}
            />
            <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                    setStartTime(e.target.value)
                    if (!endTime) setEndTime(plusHour(e.target.value))
                }}
                className="h-12 rounded-2xl border-border/70 text-base"
            />
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (0 = free)" className="h-12 rounded-2xl border-border/70 text-base" />
            <LiveRow checked={live} onChange={setLive} />
            <MoreToggle open={more} onClick={() => setMore((v) => !v)} />
            {more ? (
                <div className="space-y-3 pb-2">
                    <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-11 rounded-2xl" />
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Timezone" className="h-11 rounded-2xl" />
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Place (optional)" className="h-11 rounded-2xl" />
                    <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="Zoom / Meet link" className="h-11 rounded-2xl" />
                    <Input type="number" min="1" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} placeholder="Max seats (optional)" className="h-11 rounded-2xl" />
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happens" rows={3} className="rounded-2xl" />
                </div>
            ) : null}
        </>
    )

    const footer = (
        <OfferFooter
            onCancel={() => (embedded ? router.push("/dashboard/events") : onOpenChange?.(false))}
            busy={busy}
            disabled={!title.trim() || !startTime}
            label={editing ? "Save" : "Add event"}
        />
    )

    if (embedded) {
        return (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
                {footer}
            </form>
        )
    }

    return (
        <OfferSheet
            open={Boolean(open)}
            onOpenChange={(next) => onOpenChange?.(next)}
            title={editing ? "Edit event" : "Add event"}
            description="Name, when, price. Tap More for place and link."
            footer={<form onSubmit={(e) => { e.preventDefault(); void save() }}>{footer}</form>}
        >
            <form className="space-y-4 pb-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
            </form>
        </OfferSheet>
    )
}
