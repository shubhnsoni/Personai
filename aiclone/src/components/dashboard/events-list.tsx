"use client"

import { useMemo, useState, useTransition } from "react"
import { Event } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { Calendar, Copy, ExternalLink, Plus, Trash2, Users } from "lucide-react"
import { deleteEvent, setEventActive } from "@/app/actions/events"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { CatalogSearch, FilterChips, ViewToggle, useCatalogView } from "@/components/dashboard/catalog-chrome"
import { OfferCover } from "@/components/dashboard/offer-cover"
import { EventForm } from "@/components/dashboard/event-form"
import { useMoney } from "@/components/pricing-provider"
import { toast } from "sonner"

interface EventWithCounts extends Event {
    _count: { registrations: number }
}

function formatWhen(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(date))
}

export function EventsList({ slug, profileId, events }: { slug: string; profileId: string; events: EventWithCounts[] }) {
    const [view, setView] = useCatalogView("pl-events-view")
    const [q, setQ] = useState("")
    const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "free">("all")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<EventWithCounts | null>(null)

    const now = Date.now()
    const upcoming = events.filter((e) => new Date(e.startTime).getTime() >= now).length
    const registered = events.reduce((s, e) => s + (e._count.registrations || 0), 0)

    const rows = useMemo(() => {
        return events.filter((e) => {
            const isPast = new Date(e.startTime).getTime() < now
            if (filter === "upcoming" && isPast) return false
            if (filter === "past" && !isPast) return false
            if (filter === "free" && e.priceCents > 0 && !e.isFree) return false
            if (!q.trim()) return true
            const hay = `${e.title} ${e.location || ""} ${e.eventType}`.toLowerCase()
            return hay.includes(q.trim().toLowerCase())
        })
    }, [events, filter, q, now])

    const remove = async (id: string) => {
        if (!confirm("Delete this event? Registrations will be removed.")) return
        setDeletingId(id)
        try {
            await deleteEvent(id)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <CatalogSearch value={q} onChange={setQ} />
                <ViewToggle view={view} onChange={setView} />
            </div>
            <FilterChips
                value={filter}
                onChange={setFilter}
                count={`${upcoming} upcoming · ${registered} registered`}
                items={[
                    { id: "all", label: "All" },
                    { id: "upcoming", label: "Upcoming" },
                    { id: "past", label: "Past" },
                    { id: "free", label: "Free" },
                ]}
            />

            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Calendar />}
                        title={events.length === 0 ? "No events yet" : "Nothing matches"}
                        description={events.length === 0 ? "Host a webinar, workshop, or office hours." : "Try another search or filter."}
                    />
                </div>
            ) : view === "list" ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((event) => (
                        <EventRow
                            key={event.id}
                            event={event}
                            deleting={deletingId === event.id}
                            pending={pending}
                            onOpen={() => setEditing(event)}
                            onToggle={(on) => startTransition(async () => { await setEventActive(event.id, on) })}
                            onDelete={() => remove(event.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {rows.map((event) => (
                        <EventTile
                            key={event.id}
                            event={event}
                            deleting={deletingId === event.id}
                            pending={pending}
                            onOpen={() => setEditing(event)}
                            onToggle={(on) => startTransition(async () => { await setEventActive(event.id, on) })}
                            onDelete={() => remove(event.id)}
                        />
                    ))}
                </div>
            )}

            <StudioDock>
                <DockTabs
                    tabs={[
                        {
                            id: "copy",
                            label: "Copy",
                            icon: <Copy />,
                            onClick: async () => {
                                const url = `${window.location.origin}/${slug}/events`
                                try {
                                    await navigator.clipboard.writeText(url)
                                    toast.success("Events link copied")
                                } catch {
                                    toast.error(url)
                                }
                            },
                        },
                        { id: "community", label: "Community", icon: <Users />, href: "/dashboard/community" },
                        { id: "live", label: "Live", icon: <ExternalLink />, href: `/${slug}/events`, target: "_blank" },
                    ]}
                />
                <Button className="shrink-0 rounded-full" onClick={() => { setEditing(null); setAdding(true) }}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
            </StudioDock>
            <EventForm
                open={adding || !!editing}
                onOpenChange={(next) => {
                    setAdding(next)
                    if (!next) setEditing(null)
                }}
                profileId={profileId}
                event={editing}
            />
        </div>
    )
}

function eventMeta(event: EventWithCounts, money: (cents: number) => string) {
    const past = new Date(event.startTime).getTime() < Date.now()
    return [
        formatWhen(event.startTime),
        money(event.isFree ? 0 : event.priceCents),
        event.isActive ? null : "Off",
        past ? "Past" : null,
    ].filter(Boolean).join(" · ")
}

function EventRow({
    event,
    deleting,
    pending,
    onOpen,
    onToggle,
    onDelete,
}: {
    event: EventWithCounts
    deleting: boolean
    pending: boolean
    onOpen: () => void
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const money = useMoney()
    return (
        <div className="flex items-center gap-2.5 border-b border-border/50 px-2.5 py-2 last:border-b-0">
            <button type="button" onClick={onOpen} className="shrink-0">
                <OfferCover
                    src={event.thumbnailUrl}
                    kind={event.eventType}
                    title={event.title}
                    kicker={String(new Date(event.startTime).getDate())}
                    hideIcon
                    className="h-12 w-12 rounded-xl"
                />
            </button>
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{event.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{eventMeta(event, money)}</p>
            </button>
            <Switch checked={event.isActive} disabled={pending} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

function EventTile({
    event,
    deleting,
    pending,
    onOpen,
    onToggle,
    onDelete,
}: {
    event: EventWithCounts
    deleting: boolean
    pending: boolean
    onOpen: () => void
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const money = useMoney()
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <button type="button" onClick={onOpen} className="block w-full">
                <OfferCover src={event.thumbnailUrl} kind={event.eventType} title={event.title} className="aspect-square w-full" />
            </button>
            <div className="flex flex-col gap-3 p-3">
                <button type="button" onClick={onOpen} className="min-h-[2.75rem] text-left">
                    <p className="line-clamp-2 text-sm font-medium leading-5">{event.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{eventMeta(event, money)}</p>
                </button>
                <div className="flex items-center justify-between pt-0.5">
                    <Switch checked={event.isActive} disabled={pending} onCheckedChange={onToggle} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={onDelete} disabled={deleting}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
