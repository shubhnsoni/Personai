"use client"

import { useState } from "react"
import type { GoldBoard } from "@/lib/metal/board"
import { formatIstClock, formatRatePerGram } from "@/lib/metal/math"
import { GoldCityTape } from "@/components/shop/gold-city-tape"

export { GoldCityTape }

export function GoldRateStrip({
    board,
    wholesale = false,
    tone = "dark",
    surface = "shop",
}: {
    board: GoldBoard | null
    wholesale?: boolean
    tone?: "dark" | "light"
    surface?: "shop" | "pdp"
}) {
    const [open, setOpen] = useState(false)
    if (!board) return null
    const asOf = formatIstClock(board.asOf)
    const tapeOn = surface === "pdp" ? board.pdpTape !== false : board.shopTape !== false
    const cities = board.tape?.cities || []
    const shop = surface === "shop"
    const showDetails = shop && open
    if (!shop) {
        if (!tapeOn || cities.length < 2) return null
        return <GoldCityTape cities={cities} wholesale={wholesale} tone={tone} className="mt-0" />
    }
    return (
        <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    City rates
                </p>
                <button
                    type="button"
                    className="text-[11px] text-muted-foreground"
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? "Less" : "Rates"}
                </button>
            </div>
            {showDetails ? (
                <>
                    <p className="mt-0.5 text-sm text-foreground">
                        {wholesale ? (
                            <>
                                24K {formatRatePerGram(board.k24PaisePer10g)}
                                <span className="text-muted-foreground"> · 22K {formatRatePerGram(board.k22PaisePer10g)}</span>
                            </>
                        ) : (
                            <>
                                22K {formatRatePerGram(board.k22PaisePer10g)}
                                <span className="text-muted-foreground"> · 24K {formatRatePerGram(board.k24PaisePer10g)}</span>
                            </>
                        )}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {asOf ? `as of ${asOf} · ` : null}{wholesale ? "bills in touch" : "metal + making"}
                    </p>
                </>
            ) : null}
            {tapeOn ? <GoldCityTape cities={cities} wholesale={wholesale} tone={tone} /> : null}
        </div>
    )
}
