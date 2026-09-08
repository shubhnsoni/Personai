"use client"

import { useMemo, useState, useTransition } from "react"
import { ServiceOffering } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { Briefcase, Calendar, Copy, ExternalLink, Plus, Trash2 } from "lucide-react"
import { OfferFooter, OfferSheet, LiveRow, MoreToggle, PillRow } from "@/components/dashboard/offer-sheet"
import { addService, updateService, deleteService, setServiceActive } from "@/app/actions/services"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { CatalogSearch, FilterChips, ViewToggle, useCatalogView } from "@/components/dashboard/catalog-chrome"
import { OfferCover } from "@/components/dashboard/offer-cover"
import { useMoney } from "@/components/pricing-provider"
import { toast } from "sonner"

type ServiceRow = ServiceOffering & { _count?: { bookings: number } }

export function ServicesManager({
    slug,
    profileId,
    services,
    allowTable,
}: {
    slug: string
    profileId: string
    services: ServiceRow[]
    allowTable?: boolean
}) {
    const [view, setView] = useCatalogView("pl-services-view")
    const [q, setQ] = useState("")
    const [filter, setFilter] = useState<"all" | "on" | "off" | "free">("all")
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<ServiceRow | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [price, setPrice] = useState("")
    const [duration, setDuration] = useState("30")
    const [isRecurring, setIsRecurring] = useState(false)
    const [sessions, setSessions] = useState("1")
    const [kind, setKind] = useState<"SESSION" | "TABLE">("SESSION")
    const [covers, setCovers] = useState("20")
    const [more, setMore] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pending, startTransition] = useTransition()

    const on = services.filter((s) => s.isActive).length
    const booked = services.reduce((s, row) => s + (row._count?.bookings || 0), 0)

    const rows = useMemo(() => {
        return services.filter((s) => {
            if (filter === "on" && !s.isActive) return false
            if (filter === "off" && s.isActive) return false
            if (filter === "free" && s.priceCents > 0) return false
            if (!q.trim()) return true
            const hay = `${s.name} ${s.description || ""}`.toLowerCase()
            return hay.includes(q.trim().toLowerCase())
        })
    }, [services, filter, q])

    const openCreate = () => {
        setEditing(null)
        setName("")
        setDescription("")
        setPrice("")
        setDuration("30")
        setIsRecurring(false)
        setSessions("1")
        setKind("SESSION")
        setCovers("20")
        setMore(false)
        setIsOpen(true)
    }

    const openEdit = (service: ServiceRow) => {
        setEditing(service)
        setName(service.name)
        setDescription(service.description || "")
        setPrice((service.priceCents / 100).toString())
        setDuration(String(service.durationMinutes))
        setIsRecurring(Boolean(service.isRecurring))
        setSessions(String(service.packageSessions || 1))
        setKind(((service as { kind?: string }).kind === "TABLE" ? "TABLE" : "SESSION"))
        setCovers(String((service as { covers?: number | null }).covers || 20))
        setMore(true)
        setIsOpen(true)
    }

    const handleSave = async () => {
        if (!name.trim() || !duration) return
        setIsSubmitting(true)
        try {
            const payload = {
                name: name.trim(),
                description,
                price: parseFloat(price) || 0,
                duration: parseInt(duration, 10) || 30,
                isRecurring,
                packageSessions: parseInt(sessions, 10) || 1,
                kind,
                covers: kind === "TABLE" ? parseInt(covers, 10) || 20 : null,
            }
            if (editing) {
                await updateService(editing.id, payload)
            } else {
                await addService(profileId, payload)
            }
            setIsOpen(false)
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this service?")) return
        await deleteService(id)
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
                count={`${on} on · ${booked} booked`}
                items={[
                    { id: "all", label: "All" },
                    { id: "on", label: "On" },
                    { id: "off", label: "Off" },
                    { id: "free", label: "Free" },
                ]}
            />

            <OfferSheet
                open={isOpen}
                onOpenChange={setIsOpen}
                title={editing ? "Edit booking" : kind === "TABLE" ? "Add table" : "Add session"}
                description="Name, time, price. Tap More for packs and covers."
                footer={
                    <form onSubmit={(e) => { e.preventDefault(); void handleSave() }}>
                        <OfferFooter
                            onCancel={() => setIsOpen(false)}
                            busy={isSubmitting}
                            disabled={!name.trim()}
                            label={editing ? "Save" : "Add"}
                        />
                    </form>
                }
            >
                <form
                    className="space-y-3 pb-2"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void handleSave()
                    }}
                >
                    {allowTable ? (
                    <PillRow
                        value={kind}
                        onChange={(id) => {
                            setKind(id)
                            if (id === "TABLE") setDuration((d) => d === "30" ? "90" : d)
                        }}
                        options={[
                            { id: "SESSION", label: "Session" },
                            { id: "TABLE", label: "Table" },
                        ]}
                    />
                    ) : null}
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "TABLE" ? "Reserve a table" : "Fit call"} className="h-12 rounded-2xl border-border/70 text-base" />
                    <div className="grid grid-cols-2 gap-2.5">
                        <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="h-12 rounded-2xl border-border/70 text-base" />
                        <Input type="number" min="15" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Minutes" className="h-12 rounded-2xl border-border/70 text-base" />
                    </div>
                    <MoreToggle open={more} onClick={() => setMore((v) => !v)} />
                    {more ? (
                        <div className="space-y-3">
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's included" rows={3} className="rounded-2xl" />
                            {kind === "TABLE" ? (
                                <Input type="number" min="1" value={covers} onChange={(e) => setCovers(e.target.value)} placeholder="Covers (seats)" className="h-11 rounded-2xl" />
                            ) : (
                                <>
                                    <Input type="number" min="1" value={sessions} onChange={(e) => setSessions(e.target.value)} placeholder="Sessions in pack" className="h-11 rounded-2xl" />
                                    <LiveRow checked={isRecurring} onChange={setIsRecurring} label="Monthly retainer" />
                                </>
                            )}
                        </div>
                    ) : null}
                </form>
            </OfferSheet>

            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Briefcase />}
                        title={services.length === 0 ? "No sessions to book" : "Nothing matches"}
                        description={services.length === 0 ? "Add a call people can book from chat or your book page." : "Try another search or filter."}
                    />
                </div>
            ) : view === "list" ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((service) => (
                        <ServiceRow
                            key={service.id}
                            service={service}
                            pending={pending}
                            onEdit={() => openEdit(service)}
                            onToggle={(on) => startTransition(async () => { await setServiceActive(service.id, on) })}
                            onDelete={() => handleDelete(service.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {rows.map((service) => (
                        <ServiceTile
                            key={service.id}
                            service={service}
                            pending={pending}
                            onEdit={() => openEdit(service)}
                            onToggle={(on) => startTransition(async () => { await setServiceActive(service.id, on) })}
                            onDelete={() => handleDelete(service.id)}
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
                                const url = `${window.location.origin}/${slug}/book`
                                try {
                                    await navigator.clipboard.writeText(url)
                                    toast.success("Book link copied")
                                } catch {
                                    toast.error(url)
                                }
                            },
                        },
                        { id: "calendar", label: "Calendar", icon: <Calendar />, href: "/dashboard/calendar" },
                        { id: "live", label: "Live", icon: <ExternalLink />, href: `/${slug}/book`, target: "_blank" },
                    ]}
                />
                <Button className="shrink-0 rounded-full" onClick={openCreate}>
                    <Plus className="mr-1 h-4 w-4" /> Add service
                </Button>
            </StudioDock>
        </div>
    )
}

function serviceMeta(service: ServiceRow, money: (cents: number) => string) {
    return [
        money(service.priceCents),
        `${service.durationMinutes} min`,
        service.packageSessions > 1 ? `${service.packageSessions} sessions` : null,
        service.isRecurring ? "Monthly" : null,
        service.isActive ? null : "Off",
    ].filter(Boolean).join(" · ")
}

function ServiceRow({
    service,
    pending,
    onEdit,
    onToggle,
    onDelete,
}: {
    service: ServiceRow
    pending: boolean
    onEdit: () => void
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const money = useMoney()
    return (
        <div className="flex items-center gap-2.5 border-b border-border/50 px-2.5 py-2 last:border-b-0">
            <button type="button" onClick={onEdit} className="shrink-0">
                <OfferCover kind="SERVICE" title={service.name} kicker={`${service.durationMinutes}m`} hideIcon className="h-12 w-12 rounded-xl" />
            </button>
            <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{service.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{serviceMeta(service, money)}</p>
            </button>
            <Switch checked={service.isActive} disabled={pending} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

function ServiceTile({
    service,
    pending,
    onEdit,
    onToggle,
    onDelete,
}: {
    service: ServiceRow
    pending: boolean
    onEdit: () => void
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const money = useMoney()
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <button type="button" onClick={onEdit} className="block w-full">
                <OfferCover kind="SERVICE" title={service.name} kicker={`${service.durationMinutes} min`} className="aspect-square w-full" hideIcon />
            </button>
            <div className="flex flex-col gap-3 p-3">
                <button type="button" onClick={onEdit} className="min-h-[2.75rem] text-left">
                    <p className="line-clamp-2 text-sm font-medium leading-5">{service.name}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{serviceMeta(service, money)}</p>
                </button>
                <div className="flex items-center justify-between pt-0.5">
                    <Switch checked={service.isActive} disabled={pending} onCheckedChange={onToggle} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={onDelete}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
