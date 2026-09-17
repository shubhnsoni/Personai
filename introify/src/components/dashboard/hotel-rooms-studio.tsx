"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { addHotelRoomNumbers, createStayLink, setHotelRoomLive } from "@/app/actions/hotels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Room = { id: string; number: string; floor: string | null; category: string | null; isActive: boolean }

export function HotelRoomsStudio({ rooms, slug }: { rooms: Room[]; slug: string }) {
    const [draft, setDraft] = useState("101, 102, 103")
    const [pending, start] = useTransition()

    return (
        <div className="space-y-4">
            <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                    event.preventDefault()
                    start(async () => {
                        try {
                            const n = await addHotelRoomNumbers(draft)
                            toast.success(`${n} rooms ready`)
                        } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not add rooms")
                        }
                    })
                }}
            >
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="101, 102, 103"
                    className="h-11 rounded-2xl"
                />
                <Button type="submit" disabled={pending} className="h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 active:scale-[0.96]">
                    Add rooms
                </Button>
            </form>
            <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8">
                {rooms.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">Add 101–103 to try room QRs.</p>
                ) : rooms.map((room) => (
                    <div key={room.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="font-medium">Room {room.number}</p>
                            <p className="text-xs text-muted-foreground">{[room.floor, room.category].filter(Boolean).join(" · ") || "Active room"}</p>
                        </div>
                        <button
                            type="button"
                            className={cn(
                                "min-h-11 rounded-full border px-3 text-xs font-medium transition-transform duration-150 active:scale-[0.96]",
                                room.isActive ? "border-white/10 text-muted-foreground" : "border-cyan-400/40 text-cyan-200",
                            )}
                            onClick={() => start(async () => { await setHotelRoomLive(room.id, !room.isActive) })}
                        >
                            {room.isActive ? "Hide" : "Show"}
                        </button>
                        <button
                            type="button"
                            className="min-h-11 rounded-full border border-white/10 px-3 text-xs transition-transform duration-150 active:scale-[0.96]"
                            onClick={() => start(async () => {
                                try {
                                    const token = await createStayLink(room.id)
                                    const origin = window.location.origin
                                    await navigator.clipboard.writeText(`${origin}/${slug}/stay/${token}`)
                                    toast.success("Stay link copied")
                                } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "Could not create stay")
                                }
                            })}
                        >
                            Stay link
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
