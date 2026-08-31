"use client"

import { useCallback, useSyncExternalStore } from "react"
import { LayoutGrid, List, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type CatalogView = "grid" | "list"

function isCatalogView(value: unknown): value is CatalogView {
    return value === "grid" || value === "list"
}

/**
 * The persisted catalog view is a browser-only store mirrored into React. It is modelled as an
 * external store rather than as state seeded by an effect, because the effect form has to call
 * setState during mount (react-hooks/set-state-in-effect) and the obvious alternative - reading
 * localStorage in render or in a useState initializer - throws on the server and desynchronises
 * the first client paint from the server markup. useSyncExternalStore keeps the read out of
 * render on the server via getServerSnapshot while still applying the stored value once the
 * client takes over.
 *
 * `memory` is the in-memory source of truth so that toggling always repaints even when
 * persistence is unavailable (private browsing, quota exceeded), which is what the previous
 * setView-then-write ordering guaranteed. It is only ever populated from a real browser read or
 * an explicit write, and getServerSnapshot never consults it, so one request cannot leak a view
 * preference into another on a shared server process.
 *
 * Covered by scripts/one-off/check-react-hook-behaviour.ts, which pins the server contract:
 * fallback-only markup, byte-identical across renders, and zero localStorage reads during render.
 */
const memory = new Map<string, CatalogView>()
const listeners = new Set<() => void>()

function browserStorage(): Storage | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage
    } catch {
        return null
    }
}

/** Same-tab notification. A localStorage write does not fire `storage` in the writing tab. */
export function subscribeCatalogView(onStoreChange: () => void) {
    listeners.add(onStoreChange)
    return () => {
        listeners.delete(onStoreChange)
    }
}

export function readCatalogView(key: string, fallback: CatalogView): CatalogView {
    const remembered = memory.get(key)
    if (remembered) return remembered
    let saved: string | null = null
    try {
        saved = browserStorage()?.getItem(key) ?? null
    } catch {
        saved = null
    }
    if (!isCatalogView(saved)) return fallback
    memory.set(key, saved)
    return saved
}

export function writeCatalogView(key: string, next: CatalogView) {
    memory.set(key, next)
    try {
        browserStorage()?.setItem(key, next)
    } catch {
        /* persistence is best-effort; the in-memory value still drives the UI */
    }
    for (const listener of listeners) listener()
}

export function useCatalogView(key: string, fallback: CatalogView = "grid") {
    const getSnapshot = useCallback(() => readCatalogView(key, fallback), [key, fallback])
    const getServerSnapshot = useCallback(() => fallback, [fallback])
    const view = useSyncExternalStore(subscribeCatalogView, getSnapshot, getServerSnapshot)
    const setViewPersist = useCallback((next: CatalogView) => writeCatalogView(key, next), [key])
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
                className="h-9 rounded-full border-white/10 bg-white/[0.03] pl-8 text-sm lg:h-10"
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
        <div className="flex shrink-0 rounded-full border border-white/10 p-0.5">
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
                        "rounded-full px-2.5 py-1.5 text-xs",
                        value === f.id ? "bg-[#00D7FF] text-[#061018]" : "bg-white/6 text-muted-foreground hover:text-foreground"
                    )}
                >
                    {f.label}
                </button>
            ))}
        </div>
    )
}
