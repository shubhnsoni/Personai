"use client"

import { useState } from "react"
import { MapPin, Star } from "lucide-react"
import { toast } from "sonner"
import { StoryGallery } from "@/components/shop/story-gallery"
import type { GooglePlaceInfo } from "@/lib/google-place"
import type { ItemPhoto } from "@/lib/item-photos"
import { cn } from "@/lib/utils"

export function GooglePlacePanel({
    slug,
    mapsUrl,
    photos,
    className,
}: {
    slug: string
    mapsUrl?: string | null
    photos?: ItemPhoto[]
    className?: string
}) {
    const [info, setInfo] = useState<GooglePlaceInfo | null>(null)
    const [busy, setBusy] = useState(false)
    const [open, setOpen] = useState(false)

    async function load() {
        if (info) {
            setOpen(true)
            return
        }
        setBusy(true)
        try {
            const res = await fetch(`/api/google-business?slug=${encodeURIComponent(slug)}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Could not fetch")
            setInfo(json as GooglePlaceInfo)
            setOpen(true)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not fetch Google")
        } finally {
            setBusy(false)
        }
    }

    const gallery = info ? (info.photos.length ? info.photos : photos) || [] : []
    const highlights = info
        ? [
            info.rating != null ? `${info.rating.toFixed(1)} on Google${info.reviewCount ? ` · ${info.reviewCount} reviews` : ""}` : null,
            info.hours,
            info.categories.length ? info.categories.join(" · ") : null,
            info.address,
            info.phone,
            info.website,
        ].filter(Boolean) as string[]
        : []

    return (
        <div className={cn("space-y-4", className)}>
            <button
                type="button"
                onClick={load}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-cyan-400 text-sm font-medium text-zinc-950 disabled:opacity-60"
            >
                <MapPin className="h-4 w-4" />
                {busy ? "Fetching…" : "From Google"}
            </button>
            {open && info ? (
                <div className="space-y-4">
                    {gallery.length ? (
                        <StoryGallery photos={gallery} title={info.name || "Google"} labels={{ owner: "Google" }} />
                    ) : null}
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Google Business</p>
                        <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            {info.name}
                            {info.rating != null ? (
                                <span className="inline-flex items-center gap-1 text-base font-medium text-cyan-300">
                                    <Star className="h-4 w-4 fill-cyan-300" />
                                    {info.rating.toFixed(1)}
                                </span>
                            ) : null}
                        </h2>
                        {info.description ? <p className="mt-1 text-zinc-400">{info.description}</p> : null}
                    </div>
                    {highlights.length ? (
                        <ul className="space-y-2 text-sm text-zinc-300">
                            {highlights.map((h) => (
                                <li key={h} className="flex gap-2"><span className="text-emerald-400">✓</span>{h}</li>
                            ))}
                        </ul>
                    ) : null}
                    {info.reviews.length ? (
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Reviews</p>
                            {info.reviews.map((r, i) => (
                                <div key={`${r.author}-${i}`} className="rounded-2xl border border-white/8 px-3 py-2">
                                    <p className="text-xs text-zinc-400">
                                        {r.author}{r.rating ? ` · ${"★".repeat(Math.round(r.rating))}` : ""}
                                    </p>
                                    {r.text ? <p className="mt-1 text-sm text-zinc-200">{r.text}</p> : null}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {(info.mapsUrl || mapsUrl) ? (
                        <a
                            href={info.mapsUrl || mapsUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium"
                        >
                            Open listing
                        </a>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
