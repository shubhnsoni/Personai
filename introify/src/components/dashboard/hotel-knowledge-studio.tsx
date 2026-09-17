"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { removeHotelKnowledge, saveHotelKnowledge, saveHotelMap, saveHotelSla, saveHotelUpsells } from "@/app/actions/hotels"
import { HOTEL_KNOWLEDGE_BUCKETS, DEFAULT_HOTEL_SLA_MINUTES, type HotelUpsell } from "@/lib/hotels"
import { StudioPanel } from "@/components/dashboard/studio-ui"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
type KnowledgeRow = {
    id: string
    bucket: string
    title: string
    body: string
    guestVisible: boolean
}

type Marker = {
    id: string
    kind: string
    label: string
    x: number
    y: number
    hint: string
}

export function HotelKnowledgeStudio({
    docs,
    mapImageUrl,
    markers,
    sla,
    upsells,
    readOnly = false,
}: {
    docs: KnowledgeRow[]
    mapImageUrl: string | null
    markers: Marker[]
    sla: Record<string, number>
    upsells: HotelUpsell[]
    readOnly?: boolean
}) {
    const [pending, start] = useTransition()
    const [draft, setDraft] = useState({ bucket: "POLICIES", title: "", body: "", guestVisible: true })
    const [mapUrl, setMapUrl] = useState(mapImageUrl || "")
    const [pins, setPins] = useState(markers)
    const [targets, setTargets] = useState({ ...DEFAULT_HOTEL_SLA_MINUTES, ...sla })
    const [offers, setOffers] = useState(upsells)

    return (
        <div className="space-y-4">
            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Buckets</p>
                <div className="space-y-2">
                    {docs.map((row) => (
                        <div key={row.id} className="rounded-xl bg-white/4 px-3 py-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-[11px] text-muted-foreground">{row.bucket}{row.guestVisible ? " · guest" : " · staff"}</p>
                                    <p className="text-sm font-medium">{row.title}</p>
                                    <p className="text-xs text-muted-foreground">{row.body}</p>
                                </div>
                                {readOnly ? null : (
                                <button
                                    type="button"
                                    className="min-h-11 rounded-full px-3 text-xs text-muted-foreground transition-transform duration-150 ease-out active:scale-[0.96]"
                                    onClick={() => start(async () => {
                                        await removeHotelKnowledge(row.id)
                                        toast.success("Removed")
                                    })}
                                >
                                    Remove
                                </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {readOnly ? null : <form
                    className="mt-4 space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        start(async () => {
                            await saveHotelKnowledge(draft)
                            toast.success("Saved")
                            setDraft({ bucket: "POLICIES", title: "", body: "", guestVisible: true })
                        })
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-sm">
                            <span className="text-muted-foreground">Bucket</span>
                            <select
                                value={draft.bucket}
                                onChange={(e) => setDraft((cur) => ({ ...cur, bucket: e.target.value }))}
                                className="h-11 w-full rounded-2xl border border-white/10 bg-transparent px-3 text-sm"
                            >
                                {HOTEL_KNOWLEDGE_BUCKETS.map((bucket) => (
                                    <option key={bucket} value={bucket}>{bucket}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex min-h-11 items-end gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={draft.guestVisible}
                                onChange={(e) => setDraft((cur) => ({ ...cur, guestVisible: e.target.checked }))}
                            />
                            Guest-visible
                        </label>
                    </div>
                    <Input value={draft.title} onChange={(e) => setDraft((cur) => ({ ...cur, title: e.target.value }))} placeholder="Title" className="h-11 rounded-2xl" />
                    <textarea value={draft.body} onChange={(e) => setDraft((cur) => ({ ...cur, body: e.target.value }))} rows={3} placeholder="Body" className="w-full rounded-2xl border border-white/10 bg-transparent px-3 py-2.5 text-sm" />
                    <Button type="submit" disabled={pending} className="h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]">
                        Save bucket
                    </Button>
                </form>}
            </StudioPanel>

            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Property map</p>
                <p className="mb-3 text-xs text-muted-foreground">Upload a floor image and place markers. Guest “where’s the spa?” returns a marker card — not indoor navigation.</p>
                <Input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="Map image URL" className="mb-3 h-11 rounded-2xl" />
                <div className="relative mb-3 overflow-hidden rounded-2xl bg-white/4" style={{ aspectRatio: "16 / 10" }}>
                    {mapUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mapUrl} alt="" className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-white/10" />
                    ) : null}
                    {pins.map((pin) => (
                        <span
                            key={pin.id}
                            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00D7FF]"
                            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                            title={pin.label}
                        />
                    ))}
                </div>
                <div className="space-y-2">
                    {pins.map((pin, index) => (
                        <div key={pin.id} className="grid gap-2 sm:grid-cols-4">
                            <Input value={pin.label} onChange={(e) => setPins((cur) => cur.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} className="h-11 rounded-2xl" />
                            <Input value={pin.kind} onChange={(e) => setPins((cur) => cur.map((row, i) => i === index ? { ...row, kind: e.target.value } : row))} className="h-11 rounded-2xl" />
                            <Input type="number" value={pin.x} onChange={(e) => setPins((cur) => cur.map((row, i) => i === index ? { ...row, x: Number(e.target.value) } : row))} className="h-11 rounded-2xl" />
                            <Input type="number" value={pin.y} onChange={(e) => setPins((cur) => cur.map((row, i) => i === index ? { ...row, y: Number(e.target.value) } : row))} className="h-11 rounded-2xl" />
                        </div>
                    ))}
                </div>
                {readOnly ? null : (
                <Button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => {
                        await saveHotelMap({ mapImageUrl: mapUrl || null, markers: pins.map((pin) => ({ ...pin, aliases: [pin.label, pin.kind] })) })
                        toast.success("Map saved")
                    })}
                    className="mt-3 h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                    Save map
                </Button>
                )}
            </StudioPanel>

            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">SLA minutes</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(targets).map(([dept, minutes]) => (
                        <label key={dept} className="space-y-1.5 text-sm">
                            <span className="text-muted-foreground">{dept.toLowerCase()}</span>
                            <Input
                                type="number"
                                value={minutes}
                                onChange={(e) => setTargets((cur) => ({ ...cur, [dept]: Number(e.target.value) }))}
                                className="h-11 rounded-2xl"
                            />
                        </label>
                    ))}
                </div>
                {readOnly ? null : (
                <Button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => {
                        await saveHotelSla(targets)
                        toast.success("SLA saved")
                    })}
                    className="mt-3 h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                    Save SLA
                </Button>
                )}
            </StudioPanel>

            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Upsells</p>
                <p className="mb-3 text-xs text-muted-foreground">Prompts only. This page never charges a guest.</p>
                <div className="space-y-3">
                    {offers.map((row, index) => (
                        <label key={row.id} className="block space-y-1.5 text-sm">
                            <span className="text-muted-foreground">{row.kind} · {row.audience}</span>
                            <Input
                                value={row.prompt}
                                onChange={(e) => setOffers((cur) => cur.map((item, i) => i === index ? { ...item, prompt: e.target.value } : item))}
                                className="h-11 rounded-2xl"
                            />
                        </label>
                    ))}
                </div>
                {readOnly ? null : (
                <Button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => {
                        await saveHotelUpsells(offers)
                        toast.success("Upsells saved")
                    })}
                    className="mt-3 h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                    Save upsells
                </Button>
                )}
            </StudioPanel>
        </div>
    )
}
