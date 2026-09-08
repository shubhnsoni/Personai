"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MetalBillSheet } from "@/components/shop/metal-bill-sheet"
import { BuyStockSheet } from "@/components/shop/buy-stock-sheet"

export function GoldStockActions({
    mode,
    k24PaisePer10g,
}: {
    mode: "wholesale" | "retail"
    k24PaisePer10g: number
}) {
    const [purchase, setPurchase] = useState(false)
    const [sale, setSale] = useState(false)
    const [buy, setBuy] = useState(false)

    return (
        <div className="flex flex-wrap gap-2">
            {mode === "wholesale" ? (
                <>
                    <Button type="button" size="sm" className="h-9 rounded-full" onClick={() => setPurchase(true)}>Purchase in</Button>
                    <Button type="button" size="sm" variant="outline" className="h-9 rounded-full" onClick={() => setSale(true)}>Bill a shop</Button>
                    <MetalBillSheet open={purchase} onOpenChange={setPurchase} kind="PURCHASE" k24PaisePer10g={k24PaisePer10g} />
                    <MetalBillSheet open={sale} onOpenChange={setSale} kind="SALE" k24PaisePer10g={k24PaisePer10g} />
                </>
            ) : (
                <>
                    <Button type="button" size="sm" className="h-9 rounded-full" onClick={() => setBuy(true)}>Buy stock</Button>
                    <BuyStockSheet open={buy} onOpenChange={setBuy} k24PaisePer10g={k24PaisePer10g} />
                </>
            )}
        </div>
    )
}
