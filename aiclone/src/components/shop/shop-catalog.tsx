"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ShopCover } from "@/components/shop/shop-cover"
import { formatStoredPrice, type DisplayCurrency } from "@/lib/pricing"
import { whatsappHref } from "@/lib/commerce"
import { dietDotClass, dietLabel } from "@/lib/menu"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"

type Item = {
    id: string
    title: string
    type: string
    thumbnailUrl: string | null
    priceCents: number
    currency?: string | null
    fulfillment: string
    stock: number | null
    category: string | null
    diet?: string | null
    spiceLevel?: number | null
    ar?: boolean
    metalLine?: string | null
    extraLine?: string | null
    extraWarn?: boolean
    fitmentMake?: string | null
}

export function ShopCatalog({
    slug,
    items,
    currency,
    accent,
    whatsapp,
    upiId,
    shopName,
    restaurant,
}: {
    slug: string
    items: Item[]
    currency: DisplayCurrency
    accent: string
    whatsapp?: string | null
    upiId?: string | null
    shopName: string
    restaurant?: boolean
    hours?: string | null
    bookHref?: string | null
}) {
    const cats = useMemo(() => {
        const set = new Set<string>()
        for (const p of items) if (p.category?.trim()) set.add(p.category.trim())
        return Array.from(set).sort()
    }, [items])
    const [cat, setCat] = useState<string>("all")
    const [diet, setDiet] = useState<"all" | "VEG" | "NONVEG">("all")
    const [make, setMake] = useState<string>("all")
    const hasDiet = items.some((p) => p.diet)
    const showDiet = Boolean(restaurant && hasDiet)
    const makes = useMemo(() => {
        const set = new Set<string>()
        for (const p of items) if (p.fitmentMake?.trim()) set.add(p.fitmentMake.trim())
        return Array.from(set).sort()
    }, [items])
    const rows = items.filter((p) => {
        if (cat !== "all" && (p.category || "").trim() !== cat) return false
        if (make !== "all" && (p.fitmentMake || "") !== make) return false
        if (showDiet) {
            if (diet === "VEG" && p.diet !== "VEG" && p.diet !== "VEGAN") return false
            if (diet === "NONVEG" && p.diet !== "NONVEG" && p.diet !== "EGG") return false
        }
        return true
    })
    const wa = whatsappHref(whatsapp, `Hi ${shopName}, I want to see your shop: `)

    return (
        <div className="space-y-4">
            {items.some((p) => p.ar) ? (
                <Link
                    href={`/${slug}/ar`}
                    className="flex items-center justify-between rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2.5"
                >
                    <span>
                        <span className="block text-sm font-medium text-cyan-100">View in your space</span>
                        <span className="mt-0.5 block text-[12px] text-cyan-200/70">Open the camera, swipe products, save a photo</span>
                    </span>
                    <span className="rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-medium text-zinc-950">See it in 3D</span>
                </Link>
            ) : null}
            {(whatsapp || upiId) && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-2.5 text-sm">
                    {upiId ? <span className="text-zinc-400">UPI <span className="text-zinc-100">{upiId}</span></span> : null}
                    {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-zinc-950" aria-label="WhatsApp">
                            <WhatsAppIcon className="h-4 w-4" />
                        </a>
                    ) : null}
                </div>
            )}
            {makes.length > 0 ? (
                <div className="flex gap-1 overflow-x-auto">
                    {["all", ...makes].map((m) => (
                        <button
                            key={`make-${m}`}
                            type="button"
                            onClick={() => setMake(m)}
                            className={`shrink-0 rounded-full px-3 py-1 text-xs ${make === m ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-400"}`}
                        >
                            {m === "all" ? "All cars" : m}
                        </button>
                    ))}
                </div>
            ) : null}
            {(cats.length > 0 || showDiet) ? (
                <div className="flex gap-1 overflow-x-auto">
                    {showDiet ? (
                        <>
                            {(["all", "VEG", "NONVEG"] as const).map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setDiet(d)}
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${diet === d ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-400"}`}
                                >
                                    {d === "all" ? "All" : d === "VEG" ? "Veg" : "Non-veg"}
                                </button>
                            ))}
                        </>
                    ) : null}
                    {["all", ...cats].map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCat(c)}
                            className={`shrink-0 rounded-full px-3 py-1 text-xs ${cat === c ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-400"}`}
                        >
                            {c === "all" ? (showDiet ? "All sections" : "All") : c}
                        </button>
                    ))}
                </div>
            ) : null}
            {rows.length === 0 ? (
                <p className="py-16 text-center text-sm text-zinc-500">Import a catalog or add a product</p>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {rows.map((p) => (
                        <Link
                            key={p.id}
                            href={`/${slug}/shop/${p.id}`}
                            className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50"
                        >
                            <ShopCover src={p.thumbnailUrl} type={p.type} title={p.title} className="aspect-square" />
                            <div className="space-y-0.5 p-3">
                                <p className="flex items-start gap-1.5 line-clamp-2 text-sm font-medium leading-snug">
                                    {showDiet && p.diet ? <span className={`mt-1 h-2 w-2 shrink-0 rounded-sm ${dietDotClass(p.diet)}`} title={dietLabel(p.diet) || ""} /> : null}
                                    {p.title}
                                </p>
                                {p.metalLine ? (
                                    <p className="text-[11px] text-zinc-500">{p.metalLine}</p>
                                ) : p.extraLine ? (
                                    <p className={`text-[11px] ${p.extraWarn ? "text-amber-400/80" : "text-zinc-500"}`}>{p.extraLine}</p>
                                ) : null}
                                <p className="text-sm tabular-nums" style={{ color: accent }}>
                                    {p.metalLine && p.priceCents <= 0
                                        ? "On bill"
                                        : formatStoredPrice(p.priceCents, p.currency, currency)}
                                    {!restaurant && !p.metalLine && (p.fulfillment === "PHYSICAL" || p.fulfillment === "BOTH") ? " · Physical" : ""}
                                    {showDiet && p.spiceLevel ? ` · ${"🌶".repeat(p.spiceLevel)}` : ""}
                                    {p.ar ? " · AR" : ""}
                                    {p.stock != null && p.stock <= 3 ? ` · ${p.stock <= 0 ? "Sold out" : `${p.stock} left`}` : ""}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
