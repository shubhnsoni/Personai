"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Calendar, Copy, Download, Link2, Mail, MessageSquare, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { ResendLibraryLink } from "@/components/dashboard/resend-library-link"
import { EmptyState } from "@/components/ui/empty-state"
import { LEAD_STATUSES, leadStatusLabel, normalizeLeadStatus } from "@/lib/lead-status"
import { createLead, deleteLead, setLeadFollowUp, updateLeadNote, updateLeadStatus } from "@/app/actions/leads"
import { followUpState, todayKey } from "@/lib/lead-meta"

export type StudioLead = {
    id: string
    name: string
    email: string
    company: string | null
    budgetRange: string | null
    status: string
    note: string
    followUpAt: string | null
    activity: { at: string; kind: string; text: string }[]
    createdAt: string
    chatId: string | null
    lastChat: string | null
    waitingOnYou: boolean
    purchases: string[]
    courses: string[]
    bookings: number
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function relTime(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return mins < 1 ? "just now" : `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString()
}

export function LeadsStudio({
    leads,
    slug,
    displayName,
}: {
    leads: StudioLead[]
    slug: string
    displayName: string
}) {
    const [q, setQ] = useState("")
    const [filter, setFilter] = useState<"all" | "NEW" | "CONTACTED" | "CLOSED" | "LOST" | "due" | "waiting">("all")
    const [sort, setSort] = useState<"new" | "due" | "wait">("new")
    const [selected, setSelected] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const [pending, startTransition] = useTransition()

    const counts = useMemo(() => {
        const c = { all: leads.length, NEW: 0, CONTACTED: 0, CLOSED: 0, LOST: 0, due: 0, waiting: 0 }
        for (const l of leads) {
            c[normalizeLeadStatus(l.status)]++
            const fu = followUpState(l.followUpAt)
            if (fu === "overdue" || fu === "today") c.due++
            if (l.waitingOnYou && normalizeLeadStatus(l.status) !== "LOST") c.waiting++
        }
        return c
    }, [leads])

    const rows = useMemo(() => {
        const next = leads
            .filter((l) => {
                if (filter === "all") return true
                if (filter === "due") {
                    const fu = followUpState(l.followUpAt)
                    return fu === "overdue" || fu === "today"
                }
                if (filter === "waiting") return l.waitingOnYou
                return normalizeLeadStatus(l.status) === filter
            })
            .filter((l) => {
                if (!q.trim()) return true
                const hay = `${l.name} ${l.email} ${l.company || ""} ${l.budgetRange || ""} ${l.note}`.toLowerCase()
                return hay.includes(q.trim().toLowerCase())
            })
        next.sort((a, b) => {
            if (sort === "due") return (a.followUpAt || "9999").localeCompare(b.followUpAt || "9999")
            if (sort === "wait") return Number(b.waitingOnYou) - Number(a.waitingOnYou)
            return +new Date(b.createdAt) - +new Date(a.createdAt)
        })
        return next
    }, [leads, filter, q, sort])

    const active = leads.find((l) => l.id === selected) || null

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            {(counts.NEW > 0 || counts.due > 0 || counts.waiting > 0) && (
                <p className="text-xs text-muted-foreground">
                    {counts.NEW > 0 ? `${counts.NEW} new` : ""}
                    {counts.due > 0 ? `${counts.NEW ? " · " : ""}${counts.due} follow-up${counts.due === 1 ? "" : "s"} due` : ""}
                    {counts.waiting > 0 ? `${counts.NEW || counts.due ? " · " : ""}${counts.waiting} waiting on you` : ""}
                </p>
            )}
            <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-border/70 bg-card">
                {LEAD_STATUSES.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setFilter(filter === s.id ? "all" : s.id)}
                        className={cn(
                            "border-r border-border/60 px-2 py-2.5 last:border-r-0",
                            filter === s.id && "bg-aurora/8"
                        )}
                    >
                        <p className="text-[11px] text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-semibold tabular-nums">{counts[s.id]}</p>
                    </button>
                ))}
            </div>

            <div className="flex gap-1 overflow-x-auto">
                {([
                    { id: "due" as const, label: "Due", n: counts.due },
                    { id: "waiting" as const, label: "Waiting", n: counts.waiting },
                ]).map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(filter === f.id ? "all" : f.id)}
                        className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs",
                            filter === f.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                        )}
                    >
                        {f.label} {f.n}
                    </button>
                ))}
                <span className="ml-auto flex shrink-0 gap-1">
                {(["new", "due", "wait"] as const).map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setSort(s)}
                        className={cn(
                            "rounded-full px-2.5 py-1 text-xs",
                            sort === s ? "bg-muted text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {s === "new" ? "Newest" : s === "due" ? "By due" : "Replies"}
                    </button>
                ))}
                </span>
            </div>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads" className="h-10 rounded-full pl-8" />
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70 bg-card">
                {rows.length === 0 ? (
                    <EmptyState
                        title={leads.length === 0 ? "No leads yet" : "Nothing matches"}
                        description={leads.length === 0 ? "When someone leaves their email in chat, they land here." : "Try another search or status."}
                    />
                ) : (
                    rows.map((lead) => (
                        <button
                            key={lead.id}
                            type="button"
                            onClick={() => setSelected(lead.id)}
                            className={cn(
                                "flex w-full items-start gap-3 border-b border-border/40 px-3 py-3 text-left last:border-b-0 hover:bg-muted/40",
                                selected === lead.id && "bg-aurora/8",
                                followUpState(lead.followUpAt) === "overdue" && "bg-red-500/[0.04]"
                            )}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aurora/15 text-xs font-medium text-aurora">
                                {initials(lead.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="truncate text-sm font-medium">{lead.name}</p>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">{relTime(lead.createdAt)}</span>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                    {lead.company ? `${lead.company} · ` : ""}
                                    {lead.email}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {leadStatusLabel(lead.status)}
                                    </span>
                                    {lead.waitingOnYou && (
                                        <span className="rounded-full bg-aurora/15 px-1.5 py-0.5 text-[10px] text-aurora">Waiting on you</span>
                                    )}
                                    {followUpState(lead.followUpAt) === "overdue" && (
                                        <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-500">Overdue</span>
                                    )}
                                    {followUpState(lead.followUpAt) === "today" && (
                                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">Due today</span>
                                    )}
                                    {lead.budgetRange && (
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            {lead.budgetRange}
                                        </span>
                                    )}
                                    {lead.chatId && !lead.waitingOnYou && (
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Chat</span>
                                    )}
                                    {lead.purchases.length + lead.courses.length > 0 && (
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Buyer</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>

            <LeadDetail
                lead={active}
                slug={slug}
                displayName={displayName}
                open={!!active}
                pending={pending}
                onClose={() => setSelected(null)}
                onStatus={(id, status) => startTransition(async () => { await updateLeadStatus(id, status); toast.success("Updated") })}
                onDelete={(id) => startTransition(async () => { await deleteLead(id); setSelected(null); toast.success("Removed") })}
            />

            <AddLeadSheet open={adding} onOpenChange={setAdding} pending={pending} startTransition={startTransition} />

            <StudioDock>
                <Button variant="outline" className="rounded-full" type="button" onClick={() => exportCsv(rows)}>
                    <Download className="mr-1 h-4 w-4" /> Export
                </Button>
                <Button className="rounded-full" onClick={() => setAdding(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Add lead
                </Button>
            </StudioDock>
        </div>
    )
}

function LeadDetail({
    lead,
    slug,
    displayName,
    open,
    pending,
    onClose,
    onStatus,
    onDelete,
}: {
    lead: StudioLead | null
    slug: string
    displayName: string
    open: boolean
    pending: boolean
    onClose: () => void
    onStatus: (id: string, status: string) => void
    onDelete: (id: string) => void
}) {
    const [note, setNote] = useState("")

    useEffect(() => {
        setNote(lead?.note || "")
    }, [lead?.id, lead?.note])

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-auto rounded-t-3xl p-0 sm:max-w-none">
                {lead && (
                    <>
                        <SheetHeader className="relative space-y-0 border-b border-border/60 p-0">
                            <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" />
                            <div className="flex items-center gap-3 px-4 pb-3 pt-6 pr-12">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-aurora/15 text-sm font-medium text-aurora">
                                    {initials(lead.name)}
                                </div>
                                <div className="min-w-0 text-left">
                                    <SheetTitle className="truncate text-base">{lead.name}</SheetTitle>
                                    <SheetDescription className="truncate">{lead.email}</SheetDescription>
                                </div>
                            </div>
                        </SheetHeader>

                        <div className="space-y-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                            <div className="flex flex-wrap gap-1.5">
                                {LEAD_STATUSES.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        disabled={pending}
                                        onClick={() => onStatus(lead.id, s.id)}
                                        className={cn(
                                            "rounded-full px-3 py-1.5 text-xs",
                                            normalizeLeadStatus(lead.status) === s.id
                                                ? "bg-foreground text-background"
                                                : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <Meta label="Company" value={lead.company || "—"} />
                                <Meta label="Budget" value={lead.budgetRange || "—"} />
                                <Meta label="Added" value={new Date(lead.createdAt).toLocaleDateString()} />
                                <Meta label="Bookings" value={String(lead.bookings)} />
                            </div>

                            {lead.lastChat && (
                                <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                                    <p className="text-[11px] text-muted-foreground">Last chat</p>
                                    <p className="line-clamp-3 text-sm">{lead.lastChat}</p>
                                </div>
                            )}

                            {(lead.purchases.length > 0 || lead.courses.length > 0) && (
                                <div className="flex flex-wrap gap-1.5">
                                    {[...lead.courses, ...lead.purchases].map((item) => (
                                        <span key={item} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Follow up</Label>
                                <Input
                                    type="date"
                                    value={lead.followUpAt?.slice(0, 10) || ""}
                                    onChange={(e) => setLeadFollowUp(lead.id, e.target.value || null).then(() => toast.success("Follow-up set"))}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: "Today", days: 0 },
                                        { label: "Tomorrow", days: 1 },
                                        { label: "In 3 days", days: 3 },
                                        { label: "Next week", days: 7 },
                                    ].map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                                            onClick={async () => {
                                                const d = new Date()
                                                d.setDate(d.getDate() + opt.days)
                                                await setLeadFollowUp(lead.id, todayKey(d))
                                                toast.success(`Follow-up ${opt.label.toLowerCase()}`)
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                    {lead.followUpAt && (
                                        <button
                                            type="button"
                                            className="rounded-full px-2.5 py-1 text-[11px] text-muted-foreground"
                                            onClick={async () => { await setLeadFollowUp(lead.id, null); toast.success("Cleared") }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Note</Label>
                                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Next step, fit, anything useful…" />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    disabled={pending || note === lead.note}
                                    onClick={async () => {
                                        await updateLeadNote(lead.id, note)
                                        toast.success("Note saved")
                                    }}
                                >
                                    Save note
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {lead.chatId ? (
                                    <Button variant="outline" className="rounded-full" asChild>
                                        <Link href={`/dashboard/inbox?c=${lead.chatId}`}><MessageSquare className="h-4 w-4" /> Open chat</Link>
                                    </Button>
                                ) : (
                                    <Button variant="outline" className="rounded-full" disabled>
                                        <MessageSquare className="h-4 w-4" /> No chat
                                    </Button>
                                )}
                                <Button variant="outline" className="rounded-full" asChild>
                                    <a href={mailHref(lead, displayName, slug, "intro")}><Mail className="h-4 w-4" /> Intro</a>
                                </Button>
                                <Button variant="outline" className="rounded-full" asChild>
                                    <a href={mailHref(lead, displayName, slug, "follow")}><Calendar className="h-4 w-4" /> Follow-up</a>
                                </Button>
                                <Button variant="outline" className="rounded-full" asChild>
                                    <a href={`/${slug}`} target="_blank"><Link2 className="h-4 w-4" /> Live page</a>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-full"
                                    type="button"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(lead.email)
                                        toast.success("Email copied")
                                    }}
                                >
                                    <Copy className="h-4 w-4" /> Copy email
                                </Button>
                                <ResendLibraryLink email={lead.email} />
                            </div>

                            {lead.activity.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[11px] text-muted-foreground">Activity</p>
                                    <div className="max-h-36 space-y-1.5 overflow-auto">
                                        {lead.activity.slice(0, 12).map((a, i) => (
                                            <div key={`${a.at}-${i}`} className="flex items-start justify-between gap-2 text-xs">
                                                <p className="min-w-0 text-foreground">{a.text}</p>
                                                <span className="shrink-0 text-muted-foreground">{relTime(a.at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                className="flex items-center gap-1 text-xs text-destructive"
                                disabled={pending}
                                onClick={() => {
                                    if (confirm("Remove this lead?")) onDelete(lead.id)
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Remove lead
                            </button>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

function mailHref(lead: StudioLead, displayName: string, slug: string, kind: "intro" | "follow") {
    const page = `https://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/${slug}`
    const first = lead.name.split(" ")[0]
    const subject = kind === "intro"
        ? `${displayName} here`
        : `Following up — ${displayName}`
    const body = kind === "intro"
        ? `Hi ${first},\n\nGreat to connect. Here's my page if you want to pick this up: ${page}\n\n${displayName}`
        : `Hi ${first},\n\nCircling back in case this is still useful. Book a time from my page: ${page}\n\n${displayName}`
    return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function exportCsv(rows: StudioLead[]) {
    const header = ["name", "email", "company", "budget", "status", "followUp", "note"]
    const lines = [header.join(",")]
    for (const l of rows) {
        const cells = [l.name, l.email, l.company || "", l.budgetRange || "", leadStatusLabel(l.status), l.followUpAt || "", l.note]
        lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "leads.csv"
    a.click()
    URL.revokeObjectURL(url)
}

function Meta({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="truncate text-sm font-medium">{value}</p>
        </div>
    )
}

function AddLeadSheet({
    open,
    onOpenChange,
    pending,
    startTransition,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    pending: boolean
    startTransition: (fn: () => Promise<void>) => void
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [company, setCompany] = useState("")
    const [budget, setBudget] = useState("")
    const [note, setNote] = useState("")

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="max-h-[88dvh] overflow-auto rounded-t-3xl sm:max-w-none">
                <SheetHeader>
                    <SheetTitle>Add lead</SheetTitle>
                    <SheetDescription>Someone you already talked to, or a name from elsewhere.</SheetDescription>
                </SheetHeader>
                <div className="space-y-3 px-4 pb-6">
                    <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Company</Label>
                        <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Budget</Label>
                        <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. $2–5k" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Note</Label>
                        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <Button
                        className="w-full rounded-full"
                        disabled={pending || !name.trim() || !email.includes("@")}
                        onClick={() => startTransition(async () => {
                            try {
                                await createLead({ name, email, company, budgetRange: budget, note })
                                toast.success("Lead added")
                                setName(""); setEmail(""); setCompany(""); setBudget(""); setNote("")
                                onOpenChange(false)
                            } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Could not add")
                            }
                        })}
                    >
                        Save lead
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}
