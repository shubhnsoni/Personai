"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { buyStoreStock, liftWholesaleBill, peekLift } from "@/app/actions/metal-bills"
import { gramsToMg, rupeesToPaise } from "@/lib/metal/math"
import { touchBpsFromPercent, touchPaise } from "@/lib/metal/touch"

export function BuyStockSheet({
    open,
    onOpenChange,
    k24PaisePer10g,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    k24PaisePer10g: number
}) {
    const [pending, start] = useTransition()
    const [token, setToken] = useState("")
    const [supplier, setSupplier] = useState("")
    const [phone, setPhone] = useState("")
    const [title, setTitle] = useState("")
    const [grams, setGrams] = useState("")
    const [touch, setTouch] = useState("75")
    const [making, setMaking] = useState("")
    const [payNow, setPayNow] = useState("")

    const cost = k24PaisePer10g && Number(grams) > 0
        ? touchPaise(gramsToMg(Number(grams)), touchBpsFromPercent(Number(touch) || 0), k24PaisePer10g) + rupeesToPaise(Number(making) || 0)
        : 0

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-[1.75rem]">
                <SheetHeader>
                    <SheetTitle>Buy stock</SheetTitle>
                    <SheetDescription>Paste a wholesale lift code, or type the parcel. Window price stays your city 22K board.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Lift code" className="h-11" />
                        <Button
                            type="button"
                            className="h-11 rounded-full"
                            disabled={pending || !token.trim()}
                            onClick={() => start(async () => {
                                try {
                                    const peek = await peekLift(token.trim())
                                    if (!peek) throw new Error("Unknown code")
                                    if (peek.lifted) throw new Error("Already lifted")
                                    await liftWholesaleBill(token.trim())
                                    toast.success(`In from ${peek.from}`)
                                    onOpenChange(false)
                                } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Could not lift")
                                }
                            })}
                        >
                            Lift
                        </Button>
                    </div>
                    <p className="text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">or type it</p>
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault()
                            start(async () => {
                                try {
                                    await buyStoreStock({
                                        supplierName: supplier.trim(),
                                        phone,
                                        title: title.trim() || "Parcel",
                                        grossMg: gramsToMg(Number(grams)),
                                        costTouchBps: touchBpsFromPercent(Number(touch) || 0),
                                        makingPaise: rupeesToPaise(Number(making) || 0),
                                        payNowPaise: rupeesToPaise(Number(payNow) || 0),
                                    })
                                    toast.success("Stock on the board")
                                    onOpenChange(false)
                                } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Could not buy")
                                }
                            })
                        }}
                    >
                        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Wholesaler" className="h-11" required />
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="h-11" />
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design" className="h-11" />
                        <div className="grid grid-cols-3 gap-2">
                            <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="Grams" className="h-11" />
                            <Input inputMode="decimal" value={touch} onChange={(e) => setTouch(e.target.value)} placeholder="Touch" className="h-11" />
                            <Input inputMode="decimal" value={making} onChange={(e) => setMaking(e.target.value)} placeholder="Making ₹" className="h-11" />
                        </div>
                        <Input inputMode="decimal" value={payNow} onChange={(e) => setPayNow(e.target.value)} placeholder="Pay now ₹ (blank = udhar)" className="h-11" />
                        <p className="text-sm text-muted-foreground">Cost {cost ? `₹${Math.round(cost / 100).toLocaleString("en-IN")}` : "—"} · sell price follows 22K board</p>
                        <Button type="submit" className="h-11 w-full rounded-full" disabled={pending || !supplier.trim() || !Number(grams)}>
                            Take onto the board
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    )
}
