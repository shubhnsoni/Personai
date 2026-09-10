"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { ADDONS, suggestedAddons, type AddonId } from "@/lib/onboarding-needs"
import { leadsNavLabel, salesNavLabel, shopNavLabel, surfacesFor, type SurfaceExtras } from "@/lib/surfaces"
import { KIT_FAMILIES, TRY_KITS, kitFamily, tryKitByRole, type KitFamily } from "@/lib/try-kits"
import { cn } from "@/lib/utils"

const GOALS = [
    { id: "SELL_PRODUCTS", label: "Sell products" },
    { id: "BOOK_TABLE", label: "Book a table" },
    { id: "TAKE_APPOINTMENTS", label: "Take appointments" },
    { id: "BOOK_CALL", label: "Book a call" },
    { id: "HIRE_ME", label: "Get hired" },
    { id: "SHOW_PORTFOLIO", label: "Show portfolio" },
    { id: "COLLECT_LEADS", label: "Collect leads" },
]

function toolLabels(role: string, extras?: SurfaceExtras | null) {
    return surfacesFor(role, extras)
        .filter((surface) => surface !== "home" && surface !== "profile" && surface !== "inbox")
        .map((surface) => {
            if (surface === "shop") return shopNavLabel(role)
            if (surface === "leads") return leadsNavLabel(role)
            if (surface === "sales") return salesNavLabel(role)
            if (surface === "calendar") return role === "RESTAURANT" ? "Reservations" : "Calendar"
            return surface[0].toUpperCase() + surface.slice(1)
        })
}

export function KitPicker({
    role,
    goal,
    extras,
    onRole,
    onGoal,
    onAddons,
}: {
    role: string
    goal: string
    extras: SurfaceExtras
    onRole: (role: string, goal: string) => void
    onGoal: (goal: string) => void
    onAddons: (addons: AddonId[]) => void
}) {
    const kit = tryKitByRole(role)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [family, setFamily] = useState<KitFamily>(() => kitFamily(role))
    const included = suggestedAddons(role)
    const extraSelected = extras.addons || []
    const optional = ADDONS.filter((addon) => !included.includes(addon.id))
    const tools = toolLabels(role, extras)

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase()
        return TRY_KITS.filter((item) => !q || `${item.name} ${item.blurb}`.toLowerCase().includes(q))
    }, [query])

    const families = KIT_FAMILIES.filter((item) => matches.some((kitItem) => kitFamily(kitItem.role) === item.id))
    const activeFamily = families.some((item) => item.id === family) ? family : families[0]?.id || "studio"
    const shown = matches.filter((item) => kitFamily(item.role) === activeFamily)

    function pick(nextRole: string, nextGoal: string) {
        onRole(nextRole, nextGoal)
        setOpen(false)
        setQuery("")
        setFamily(kitFamily(nextRole))
    }

    function toggleAddon(id: AddonId) {
        if (included.includes(id)) return
        const current = new Set(extraSelected)
        if (current.has(id)) current.delete(id)
        else current.add(id)
        onAddons([...included, ...current] as AddonId[])
    }

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current kit</p>
                        <p className="mt-1 text-sm font-medium">{kit?.name || role}</p>
                        {kit?.blurb ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{kit.blurb}</p> : null}
                        {tools.length ? <p className="mt-2 text-[11px] capitalize text-muted-foreground/80">{tools.join(" · ")}</p> : null}
                    </div>
                    <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpen((value) => !value)}
                        className="h-8 shrink-0 rounded-full border border-border px-3 text-xs font-medium hover:border-foreground/40"
                    >
                        {open ? "Done" : "Change kit"}
                    </button>
                </div>
            </div>

            {open ? (
                <div className="space-y-3">
                    <label className="relative block">
                        <span className="sr-only">Search kits</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search kits"
                            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </label>
                    <div role="tablist" aria-label="Kit groups" className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {families.map((item) => {
                            const on = item.id === activeFamily
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => setFamily(item.id)}
                                    className={cn(
                                        "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                                        on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground">{KIT_FAMILIES.find((item) => item.id === activeFamily)?.hint}</p>
                    <div className="grid max-h-[22rem] gap-2 overflow-y-auto sm:grid-cols-2" role="listbox" aria-label="Kits">
                        {shown.map((item) => {
                            const on = item.role === role
                            return (
                                <button
                                    key={item.role}
                                    type="button"
                                    role="option"
                                    aria-selected={on}
                                    onClick={() => pick(item.role, item.goal)}
                                    className={cn(
                                        "rounded-2xl border px-3.5 py-3 text-left transition-colors",
                                        on ? "border-aurora/50 bg-aurora/10" : "border-border/70 bg-background hover:border-foreground/30",
                                    )}
                                >
                                    <span className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium">{item.name}</span>
                                        {on ? <Check className="mt-0.5 size-3.5 shrink-0 text-aurora" aria-hidden="true" /> : null}
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.blurb}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : null}

            <div className="space-y-1.5">
                <p className="text-sm font-medium">What should visitors do first?</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {GOALS.map((item) => {
                        const on = goal === item.id
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onGoal(item.id)}
                                className={cn(
                                    "h-9 rounded-xl border px-2.5 text-xs font-medium",
                                    on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                                )}
                            >
                                {item.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium">Included with this kit</p>
                <p className="text-xs text-muted-foreground">These tools stay on with {kit?.name || "this kit"}.</p>
                <ul className="space-y-1.5">
                    {(included.length ? ADDONS.filter((addon) => included.includes(addon.id)) : [{ id: "page", label: "Public page", blurb: "A shareable intro, chats, and your details." }]).map((addon) => (
                        <li key={addon.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/10 px-3.5 py-3">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-aurora/15 text-aurora">
                                <Check className="size-3" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-medium">{addon.label}</span>
                                <span className="block text-xs leading-5 text-muted-foreground">{addon.blurb}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {optional.length ? (
                <details className="group rounded-2xl border border-border/70">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                        <span>Add more tools{extraSelected.length ? ` · ${extraSelected.length} on` : ""}</span>
                        <span className="text-xs font-normal text-muted-foreground group-open:hidden">Optional extras</span>
                    </summary>
                    <div className="space-y-1.5 border-t border-border/60 px-2 pb-2 pt-2">
                        <p className="px-2 text-xs text-muted-foreground">These do not replace the kit. Turn on only what this page needs.</p>
                        {optional.map((addon) => {
                            const on = extraSelected.includes(addon.id)
                            return (
                                <button
                                    key={addon.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleAddon(addon.id)}
                                    className={cn(
                                        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left",
                                        on ? "border-aurora/50 bg-aurora/10" : "border-transparent hover:bg-muted/40",
                                    )}
                                >
                                    <span className={cn(
                                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                                        on ? "border-aurora bg-aurora text-[#061018]" : "border-border",
                                    )}>
                                        {on ? <Check className="size-3" aria-hidden="true" /> : null}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium">{addon.label}</span>
                                        <span className="block text-xs leading-5 text-muted-foreground">{addon.blurb}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </details>
            ) : null}
        </div>
    )
}
