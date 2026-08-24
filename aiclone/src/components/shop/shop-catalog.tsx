"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ShopCover } from "@/components/shop/shop-cover"
import { formatMoney, type DisplayCurrency } from "@/lib/pricing"
import { whatsappHref } from "@/lib/commerce"
import { dietDotClass, dietLabel } from "@/lib/menu"

type Item = {
    id: string
    title: string
    type: string
    thumbnailUrl: string | null
    priceCents: number
    fulfillment: string
    stock: number | null
    category: string | null
    diet?: string | null
    spiceLevel?: number | null
    ar?: boolean
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
    hours,
    bookHref,
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
    const rows = items.filter((p) => {
        if (cat !== "all" && (p.category || "").trim() !== cat) return false
        if (diet === "VEG" && p.diet !== "VEG" && p.diet !== "VEGAN") return false
        if (diet === "NONVEG" && p.diet !== "NONVEG" && p.diet !== "EGG") return false
        return true
    })
    const wa = whatsappHref(whatsapp, `Hi ${shopName}, I want to see your ${restaurant ? "menu" : "shop"}: `)
    const hasDiet = items.some((p) => p.diet)

    return (
        <div className="space-y-4">
            {(hours || bookHref) ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-2.5 text-sm">
                    {hours ? <span className="text-zinc-300">{hours}</span> : null}
                    {bookHref ? (
                        <Link href={bookHref} className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-950">
                            Reserve a table
                        </Link>
                    ) : null}
                </div>
            ) : null}
            {(whatsapp || upiId) && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/50 px-3 py-2.5 text-sm">
                    {upiId ? <span className="text-zinc-400">UPI <span className="text-zinc-100">{upiId}</span></span> : null}
                    {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className="ml-auto rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-zinc-950">
                            WhatsApp
                        </a>
                    ) : null}
                </div>
            )}
            {(cats.length > 0 || hasDiet) ? (
                <div className="flex gap-1 overflow-x-auto">
                    {hasDiet ? (
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
                            {c === "all" ? (hasDiet ? "All sections" : "All") : c}
                        </button>
                    ))}
                </div>
            ) : null}
            {rows.length === 0 ? (
                <p className="py-16 text-center text-sm text-zinc-500">{restaurant ? "Nothing on the menu yet." : "Nothing in the shop yet."}</p>
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
                                    {p.diet ? <span className={`mt-1 h-2 w-2 shrink-0 rounded-sm ${dietDotClass(p.diet)}`} title={dietLabel(p.diet) || ""} /> : null}
                                    {p.title}
                                </p>
                                <p className="text-sm tabular-nums" style={{ color: accent }}>
                                    {formatMoney(p.priceCents, currency)}
                                    {!restaurant && (p.fulfillment === "PHYSICAL" || p.fulfillment === "BOTH") ? " · Physical" : ""}
                                    {p.spiceLevel ? ` · ${"🌶".repeat(p.spiceLevel)}` : ""}
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
