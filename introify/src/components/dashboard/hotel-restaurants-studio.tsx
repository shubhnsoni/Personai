"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { connectHotelRestaurant, connectHotelRestaurantSlug, removeHotelRestaurant } from "@/app/actions/hotels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Choice = { id: string; name: string; slug: string }
type Linked = { restaurantProfileId: string; name: string; slug: string; label: string | null }

export function HotelRestaurantsStudio({
    linked,
    choices,
}: {
    linked: Linked[]
    choices: Choice[]
}) {
    const [slug, setSlug] = useState("")
    const [pending, start] = useTransition()
    const linkedIds = new Set(linked.map((row) => row.restaurantProfileId))
    const available = choices.filter((item) => !linkedIds.has(item.id))

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Connect an existing Introify restaurant. Menus and orders stay on that page — this hotel only surfaces them.
            </p>
            {available.length ? (
                <div className="flex flex-wrap gap-2">
                    {available.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            disabled={pending}
                            onClick={() => start(async () => {
                                try {
                                    await connectHotelRestaurant(item.id)
                                    toast.success(`Connected ${item.name}`)
                                } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "Could not connect")
                                }
                            })}
                            className="min-h-11 rounded-full border border-white/10 px-3.5 text-sm transition-transform duration-150 active:scale-[0.96]"
                        >
                            Connect {item.name}
                        </button>
                    ))}
                </div>
            ) : null}
            <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                    event.preventDefault()
                    start(async () => {
                        try {
                            await connectHotelRestaurantSlug(slug)
                            toast.success("Restaurant connected")
                            setSlug("")
                        } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not connect")
                        }
                    })
                }}
            >
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="restaurant-username" className="h-11 rounded-2xl" />
                <Button type="submit" disabled={pending || !slug.trim()} className="h-11 min-h-11 rounded-2xl bg-[#00D7FF] text-[#061018] transition-transform duration-150 active:scale-[0.96]">
                    Connect by username
                </Button>
            </form>
            <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8">
                {linked.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">No restaurants yet. Guests will be told to ask reception.</p>
                ) : linked.map((row) => (
                    <div key={row.restaurantProfileId} className="flex min-h-12 items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">/{row.slug}</p>
                        </div>
                        <button
                            type="button"
                            className="min-h-11 rounded-full border border-white/10 px-3 text-xs transition-transform duration-150 active:scale-[0.96]"
                            onClick={() => start(async () => { await removeHotelRestaurant(row.restaurantProfileId) })}
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
