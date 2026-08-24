"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, List, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type CatalogView = "grid" | "list"

export function useCatalogView(key: string, fallback: CatalogView = "grid") {
    const [view, setView] = useState<CatalogView>(fallback)
    useEffect(() => {
        const saved = localStorage.getItem(key)
        if (saved === "grid" || saved === "list") setView(saved)
    }, [key])
    const setViewPersist = (next: CatalogView) => {
        setView(next)
        localStorage.setItem(key, next)
    }
    return [view, setViewPersist] as const
}

export function CatalogSearch({
    value,
    onChange,
    placeholder = "Search",
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}) {
    return (
        <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-8 rounded-full pl-8 text-sm"
            />
        </div>
    )
}

export function ViewToggle({
    view,
    onChange,
}: {
    view: CatalogView
    onChange: (view: CatalogView) => void
}) {
    return (
        <div className="flex shrink-0 rounded-full border border-border/70 p-0.5">
            <button
                type="button"
                aria-label="List view"
                onClick={() => onChange("list")}
                className={cn("rounded-full p-1.5", view === "list" ? "bg-foreground text-background" : "text-muted-foreground")}
            >
                <List className="h-4 w-4" />
            </button>
            <button
                type="button"
                aria-label="Grid view"
                onClick={() => onChange("grid")}
                className={cn("rounded-full p-1.5", view === "grid" ? "bg-foreground text-background" : "text-muted-foreground")}
            >
                <LayoutGrid className="h-4 w-4" />
            </button>
        </div>
    )
}

export function FilterChips<T extends string>({
    value,
    onChange,
    items,
    count,
}: {
    value: T
    onChange: (value: T) => void
    items: { id: T; label: string }[]
    count?: string
}) {
    return (
        <div className="flex items-center gap-1 overflow-x-auto">
            {count ? <span className="mr-1 shrink-0 text-[11px] text-muted-foreground">{count}</span> : null}
            {items.map((f) => (
                <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange(f.id)}
                    className={cn(
                        "rounded-full px-2.5 py-1 text-xs",
                        value === f.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                    )}
                >
                    {f.label}
                </button>
            ))}
        </div>
    )
}
