"use client"

import { useState, useTransition } from "react"
import Link from "@/components/navigation/transition-link"
import { saveHotelGroup } from "@/app/actions/hotels"
import { StudioPanel } from "@/components/dashboard/studio-ui"

type Hotel = { id: string; slug: string; displayName: string }

export function HotelGroupStudio({
    name,
    hotels,
    selectedIds,
    canWrite,
}: {
    name: string
    hotels: Hotel[]
    selectedIds: string[]
    canWrite: boolean
}) {
    const [pending, start] = useTransition()
    const [groupName, setGroupName] = useState(name)
    const [ids, setIds] = useState<string[]>(selectedIds)
    return (
        <StudioPanel className="p-4 md:p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Hotel group</p>
            <p className="mt-1 text-sm text-muted-foreground">Organization → hotels. This is a stub for a corporate list. Departments stay on each property.</p>
            <label className="mt-4 block text-xs text-muted-foreground">
                Group name
                <input
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-sm text-foreground"
                    value={groupName}
                    disabled={!canWrite || pending}
                    maxLength={80}
                    onChange={(event) => setGroupName(event.target.value)}
                />
            </label>
            <ul className="mt-4 space-y-2">
                {hotels.map((hotel) => {
                    return (
                        <li key={hotel.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white/4 px-3">
                            <label className="flex min-h-11 flex-1 items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    disabled={!canWrite || pending}
                                    checked={ids.length === 0 ? true : ids.includes(hotel.id)}
                                    onChange={(event) => {
                                        const next = event.target.checked
                                            ? [...new Set([...ids, hotel.id])]
                                            : ids.filter((id) => id !== hotel.id)
                                        setIds(next)
                                    }}
                                />
                                <span className="font-medium">{hotel.displayName}</span>
                                <span className="text-xs text-muted-foreground">/{hotel.slug}</span>
                            </label>
                            <Link href={`/${hotel.slug}`} className="text-xs text-cyan-300/80 underline-offset-4 hover:underline">Open</Link>
                        </li>
                    )
                })}
            </ul>
            {!hotels.length ? <p className="mt-3 text-sm text-muted-foreground">No other hotel profiles on this billing account yet.</p> : null}
            {canWrite ? (
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => { await saveHotelGroup({ name: groupName, hotelProfileIds: ids }) })}
                    className="mt-4 inline-flex h-11 min-h-11 items-center rounded-full bg-[#00D7FF] px-4 text-sm font-medium text-[#061018] transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
                >
                    {pending ? "Saving…" : "Save group"}
                </button>
            ) : null}
        </StudioPanel>
    )
}
