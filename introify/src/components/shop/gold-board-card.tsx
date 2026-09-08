"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { applyGoldQuote, checkGoldQuoteIfStale, previewCityGoldRate, saveGoldBoardDisplay, saveManualGoldBoard } from "@/app/actions/gold-board"
import { cityFromProfile, type GoldBoard } from "@/lib/metal/board"
import { boardMoved, formatIstClock, formatRatePerGram, paisePer10gToRupeesPerGram } from "@/lib/metal/math"
import { GoldCityTape } from "@/components/shop/gold-city-tape"
import { cn } from "@/lib/utils"

export function GoldShopToggles({
    profileId,
    board,
}: {
    profileId: string
    board: GoldBoard | null
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [pending, start] = useTransition()
    const [shopTape, setShopTape] = useState(() => board?.shopTape !== false)
    const [pdpTape, setPdpTape] = useState(() => board?.pdpTape !== false)

    useEffect(() => {
        setShopTape(board?.shopTape !== false)
        setPdpTape(board?.pdpTape !== false)
    }, [board?.shopTape, board?.pdpTape])

    const persist = (patch: { shopTape?: boolean; pdpTape?: boolean }) => {
        start(async () => {
            try {
                await saveGoldBoardDisplay(profileId, patch)
                router.refresh()
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save")
            }
        })
    }

    return (
        <div className="studio-panel overflow-hidden rounded-2xl">
            <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
                onClick={() => setOpen((v) => !v)}
            >
                On the shop
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
            {open ? (
                <div className="space-y-1 border-t border-white/8 px-4 py-2">
                    <label className="flex h-11 items-center justify-between text-sm">
                        Shop marquee
                        <Switch
                            checked={shopTape}
                            disabled={pending || !board}
                            onCheckedChange={(on) => {
                                setShopTape(on)
                                persist({ shopTape: on })
                            }}
                        />
                    </label>
                    <label className="flex h-11 items-center justify-between text-sm">
                        Product page
                        <Switch
                            checked={pdpTape}
                            disabled={pending || !board}
                            onCheckedChange={(on) => {
                                setPdpTape(on)
                                persist({ pdpTape: on })
                            }}
                        />
                    </label>
                </div>
            ) : null}
        </div>
    )
}

export function GoldBoardCard({
    profileId,
    board,
    personalityConfig,
    wholesale = false,
}: {
    profileId: string
    board: GoldBoard | null
    personalityConfig?: string | null
    wholesale?: boolean
}) {
    const place = cityFromProfile(personalityConfig, board?.city)
    const [city, setCity] = useState(place.city)
    const [k24, setK24] = useState(board ? String(Math.round(paisePer10gToRupeesPerGram(board.k24PaisePer10g))) : "")
    const [k22, setK22] = useState(board ? String(Math.round(paisePer10gToRupeesPerGram(board.k22PaisePer10g))) : "")
    const [k18, setK18] = useState(board ? String(Math.round(paisePer10gToRupeesPerGram(board.k18PaisePer10g))) : "")
    const [collapsed, setCollapsed] = useState(() => Boolean(board?.collapsed))
    const router = useRouter()
    const [pending, start] = useTransition()
    const [moved, setMoved] = useState(() => Boolean(board?.quote && boardMoved(board, board.quote)))

    useEffect(() => {
        setCollapsed(Boolean(board?.collapsed))
    }, [board?.collapsed])

    useEffect(() => {
        let dead = false
        void checkGoldQuoteIfStale(profileId).then((result) => {
            if (dead || !result) return
            if (result.moved) setMoved(true)
            if (result.touched) router.refresh()
        })
        return () => {
            dead = true
        }
    }, [profileId, router])

    const asOf = formatIstClock(board?.asOf)
    const cities = board?.tape?.cities || []

    const persistCollapsed = (on: boolean) => {
        setCollapsed(on)
        if (!board) return
        start(async () => {
            try {
                await saveGoldBoardDisplay(profileId, { collapsed: on })
                router.refresh()
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save")
            }
        })
    }

    const fetchRate = () => start(async () => {
        try {
            const result = await previewCityGoldRate(profileId, city)
            setMoved(result.moved)
            setK24(String(Math.round(paisePer10gToRupeesPerGram(result.quote.k24PaisePer10g))))
            setK22(String(Math.round(paisePer10gToRupeesPerGram(result.quote.k22PaisePer10g))))
            setK18(String(Math.round(paisePer10gToRupeesPerGram(result.quote.k18PaisePer10g))))
            toast.success(`${result.quote.city} 22K ${formatRatePerGram(result.quote.k22PaisePer10g)}`)
            router.refresh()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not fetch city rate")
        }
    })

    const applyRate = () => start(async () => {
        try {
            await applyGoldQuote(profileId)
            setMoved(false)
            toast.success(wholesale ? "Board applied. Bills use 24K × touch." : "Board applied. Catalogue retagged.")
            router.refresh()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fetch a city rate first")
        }
    })

    const saveTyped = () => start(async () => {
        try {
            await saveManualGoldBoard(profileId, {
                city,
                k24RupeesPerGram: Number(k24),
                k22RupeesPerGram: Number(k22),
                k18RupeesPerGram: Number(k18),
            })
            setMoved(false)
            toast.success("Manual board saved")
            router.refresh()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Enter all three rates")
        }
    })

    return (
        <div className="studio-panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">Today’s {city} rate</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                        {board
                            ? `${asOf ? `as of ${asOf}` : "Live board"}${wholesale ? " · billed on 24K" : ""}`
                            : wholesale
                                ? "Fetch the city board, then confirm"
                                : "Fetch the city board, then confirm"}
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    {moved ? (
                        <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                            Moved
                        </span>
                    ) : null}
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Compact
                        <Switch
                            checked={collapsed}
                            disabled={pending}
                            onCheckedChange={persistCollapsed}
                        />
                    </label>
                </span>
            </div>

            {collapsed ? (
                <div className="space-y-2 border-t border-white/8 px-4 py-2.5">
                    {board ? (
                        <p className="text-sm tabular-nums">
                            {wholesale ? `24K ${formatRatePerGram(board.k24PaisePer10g)}` : `22K ${formatRatePerGram(board.k22PaisePer10g)}`}
                            <span className="text-muted-foreground">
                                {wholesale ? ` · 22K ${formatRatePerGram(board.k22PaisePer10g)}` : ` · 24K ${formatRatePerGram(board.k24PaisePer10g)}`}
                            </span>
                        </p>
                    ) : null}
                    <GoldCityTape cities={cities} wholesale={wholesale} />
                    <div className="flex flex-wrap gap-1.5">
                        <Button type="button" size="sm" className="h-8 rounded-full" disabled={pending} onClick={fetchRate}>
                            Fetch
                        </Button>
                        {moved ? (
                            <Button type="button" size="sm" variant="outline" className="h-8 rounded-full" disabled={pending} onClick={applyRate}>
                                Use this rate
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-3 divide-x divide-white/8 border-y border-white/8">
                        {([
                            ["24K", k24, setK24],
                            ["22K", k22, setK22],
                            ["18K", k18, setK18],
                        ] as const).map(([label, value, setValue]) => (
                            <label key={label} className="min-w-0 px-3 py-2.5">
                                <span className="block text-[11px] text-muted-foreground">{label}</span>
                                <Input
                                    inputMode="decimal"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder="₹/g"
                                    aria-label={`${label} rupees per gram`}
                                    className="h-8 border-0 bg-transparent px-0 text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
                                />
                            </label>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                        <Input
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="City"
                            aria-label="City"
                            className="h-8 w-28"
                        />
                        <Button type="button" size="sm" className="h-8 rounded-full" disabled={pending} onClick={fetchRate}>
                            Fetch
                        </Button>
                        <Button type="button" size="sm" variant={moved ? "default" : "outline"} className="h-8 rounded-full" disabled={pending} onClick={applyRate}>
                            Use rate
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-muted-foreground" disabled={pending} onClick={saveTyped}>
                            Save
                        </Button>
                    </div>
                    {cities.length > 1 ? (
                        <div className="border-t border-white/8 px-3 py-2">
                            <GoldCityTape cities={cities} wholesale={wholesale} />
                        </div>
                    ) : null}
                </>
            )}
        </div>
    )
}
