"use client"

import { useMemo, useState } from "react"
import { Copy, Mail, Users } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { CatalogSearch, FilterChips } from "@/components/dashboard/catalog-chrome"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { Button } from "@/components/ui/button"
import { ResendLibraryLink } from "@/components/dashboard/resend-library-link"
import { cn } from "@/lib/utils"

export type RosterStudent = {
    id: string
    name: string
    email: string
    status: string
    done: number
    total: number
    enrolledAt: string
    lastAt: string | null
    completedAt: string | null
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

export function CourseRoster({
    students,
    enrollUrl,
}: {
    students: RosterStudent[]
    enrollUrl: string
}) {
    const [q, setQ] = useState("")
    const [filter, setFilter] = useState<"all" | "active" | "done">("all")
    const [openId, setOpenId] = useState<string | null>(null)

    const stats = useMemo(() => {
        const done = students.filter((s) => s.status === "COMPLETED" || (s.total > 0 && s.done >= s.total)).length
        const avg =
            students.length === 0
                ? 0
                : Math.round(
                      students.reduce((n, s) => n + (s.total ? (s.done / s.total) * 100 : 0), 0) / students.length,
                  )
        return { enrolled: students.length, done, avg }
    }, [students])

    const rows = useMemo(() => {
        return students.filter((s) => {
            const finished = s.status === "COMPLETED" || (s.total > 0 && s.done >= s.total)
            if (filter === "done" && !finished) return false
            if (filter === "active" && finished) return false
            if (!q.trim()) return true
            const hay = `${s.name} ${s.email}`.toLowerCase()
            return hay.includes(q.trim().toLowerCase())
        })
    }, [students, filter, q])

    async function copyLink() {
        const url = enrollUrl.startsWith("http") ? enrollUrl : `${window.location.origin}${enrollUrl}`
        try {
            await navigator.clipboard.writeText(url)
            toast.success("Course link copied")
        } catch {
            toast.error(url)
        }
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border/70 bg-card">
                {[
                    { label: "Enrolled", value: String(stats.enrolled) },
                    { label: "Finished", value: String(stats.done) },
                    { label: "Avg progress", value: `${stats.avg}%` },
                ].map((item) => (
                    <div key={item.label} className="border-r border-border/50 px-2 py-2.5 text-center last:border-r-0">
                        <p className="text-sm font-medium tabular-nums">{item.value}</p>
                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    </div>
                ))}
            </div>

            {students.length > 0 ? (
                <>
                    <div className="flex items-center gap-2">
                        <CatalogSearch value={q} onChange={setQ} placeholder="Search students" />
                    </div>
                    <FilterChips
                        value={filter}
                        onChange={setFilter}
                        count={`${rows.length} shown`}
                        items={[
                            { id: "all", label: "All" },
                            { id: "active", label: "In progress" },
                            { id: "done", label: "Finished" },
                        ]}
                    />
                </>
            ) : null}

            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Users />}
                        title={students.length === 0 ? "Nobody’s in yet" : "No match"}
                        description={
                            students.length === 0
                                ? "Share the course link. Enrollments show up here with progress."
                                : "Try another search or filter."
                        }
                    />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((s) => {
                        const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
                        const finished = s.status === "COMPLETED" || (s.total > 0 && s.done >= s.total)
                        const open = openId === s.id
                        return (
                            <div key={s.id} className="border-b border-border/50 last:border-b-0">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                                    onClick={() => setOpenId(open ? null : s.id)}
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00D7FF]/12 text-[11px] font-semibold text-[#00D7FF]">
                                        {initials(s.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium">{s.name}</span>
                                            {finished ? (
                                                <span className="shrink-0 rounded-full bg-[#00D7FF]/15 px-1.5 py-px text-[9px] font-medium text-[#00D7FF]">
                                                    Done
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="mt-1 flex items-center gap-2">
                                            <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                                                <span
                                                    className={cn("block h-full rounded-full bg-[#00D7FF]")}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </span>
                                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                                {s.done}/{s.total || 0}
                                            </span>
                                        </span>
                                    </span>
                                </button>
                                {open ? (
                                    <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-muted/20 px-3 py-2">
                                        <div className="min-w-0 text-[11px] text-muted-foreground">
                                            <p className="truncate">{s.email}</p>
                                            <p>
                                                Joined {relTime(s.enrolledAt)}
                                                {s.lastAt ? ` · last ${relTime(s.lastAt)}` : ""}
                                            </p>
                                        </div>
                                        <ResendLibraryLink email={s.email} />
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}

            <StudioDock>
                <Button type="button" variant="outline" className="rounded-full" onClick={copyLink}>
                    <Copy className="mr-1 h-4 w-4" /> Copy link
                </Button>
                <Button type="button" className="rounded-full" asChild>
                    <a
                        href={`mailto:?subject=Join the course&body=${encodeURIComponent(
                            enrollUrl.startsWith("http") ? enrollUrl : `https://${typeof window === "undefined" ? "" : window.location.host}${enrollUrl}`,
                        )}`}
                    >
                        <Mail className="mr-1 h-4 w-4" /> Invite
                    </a>
                </Button>
            </StudioDock>
        </div>
    )
}
