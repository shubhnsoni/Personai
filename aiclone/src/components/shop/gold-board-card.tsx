"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { applyGoldQuote, checkGoldQuoteIfStale, previewCityGoldRate, saveManualGoldBoard } from "@/app/actions/gold-board"
import { cityFromProfile, type GoldBoard } from "@/lib/metal/board"
import { boardMoved, formatRatePerGram, paisePer10gToRupeesPerGram } from "@/lib/metal/math"

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
    const router = useRouter()
    const [pending, start] = useTransition()
    const [moved, setMoved] = useState(() => Boolean(board?.quote && boardMoved(board, board.quote)))

    useEffect(() => {
        let dead = false
        void checkGoldQuoteIfStale(profileId).then((result) => {
            if (dead || !result?.moved) return
            setMoved(true)
        })
        return () => {
            dead = true
        }
    }, [profileId])

    const asOf = board?.asOf
        ? new Date(board.asOf).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
        : null

    return (
        <div className="studio-panel space-y-3 rounded-2xl px-4 py-3">
            <div className="flex items-start justify-between gap-3">
                <span>
                    <span className="block text-sm font-medium">Today’s {city} rate</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                        {board
                            ? wholesale
                                ? `24K ${formatRatePerGram(board.k24PaisePer10g)} · bills in touch · as of ${asOf}`
                                : `22K ${formatRatePerGram(board.k22PaisePer10g)} · as of ${asOf}`
                            : wholesale
                                ? "Fetch the city board, then confirm. Bills are 24K × touch."
                                : "Fetch the city board, then confirm. Pieces price from weight × purity + making."}
                    </span>
                </span>
                {moved ? (
                    <span className="shrink-0 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                        City rate moved
                    </span>
                ) : null}
            </div>
            {board ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                    {([
                        ["24K", board.k24PaisePer10g],
                        ["22K", board.k22PaisePer10g],
                        ["18K", board.k18PaisePer10g],
                    ] as const).map(([label, rate]) => (
                        <div key={label} className="rounded-xl bg-black/30 px-2 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatRatePerGram(rate)}</p>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
                <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="h-9 w-28"
                />
                <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-full"
                    disabled={pending}
                    onClick={() => start(async () => {
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
                    })}
                >
                    Fetch city rate
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-full"
                    disabled={pending}
                    onClick={() => start(async () => {
                        try {
                            await applyGoldQuote(profileId)
                            setMoved(false)
                            toast.success(wholesale ? "Board applied. Bills use 24K × touch." : "Board applied. Catalogue retagged.")
                            router.refresh()
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Fetch a city rate first")
                        }
                    })}
                >
                    Use this rate
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <Input inputMode="decimal" value={k24} onChange={(e) => setK24(e.target.value)} placeholder="24K ₹/g" className="h-9" />
                <Input inputMode="decimal" value={k22} onChange={(e) => setK22(e.target.value)} placeholder="22K ₹/g" className="h-9" />
                <Input inputMode="decimal" value={k18} onChange={(e) => setK18(e.target.value)} placeholder="18K ₹/g" className="h-9" />
            </div>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-full px-0 text-muted-foreground"
                disabled={pending}
                onClick={() => start(async () => {
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
                })}
            >
                Save typed rates
            </Button>
        </div>
    )
}
