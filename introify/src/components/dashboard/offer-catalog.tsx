"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { EmptyState } from "@/components/ui/empty-state"
import { Package } from "lucide-react"

export type OfferKind = "call" | "file" | "course" | "live" | "room" | "free"

export type OfferSku = {
    id: string
    kind: OfferKind
    title: string
    hint: string
    priceLabel: string
    active: boolean
    href: string
}

const KINDS: { id: "all" | OfferKind; label: string }[] = [
    { id: "all", label: "All" },
    { id: "call", label: "Calls" },
    { id: "file", label: "Files" },
    { id: "course", label: "Courses" },
    { id: "live", label: "Live" },
    { id: "room", label: "Rooms" },
    { id: "free", label: "Free" },
]

const NEW_LINKS: { href: string; label: string; kind: OfferKind }[] = [
    { href: "/dashboard/services", label: "Call", kind: "call" },
    { href: "/dashboard/products/new", label: "File", kind: "file" },
    { href: "/dashboard/courses/new", label: "Course", kind: "course" },
    { href: "/dashboard/events/new", label: "Live", kind: "live" },
    { href: "/dashboard/community/new", label: "Room", kind: "room" },
    { href: "/dashboard/lead-magnets/new", label: "Free", kind: "free" },
]

const KIND_LABEL: Record<OfferKind, string> = {
    call: "Call",
    file: "File",
    course: "Course",
    live: "Live",
    room: "Room",
    free: "Free",
}

export function OfferCatalog({ skus }: { skus: OfferSku[] }) {
    const [filter, setFilter] = useState<"all" | OfferKind>("all")

    const rows = useMemo(
        () => (filter === "all" ? skus : skus.filter((s) => s.kind === filter)),
        [skus, filter]
    )

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: skus.length }
        for (const s of skus) c[s.kind] = (c[s.kind] || 0) + 1
        return c
    }, [skus])

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Everything people can buy or join</p>
            <div className="flex gap-1 overflow-x-auto">
                {KINDS.map((k) => (
                    <button
                        key={k.id}
                        type="button"
                        onClick={() => setFilter(k.id)}
                        className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs",
                            filter === k.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                        )}
                    >
                        {k.label}
                        {counts[k.id] ? <span className="ml-1 tabular-nums opacity-70">{counts[k.id]}</span> : null}
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Package />}
                        title={filter === "all" ? "No offers yet" : `No ${KINDS.find((k) => k.id === filter)?.label?.toLowerCase()}`}
                        description="Add a call, file, course, live session, room, or free download."
                    />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((sku) => (
                        <Link
                            key={`${sku.kind}-${sku.id}`}
                            href={sku.href}
                            className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-3 last:border-b-0 hover:bg-muted/40"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium">{sku.title}</p>
                                    {!sku.active && (
                                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            Off
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                    {KIND_LABEL[sku.kind]}
                                    {sku.hint ? ` · ${sku.hint}` : ""}
                                </p>
                            </div>
                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{sku.priceLabel}</span>
                        </Link>
                    ))}
                </div>
            )}

            <StudioDock>
                {NEW_LINKS.map((item) => (
                    <Button key={item.href} variant="outline" size="sm" className="rounded-full" asChild>
                        <Link href={item.href}>Add {item.label}</Link>
                    </Button>
                ))}
            </StudioDock>
        </div>
    )
}
