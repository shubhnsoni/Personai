"use client"

import { useState } from "react"
import type { HotelActionCard } from "@/lib/hotels"
import { hotelRequestStatusLabel } from "@/lib/hotels"
import { cn } from "@/lib/utils"

export function HotelActionCardView({ card }: { card: HotelActionCard }) {
    const [photoUrl, setPhotoUrl] = useState(card.photoUrl || "")
    const [busy, setBusy] = useState(false)

    async function onPhoto(file: File) {
        if (!card.id) return
        setBusy(true)
        try {
            const body = new FormData()
            body.set("requestId", card.id)
            body.set("file", file)
            const res = await fetch("/api/hotel/request-photo", { method: "POST", body, credentials: "include" })
            const data = (await res.json()) as { url?: string }
            if (data.url) setPhotoUrl(data.url)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="mt-2 max-w-sm rounded-[20px] p-3 shadow-[0px_0px_0px_1px_oklch(1_0_0_/_0.08)] transition-[box-shadow] duration-150 ease-out">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300/80">{card.type.replace("_", " ")}</p>
            <p className="mt-1 text-sm font-medium">{card.title}</p>
            {card.room ? <p className="text-xs text-muted-foreground">Room {card.room}</p> : null}
            {card.status ? (
                <p className={cn("mt-1 text-xs", card.status === "COMPLETE" ? "text-emerald-300" : "text-cyan-200")}>
                    {hotelRequestStatusLabel(card.status, card.type === "maintenance" ? "MAINTENANCE" : card.type === "emergency" ? "EMERGENCY" : undefined)}
                </p>
            ) : null}
            {card.items?.length ? (
                <ul className="mt-2 space-y-0.5 text-sm">
                    {card.items.map((item) => <li key={item}>· {item}</li>)}
                </ul>
            ) : null}
            {card.restaurants?.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                    {card.restaurants.map((row) => (
                        <li key={row.slug}>
                            <a className="text-cyan-200 underline-offset-2 hover:underline" href={`/${row.slug}`}>{row.name}</a>
                        </li>
                    ))}
                </ul>
            ) : null}
            {card.wifiName ? <p className="mt-2 text-sm">Network <span className="font-medium">{card.wifiName}</span></p> : null}
            {card.type === "map" && card.marker ? (
                <div
                    className="relative mt-3 overflow-hidden rounded-xl bg-white/4"
                    style={{ aspectRatio: "16 / 10" }}
                >
                    {card.mapImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.mapImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                    ) : null}
                    <span
                        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00D7FF] shadow-[0_0_0_4px_oklch(0.8_0.15_210_/_0.35)]"
                        style={{ left: `${card.marker.x}%`, top: `${card.marker.y}%` }}
                    />
                </div>
            ) : null}
            {card.note ? <p className="mt-2 text-xs text-muted-foreground">{card.note}</p> : null}
            {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="mt-3 max-h-40 w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-white/10" />
            ) : null}
            {card.type === "maintenance" && card.id ? (
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-white/6 px-4 text-xs font-medium transition-transform duration-150 ease-out active:scale-[0.96]">
                    {busy ? "Uploading…" : photoUrl ? "Replace photo" : "Add a photo"}
                    <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) void onPhoto(file)
                        }}
                    />
                </label>
            ) : null}
            {card.phones?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {card.phones.map((phone) => (
                        <a
                            key={phone.href}
                            href={phone.href}
                            className="inline-flex min-h-11 items-center rounded-full bg-[#00D7FF] px-4 text-xs font-medium text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]"
                        >
                            {phone.label}
                        </a>
                    ))}
                </div>
            ) : card.href ? (
                <a
                    href={card.href}
                    target={card.href.startsWith("tel:") ? undefined : "_blank"}
                    rel={card.href.startsWith("tel:") ? undefined : "noreferrer"}
                    className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#00D7FF] px-4 text-xs font-medium text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                    {card.cta || "Open"}
                </a>
            ) : null}
        </div>
    )
}
