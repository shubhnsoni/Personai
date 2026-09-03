"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Box, Mic, Minus, Plus, Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react"
import { formatStoredPrice, type DisplayCurrency } from "@/lib/pricing"
import { whatsappHref } from "@/lib/commerce"
import { createRestaurantOrder } from "@/app/actions/orders"
import type { ModifierSelectionInput } from "@/lib/restaurant-orders"
import { writeLiveOrderToken } from "@/lib/live-order"
import { OrderPlacedSplash } from "@/components/shop/order-placed-splash"
import { LiveOrderCountButton } from "@/components/shop/live-order-button"
import {
    defaultPicks,
    dishGroups,
    extrasLabel,
    extrasTotal,
    picksKey,
    type DishGroup,
} from "@/lib/dish-options"
import { cn } from "@/lib/utils"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { categoryIcon } from "@/lib/category-icons"

type Item = {
    id: string
    title: string
    thumbnailUrl: string | null
    priceCents: number
    currency?: string | null
    compareAtCents?: number | null
    category: string | null
    diet?: string | null
    rating?: number | null
    sold?: number
    ar?: boolean
}

type CartLine = {
    key: string
    itemId: string
    title: string
    qty: number
    baseCents: number
    extraCents: number
    currency?: string | null
    extras: string
    modifiers: ModifierSelectionInput[]
    thumbnailUrl: string | null
}

function money(cents: number, stored: string | null | undefined, display: DisplayCurrency) {
    return formatStoredPrice(cents, stored, display)
}

/** Weak hints only — applied when these names exist on THIS menu, after unknown cats. */
const CATEGORY_ORDER = [
    "Breakfast & Combos",
    "Burgers & Sandwiches",
    "Starters & Snacks",
    "Main Course",
    "Coffee & Beverages",
    "Desserts",
    "Pizza & Pasta",
    "Soup",
    "Salads",
    "Starter",
    "Fried Rice & Noodles",
    "Momo",
    "Fish&prawn",
    "Shakes",
    "Mocktails",
]

export function RestaurantMenu({
    slug,
    shopName,
    currency,
    items,
    whatsapp,
    upiId,
    tableCode,
    tableLabel,
    prepaid,
}: {
    slug: string
    shopName: string
    currency: DisplayCurrency
    items: Item[]
    logoUrl?: string | null
    whatsapp?: string | null
    upiId?: string | null
    tableCode?: string | null
    tableLabel?: string | null
    prepaid?: boolean
}) {
    const cats = useMemo(() => {
        const set = new Set<string>()
        for (const p of items) if (p.category?.trim()) set.add(p.category.trim())
        const names = Array.from(set)
        const known = CATEGORY_ORDER.filter((name) => set.has(name))
        const unknown = names
            .filter((name) => !known.includes(name))
            .sort((a, b) => a.localeCompare(b))
        return [...unknown, ...known]
    }, [items])

    const buckets = useMemo(() => {
        const again = items.filter((p) => (p.sold || 0) > 0).slice(0, 8)
        const offers = items.filter((p) => p.compareAtCents && p.compareAtCents > p.priceCents).slice(0, 12)
        const recommended = [...items]
            .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.sold || 0) - (a.sold || 0))
            .slice(0, 20)
        const byCat = cats.map((label) => ({
            id: label,
            label,
            items: items.filter((p) => (p.category || "").trim() === label),
        }))
        return [
            { id: "again", label: "Order Again", items: again.length ? again : items.slice(0, 3) },
            { id: "offers", label: "Todays Offers", items: offers.length ? offers : items.filter((p) => p.compareAtCents).slice(0, 5) },
            { id: "recommended", label: "Recommended", items: recommended },
            ...byCat,
        ].filter((s) => s.items.length)
    }, [items, cats])

    const [q, setQ] = useState("")
    const [searchOpen, setSearchOpen] = useState(false)
    const [veg, setVeg] = useState(false)
    const [nonveg, setNonveg] = useState(false)
    const [best, setBest] = useState(false)
    const [rated, setRated] = useState(false)
    const [nav, setNav] = useState(false)
    const [active, setActive] = useState(buckets[0]?.id || "")
    const [cart, setCart] = useState<CartLine[]>([])
    const cartHydrated = useRef(false)
    const [custom, setCustom] = useState<Item | null>(null)
    const [cartOpen, setCartOpen] = useState(false)
    const [placed, setPlaced] = useState<{ token: string; number: number; dish: string } | null>(null)

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                const raw = sessionStorage.getItem(`pl-cart-${slug}`)
                if (raw) {
                    const parsed = JSON.parse(raw) as CartLine[]
                    if (Array.isArray(parsed)) {
                        setCart(parsed.map((line) => ({
                            ...line,
                            modifiers: Array.isArray(line.modifiers) ? line.modifiers : [],
                        })))
                    }
                }
            } catch { /* ignore */ }
            cartHydrated.current = true
        }, 0)
        return () => window.clearTimeout(timer)
    }, [slug])

    useEffect(() => {
        if (!cartHydrated.current) return
        try {
            sessionStorage.setItem(`pl-cart-${slug}`, JSON.stringify(cart))
        } catch { /* ignore */ }
    }, [cart, slug])

    const filtered = (list: Item[]) =>
        list.filter((p) => {
            if (q.trim() && !p.title.toLowerCase().includes(q.trim().toLowerCase())) return false
            if (veg && p.diet !== "VEG" && p.diet !== "VEGAN") return false
            if (nonveg && p.diet !== "NONVEG" && p.diet !== "EGG") return false
            if (best && !(p.sold || 0) && !(p.compareAtCents && p.compareAtCents > (p.priceCents || 0))) return false
            if (rated && (p.rating || 5) < 4) return false
            return true
        })

    useEffect(() => {
        const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-sec]"))
        if (!sections.length) return
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
                const id = visible[0]?.target.getAttribute("data-sec")
                if (id) setActive(id)
            },
            { root: null, rootMargin: "-160px 0px -62% 0px", threshold: [0, 0.15, 0.4] },
        )
        sections.forEach((n) => obs.observe(n))
        return () => obs.disconnect()
    }, [buckets.length, q, veg, nonveg, best, rated])

    function listen() {
        const Rec = (window as unknown as { webkitSpeechRecognition?: new () => { start: () => void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null } }).webkitSpeechRecognition
        if (!Rec) return
        const rec = new Rec()
        rec.onresult = (e) => setQ(e.results[0][0].transcript)
        rec.start()
    }

    const qtyOf = (id: string) => cart.filter((l) => l.itemId === id).reduce((n, l) => n + l.qty, 0)
    const cartCount = cart.reduce((n, l) => n + l.qty, 0)
    const cartTotal = cart.reduce((n, l) => n + (l.baseCents + l.extraCents) * l.qty, 0)
    const activeLabel = buckets.find((b) => b.id === active)?.label || buckets[0]?.label || "Menu"

    function addPlain(item: Item) {
        setCart((cur) => {
            const i = cur.findIndex((l) => l.itemId === item.id && !l.extras)
            if (i >= 0) {
                const next = [...cur]
                next[i] = { ...next[i], qty: next[i].qty + 1 }
                return next
            }
            return [...cur, {
                key: item.id,
                itemId: item.id,
                title: item.title,
                qty: 1,
                baseCents: item.priceCents,
                extraCents: 0,
                currency: item.currency,
                extras: "",
                modifiers: [],
                thumbnailUrl: item.thumbnailUrl,
            }]
        })
    }

    function addConfigured(item: Item, groups: DishGroup[], picked: Record<string, string[]>, qty: number) {
        const extraCents = extrasTotal(groups, picked)
        const extras = extrasLabel(groups, picked)
        const key = `${item.id}::${picksKey(picked)}`
        setCart((cur) => {
            const i = cur.findIndex((l) => l.key === key)
            if (i >= 0) {
                const next = [...cur]
                next[i] = { ...next[i], qty: next[i].qty + qty }
                return next
            }
            return [...cur, {
                key,
                itemId: item.id,
                title: item.title,
                qty,
                baseCents: item.priceCents,
                extraCents,
                currency: item.currency,
                extras,
                modifiers: Object.entries(picked)
                    .filter(([, optionIds]) => optionIds.length > 0)
                    .map(([groupId, optionIds]) => ({ groupId, optionIds: [...optionIds] })),
                thumbnailUrl: item.thumbnailUrl,
            }]
        })
        setCustom(null)
    }

    function bump(item: Item, delta: number) {
        const groups = dishGroups(item.category, item.title)
        if (delta > 0 && groups.length) {
            setCustom(item)
            return
        }
        if (delta > 0 && !groups.length) {
            addPlain(item)
            return
        }
        setCart((cur) => {
            const idx = [...cur].map((l, i) => ({ l, i })).reverse().find((x) => x.l.itemId === item.id)?.i
            if (idx == null) return cur
            const next = [...cur]
            const line = next[idx]
            if (line.qty + delta <= 0) return next.filter((_, i) => i !== idx)
            next[idx] = { ...line, qty: line.qty + delta }
            return next
        })
    }

    return (
        <div className="relative bg-background text-foreground">
            <div className="sticky top-14 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
                <div className="mx-auto flex max-w-lg gap-2 overflow-x-auto px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[
                        { on: veg, set: () => setVeg((v) => !v), label: "Veg" },
                        { on: nonveg, set: () => setNonveg((v) => !v), label: "Non-Veg" },
                        { on: best, set: () => setBest((v) => !v), label: "Bestsellers" },
                        { on: rated, set: () => setRated((v) => !v), label: "Ratings 4.0+" },
                    ].map((c) => {
                        const Icon = categoryIcon(c.label)
                        return (
                        <button
                            key={c.label}
                            type="button"
                            onClick={c.set}
                            className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-[6px] text-[13px] font-medium",
                                c.on
                                    ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "border-border/70 bg-card text-foreground",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {c.label}
                        </button>
                        )
                    })}
                </div>
                <div className="mx-auto max-w-lg border-t border-border/40 px-4 py-2 text-[13px] font-semibold tracking-tight">
                    {activeLabel}
                </div>
            </div>

            <div className="mx-auto max-w-lg space-y-7 px-3 pb-36 pt-3">
                {items.some((p) => p.ar) ? (
                    <Link
                        href={`/${slug}/ar`}
                        className="flex items-center justify-between rounded-[1.25rem] bg-cyan-400/15 px-3.5 py-3 ring-1 ring-cyan-400/25"
                    >
                        <span>
                            <span className="block text-sm font-semibold text-foreground">View on your table</span>
                            <span className="mt-0.5 block text-[12px] text-muted-foreground">Place the dish in AR, swipe, save a photo</span>
                        </span>
                        <span className="rounded-full bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-zinc-950">AR menu</span>
                    </Link>
                ) : null}
                {buckets.map((sec) => {
                    const rows = filtered(sec.items)
                    if (!rows.length) return null
                    return (
                        <section key={sec.id} data-sec={sec.id} id={`sec-${encodeURIComponent(sec.id)}`}>
                            <h2 className="mb-3 flex items-center gap-2 px-0.5 text-[17px] font-semibold tracking-tight">
                                {(() => { const Icon = categoryIcon(sec.label); return <Icon className="h-4 w-4 text-muted-foreground" /> })()}
                                {sec.label}
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                {rows.map((p) => (
                                    <DishCard
                                        key={`${sec.id}-${p.id}`}
                                        slug={slug}
                                        item={p}
                                        currency={currency}
                                        qty={qtyOf(p.id)}
                                        customizable={dishGroups(p.category, p.title).length > 0}
                                        onAdd={() => bump(p, 1)}
                                        onSub={() => bump(p, -1)}
                                    />
                                ))}
                            </div>
                        </section>
                    )
                })}
            </div>

            <div className="pointer-events-none fixed inset-x-3 bottom-5 z-30 flex items-end gap-2">
                {cartCount > 0 && !searchOpen ? (
                    <button
                        type="button"
                        onClick={() => setCartOpen(true)}
                        className="pointer-events-auto flex min-w-0 flex-1 items-center justify-between rounded-full bg-emerald-700 px-4 py-3 text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)]"
                    >
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                            <ShoppingBag className="h-4 w-4" />
                            {cartCount} item{cartCount === 1 ? "" : "s"}
                        </span>
                        <span className="text-[13px] font-semibold tabular-nums">
                            {money(cartTotal, cart[0]?.currency || "INR", currency)} · View
                        </span>
                    </button>
                ) : (
                    <span className="flex-1" />
                )}
                <div className="pointer-events-auto flex items-center gap-2">
                    {!searchOpen ? <LiveOrderCountButton slug={slug} /> : null}
                    {searchOpen ? (
                        <label className="flex w-[min(17rem,calc(100vw-7.5rem))] items-center gap-2 rounded-full bg-background px-3 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                autoFocus
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={`Search in ${shopName}`}
                                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                            <button type="button" onClick={listen} className="text-muted-foreground" aria-label="Voice search">
                                <Mic className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSearchOpen(false); setQ("") }}
                                className="text-muted-foreground"
                                aria-label="Close search"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </label>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setSearchOpen(true)}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-white shadow-[0_10px_28px_rgba(0,0,0,0.28)] dark:bg-zinc-100 dark:text-zinc-950"
                            aria-label="Search"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setNav(true)}
                        className="flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-white shadow-[0_10px_28px_rgba(0,0,0,0.28)] dark:bg-zinc-100 dark:text-zinc-950"
                    >
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        MENU
                    </button>
                </div>
            </div>

            {nav ? (
                <div className="fixed inset-0 z-50">
                    <button type="button" className="absolute inset-0 bg-black/55" onClick={() => setNav(false)} aria-label="Close menu" />
                    <div className="absolute bottom-5 left-3 right-3 max-h-[72dvh] overflow-auto rounded-[1.6rem] bg-[#171717] p-4 text-white shadow-2xl">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <p className="text-[15px] font-semibold text-white">Menu</p>
                            <button type="button" onClick={() => setNav(false)} className="rounded-full p-1 text-zinc-400" aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-0.5">
                            {buckets.map((sec) => (
                                <button
                                    key={sec.id}
                                    type="button"
                                    onClick={() => {
                                        setNav(false)
                                        document.getElementById(`sec-${encodeURIComponent(sec.id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                                    }}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-xl px-2 py-2.5 text-left text-[14px]",
                                        active === sec.id ? "bg-white/10" : "hover:bg-white/5",
                                    )}
                                >
                                    <span className={cn("inline-flex items-center gap-2", active === sec.id ? "font-semibold text-white" : "font-normal text-zinc-400")}>
                                        {(() => { const Icon = categoryIcon(sec.label); return <Icon className="h-3.5 w-3.5" /> })()}
                                        {sec.label}
                                    </span>
                                    <span className="tabular-nums text-[13px] text-zinc-500">{sec.items.length}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {custom ? (
                <CustomizeSheet
                    item={custom}
                    currency={currency}
                    onClose={() => setCustom(null)}
                    onAdd={(groups, picked, qty) => addConfigured(custom, groups, picked, qty)}
                />
            ) : null}

            {cartOpen ? (
                <CartSheet
                    slug={slug}
                    shopName={shopName}
                    currency={currency}
                    cart={cart}
                    whatsapp={whatsapp}
                    upiId={upiId}
                    tableCode={tableCode}
                    tableLabel={tableLabel}
                    prepaid={prepaid}
                    onClose={() => setCartOpen(false)}
                    onChange={setCart}
                    onClear={() => { setCart([]); setCartOpen(false) }}
                    onPlaced={(next) => {
                        setCart([])
                        setCartOpen(false)
                        setPlaced(next)
                    }}
                />
            ) : null}

            {placed ? (
                <OrderPlacedSplash
                    shopName={shopName}
                    number={placed.number}
                    dish={placed.dish}
                    onDone={() => window.location.assign(`/o/${placed.token}`)}
                />
            ) : null}
        </div>
    )
}

function DishCard({
    slug,
    item,
    currency,
    qty,
    customizable,
    onAdd,
    onSub,
}: {
    slug: string
    item: Item
    currency: DisplayCurrency
    qty: number
    customizable: boolean
    onAdd: () => void
    onSub: () => void
}) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const photo = item.thumbnailUrl && item.thumbnailUrl !== failedSrc ? item.thumbnailUrl : null
    const initial = (item.title.trim().charAt(0) || "?").toUpperCase()
    return (
        <article className="overflow-hidden rounded-[1.35rem] bg-card shadow-[0_12px_32px_-22px_rgba(15,23,42,0.5)]">
            <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-muted">
                <Link href={`/${slug}/shop/${item.id}`} className="absolute inset-0">
                    {photo ? (
                        <img
                            src={photo}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() => setFailedSrc(item.thumbnailUrl)}
                        />
                    ) : (
                        <div
                            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 via-stone-100 to-zinc-300 text-2xl font-semibold text-zinc-500 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-900 dark:text-zinc-400"
                            aria-hidden
                        >
                            {initial}
                        </div>
                    )}
                </Link>
                {item.diet ? <DietMark diet={item.diet} /> : null}
                {item.ar ? (
                    <Link
                        href={`/${slug}/ar?item=${item.id}`}
                        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-cyan-400 px-2 py-1 text-[10px] font-bold tracking-wide text-zinc-950 shadow-sm"
                    >
                        <Box className="h-3 w-3" />
                        AR
                    </Link>
                ) : null}
            </div>
            <div className="space-y-2 px-2.5 pb-3 pt-2">
                <Link href={`/${slug}/shop/${item.id}`} className="line-clamp-2 min-h-[2.5rem] text-[13.5px] font-semibold leading-snug text-foreground">
                    {item.title}
                </Link>
                <div className="flex items-end justify-between gap-2">
                    <p className="text-[13.5px] font-semibold tabular-nums text-foreground">
                        {money(item.priceCents, item.currency, currency)}
                    </p>
                    {qty > 0 ? (
                        <div className="flex items-center rounded-lg border-[1.5px] border-emerald-700 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400">
                            <button type="button" onClick={onSub} className="px-2 py-1" aria-label="Remove">
                                <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-4 text-center text-[12px] font-bold tabular-nums">{qty}</span>
                            <button type="button" onClick={onAdd} className="px-2 py-1" aria-label="Add">
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="rounded-lg border-[1.5px] border-emerald-700 px-3 py-[5px] text-[11px] font-bold tracking-[0.14em] text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                        >
                            {customizable ? "ADD +" : "ADD"}
                        </button>
                    )}
                </div>
            </div>
        </article>
    )
}

function DietMark({ diet }: { diet: string }) {
    const veg = diet === "VEG" || diet === "VEGAN"
    return (
        <span
            className={cn(
                "absolute left-2 top-2 flex h-[15px] w-[15px] items-center justify-center rounded-[3px] border-[1.6px] bg-white",
                veg ? "border-emerald-600" : "border-rose-600",
            )}
            aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
        >
            <span className={cn("h-[6px] w-[6px] rounded-full", veg ? "bg-emerald-600" : "bg-rose-600")} />
        </span>
    )
}

function CustomizeSheet({
    item,
    currency,
    onClose,
    onAdd,
}: {
    item: Item
    currency: DisplayCurrency
    onClose: () => void
    onAdd: (groups: DishGroup[], picked: Record<string, string[]>, qty: number) => void
}) {
    const groups = dishGroups(item.category, item.title)
    const [picked, setPicked] = useState(() => defaultPicks(groups))
    const [qty, setQty] = useState(1)
    const extra = extrasTotal(groups, picked)
    const total = (item.priceCents + extra) * qty

    function toggle(group: DishGroup, id: string) {
        setPicked((cur) => {
            const have = new Set(cur[group.id] || [])
            if (group.max === 1) return { ...cur, [group.id]: [id] }
            if (have.has(id)) have.delete(id)
            else if (have.size < group.max) have.add(id)
            return { ...cur, [group.id]: [...have] }
        })
    }

    return (
        <div className="fixed inset-0 z-50">
            <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
            <div className="absolute bottom-0 left-0 right-0 max-h-[86dvh] overflow-auto rounded-t-[1.6rem] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-border/50 bg-background px-4 py-3">
                    <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{item.title}</p>
                        <p className="text-[12px] text-muted-foreground">Customise your dish</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-5 px-4 py-4">
                    {groups.map((g) => (
                        <div key={g.id}>
                            <p className="mb-2 text-[13px] font-semibold">
                                {g.label}{g.required ? "" : " · optional"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {g.options.map((o) => {
                                    const on = (picked[g.id] || []).includes(o.id)
                                    return (
                                        <button
                                            key={o.id}
                                            type="button"
                                            onClick={() => toggle(g, o.id)}
                                            className={cn(
                                                "rounded-full px-3 py-1.5 text-[12px]",
                                                on ? "bg-emerald-700 text-white" : "bg-muted text-foreground",
                                            )}
                                        >
                                            {o.name}{o.priceCents ? ` · +${money(o.priceCents, item.currency, currency)}` : ""}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-3 px-4 pb-2">
                    <div className="flex items-center rounded-full border border-border">
                        <button type="button" className="px-3 py-2" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Less">
                            <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                        <button type="button" className="px-3 py-2" onClick={() => setQty((n) => Math.min(20, n + 1))} aria-label="More">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => onAdd(groups, picked, qty)}
                        className="flex-1 rounded-full bg-emerald-700 py-3 text-sm font-semibold text-white"
                    >
                        Add {qty} · {money(total, item.currency, currency)}
                    </button>
                </div>
            </div>
        </div>
    )
}

function CartSheet({
    slug,
    shopName,
    currency,
    cart,
    whatsapp,
    upiId,
    tableCode,
    tableLabel,
    prepaid,
    onClose,
    onChange,
    onClear,
    onPlaced,
}: {
    slug: string
    shopName: string
    currency: DisplayCurrency
    cart: CartLine[]
    whatsapp?: string | null
    upiId?: string | null
    tableCode?: string | null
    tableLabel?: string | null
    prepaid?: boolean
    onClose: () => void
    onChange: (cart: CartLine[]) => void
    onClear: () => void
    onPlaced: (next: { token: string; number: number; dish: string }) => void
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [pay, setPay] = useState<"UPI" | "COD" | "WHATSAPP">(prepaid && upiId ? "UPI" : upiId ? "UPI" : whatsapp ? "WHATSAPP" : "COD")
    const [idempotencyKey, setIdempotencyKey] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState<string | null>(null)
    const total = cart.reduce((n, l) => n + (l.baseCents + l.extraCents) * l.qty, 0)
    const stored = cart[0]?.currency || "INR"
    const channel = tableCode ? "DINE_IN" as const : "TAKEAWAY" as const
    const invalidTableCode = Boolean(tableCode && !tableLabel)
    const orderKeyStorage = `pl-order-key-${slug}`

    function makeOrderKey() {
        if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()
        return `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
    }

    function rememberOrderKey(key: string) {
        setIdempotencyKey(key)
        try {
            sessionStorage.setItem(orderKeyStorage, key)
        } catch { /* ignore */ }
        return key
    }

    function rotateOrderKey() {
        return rememberOrderKey(makeOrderKey())
    }

    function ensureOrderKey() {
        return idempotencyKey || rotateOrderKey()
    }

    useEffect(() => {
        let nextEmail = ""
        let nextName = ""
        let nextKey = ""
        try {
            nextEmail = localStorage.getItem("pl_buyer_email") || ""
            nextName = localStorage.getItem("pl_buyer_name") || ""
            const existing = sessionStorage.getItem(orderKeyStorage)
            nextKey = existing && /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(existing)
                ? existing
                : (typeof globalThis.crypto?.randomUUID === "function"
                    ? globalThis.crypto.randomUUID()
                    : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`)
            sessionStorage.setItem(orderKeyStorage, nextKey)
        } catch {
            nextKey = `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
        }
        let cancelled = false
        queueMicrotask(() => {
            if (cancelled) return
            setEmail(nextEmail)
            setName(nextName)
            setIdempotencyKey(nextKey)
        })
        return () => { cancelled = true }
    }, [orderKeyStorage])

    function setQty(key: string, qty: number) {
        const nextQty = Math.min(20, qty)
        onChange(nextQty <= 0 ? cart.filter((l) => l.key !== key) : cart.map((l) => l.key === key ? { ...l, qty: nextQty } : l))
    }

    async function place() {
        if (!name.trim() || !email.includes("@")) {
            setError("Name and a real email are required.")
            return
        }
        if (invalidTableCode) {
            setError("This table link is invalid. Scan the QR code on your table again.")
            return
        }
        if (!cart.length) return
        setBusy(true)
        setError(null)
        try {
            localStorage.setItem("pl_buyer_email", email.trim())
            localStorage.setItem("pl_buyer_name", name.trim())
            const result = await createRestaurantOrder({
                profileSlug: slug,
                idempotencyKey: ensureOrderKey(),
                lines: cart.map((line) => ({
                    productId: line.itemId,
                    qty: line.qty,
                    modifiers: line.modifiers || [],
                })),
                guestName: name.trim(),
                guestEmail: email.trim(),
                payMethod: pay,
                channel,
                tableCode: tableCode || undefined,
            })
            const summary = result.lines
                .map((line) => `${line.qty}× ${line.title}${line.modifiersLabel ? ` (${line.modifiersLabel})` : ""}`)
                .join("\n")
            const authoritativeTotal = money(result.totalCents, result.currency, currency)
            const location = result.tableLabel ? `\nTable: ${result.tableLabel}` : "\nTakeaway"

            writeLiveOrderToken(slug, result.publicToken)
            rotateOrderKey()
            if (pay === "WHATSAPP") {
                const href = whatsappHref(
                    result.whatsapp || whatsapp,
                    `Hi ${shopName}, order #${result.number}:\n${summary}\nTotal ${authoritativeTotal}\nName: ${name.trim()}${location}`,
                )
                if (href) window.open(href, "_blank")
            }
            onPlaced({
                token: result.publicToken,
                number: result.number,
                dish: result.lines[0]?.title || "",
            })
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not place that order")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50">
            <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close cart" />
            <div className="absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-auto rounded-t-[1.6rem] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-border/50 bg-background px-4 py-3">
                    <p className="text-[15px] font-semibold">Your order</p>
                    <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-3 px-4 py-4">
                    {cart.length === 0 && !done ? <p className="text-sm text-muted-foreground">Cart is empty.</p> : null}
                    {cart.map((line) => (
                        <div key={line.key} className="flex items-start gap-3">
                            {line.thumbnailUrl ? <img src={line.thumbnailUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">{line.title}</p>
                                {line.extras ? <p className="text-[12px] text-muted-foreground">{line.extras}</p> : null}
                                <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{money((line.baseCents + line.extraCents) * line.qty, line.currency, currency)}</p>
                            </div>
                            <div className="flex items-center rounded-lg border border-emerald-700 text-emerald-700">
                                <button type="button" className="px-2 py-1" onClick={() => setQty(line.key, line.qty - 1)}><Minus className="h-3 w-3" /></button>
                                <span className="min-w-4 text-center text-[12px] font-bold tabular-nums">{line.qty}</span>
                                <button type="button" className="px-2 py-1" onClick={() => setQty(line.key, line.qty + 1)}><Plus className="h-3 w-3" /></button>
                            </div>
                        </div>
                    ))}
                    {done ? (
                        <p className="rounded-2xl bg-muted px-3 py-3 text-sm">{done}</p>
                    ) : cart.length ? (
                        <>
                            <div className="flex items-center justify-between border-t border-border/50 pt-3 text-sm font-semibold">
                                <span>Estimated total</span>
                                <span className="tabular-nums">{money(total, stored, currency)}</span>
                            </div>
                            <div className={cn("rounded-2xl px-3 py-2.5 text-sm", invalidTableCode ? "bg-rose-500/10 text-rose-700" : "bg-muted text-foreground")}>
                                {invalidTableCode
                                    ? "Invalid table link — scan the QR code on your table again."
                                    : tableLabel
                                        ? `Dining at ${tableLabel}`
                                        : "Takeaway order"}
                            </div>
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-2xl bg-muted px-3 py-2.5 text-sm outline-none" />
                            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-2xl bg-muted px-3 py-2.5 text-sm outline-none" />
                            <div className="flex gap-2">
                                {(["COD", "UPI", "WHATSAPP"] as const).filter((method) => (method === "COD" && !prepaid) || (method === "UPI" && upiId) || (method === "WHATSAPP" && whatsapp && !prepaid)).map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPay(method)}
                                        className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium", pay === method ? "bg-foreground text-background" : "bg-muted")}
                                    >
                                        {method === "COD" ? (channel === "DINE_IN" ? "Pay at table" : "Pay on pickup") : method === "UPI" ? (prepaid ? "Prepaid UPI" : "UPI") : (
                                            <WhatsAppIcon className="h-4 w-4" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                            <button
                                type="button"
                                disabled={busy || invalidTableCode}
                                onClick={place}
                                className="w-full rounded-full bg-emerald-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {busy ? "Placing…" : `Place order · ${money(total, stored, currency)}`}
                            </button>
                            <button type="button" onClick={() => { rotateOrderKey(); onClear() }} className="w-full text-center text-[12px] text-muted-foreground">Clear cart</button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
