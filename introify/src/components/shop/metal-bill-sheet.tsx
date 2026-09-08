"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createMetalPurchase, createMetalSale, listMetalLots, listMetalParties, saveParty } from "@/app/actions/metal-bills"
import { gramsToMg, rupeesToPaise } from "@/lib/metal/math"
import { touchBpsFromPercent, touchPaise } from "@/lib/metal/touch"
import { openReceiptPdf } from "@/lib/receipt"

type Party = { id: string; kind: string; displayName: string; phone: string | null; gstin?: string | null }
type Lot = { id: string; title: string; remainingGrossMg: number }

export function MetalBillSheet({
    open,
    onOpenChange,
    kind,
    k24PaisePer10g,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    kind: "PURCHASE" | "SALE"
    k24PaisePer10g: number
}) {
    const [pending, start] = useTransition()
    const [parties, setParties] = useState<Party[]>([])
    const [lots, setLots] = useState<Lot[]>([])
    const [partyId, setPartyId] = useState("")
    const [newName, setNewName] = useState("")
    const [newPhone, setNewPhone] = useState("")
    const [buyerGstin, setBuyerGstin] = useState("")
    const [hsnSac, setHsnSac] = useState("7113")
    const [title, setTitle] = useState("")
    const [grams, setGrams] = useState("")
    const [touch, setTouch] = useState(kind === "PURCHASE" ? "70" : "74")
    const [lotId, setLotId] = useState("")
    const [payNow, setPayNow] = useState("")
    const [udhar, setUdhar] = useState(kind === "SALE")

    const partyKind = kind === "PURCHASE" ? "SUPPLIER" : "RETAILER"

    useEffect(() => {
        if (!open) return
        void listMetalParties().then((rows) => {
            const next = rows.filter((p) => p.kind === partyKind)
            setParties(next)
            if (next[0] && !partyId) {
                setPartyId(next[0].id)
                if (kind === "SALE") setBuyerGstin(next[0].gstin || "")
            }
        })
        if (kind === "SALE") void listMetalLots().then(setLots)
    }, [open, kind, partyKind])

    const touchBps = touchBpsFromPercent(Number(touch) || 0)
    const preview = k24PaisePer10g && Number(grams) > 0
        ? touchPaise(gramsToMg(Number(grams)), touchBps, k24PaisePer10g)
        : 0

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-[1.75rem]">
                <SheetHeader>
                    <SheetTitle>{kind === "PURCHASE" ? "Purchase in" : "Sale to a shop"}</SheetTitle>
                    <SheetDescription>
                        {kind === "PURCHASE" ? "Gujarat / vendor parcel at buy touch." : "Bill a retailer at sell touch. GST tax invoice prints on save."}
                    </SheetDescription>
                </SheetHeader>
                <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault()
                        start(async () => {
                            try {
                                let id = partyId
                                if (!id) {
                                    if (!newName.trim()) throw new Error("Name the party")
                                    const party = await saveParty({
                                        kind: partyKind,
                                        displayName: newName,
                                        phone: newPhone,
                                        gstin: kind === "SALE" ? buyerGstin : undefined,
                                    })
                                    id = party.id
                                }
                                const lines = [{
                                    title: title.trim() || "Lot",
                                    grossMg: gramsToMg(Number(grams)),
                                    touchBps,
                                    lotId: kind === "SALE" && lotId ? lotId : undefined,
                                }]
                                const payNowPaise = udhar ? rupeesToPaise(Number(payNow) || 0) : preview
                                if (kind === "PURCHASE") {
                                    await createMetalPurchase({ partyId: id, lines, payNowPaise, dueDays: udhar ? 15 : 0 })
                                    toast.success("Stock in")
                                } else {
                                    const saved = await createMetalSale({
                                        partyId: id,
                                        lines,
                                        payNowPaise,
                                        dueDays: udhar ? 15 : 0,
                                        buyerGstin,
                                        hsnSac,
                                    })
                                    toast.success("Bill saved")
                                    if (saved.receipt) openReceiptPdf(saved.receipt)
                                }
                                onOpenChange(false)
                            } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not save bill")
                            }
                        })
                    }}
                >
                    {parties.length ? (
                        <select
                            value={partyId}
                            onChange={(e) => {
                                const next = e.target.value
                                setPartyId(next)
                                const row = parties.find((p) => p.id === next)
                                if (kind === "SALE") setBuyerGstin(row?.gstin || "")
                            }}
                            className="h-11 w-full rounded-2xl border bg-background px-3"
                        >
                            {parties.map((p) => (
                                <option key={p.id} value={p.id}>{p.displayName}</option>
                            ))}
                            <option value="">New…</option>
                        </select>
                    ) : null}
                    {!partyId ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={kind === "PURCHASE" ? "Supplier" : "Shop name"} className="h-11" />
                            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" className="h-11" />
                        </div>
                    ) : null}
                    {kind === "SALE" ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                value={buyerGstin}
                                onChange={(e) => setBuyerGstin(e.target.value)}
                                placeholder="Buyer GSTIN (optional)"
                                className="h-11 font-mono uppercase"
                            />
                            <Input
                                value={hsnSac}
                                onChange={(e) => setHsnSac(e.target.value)}
                                placeholder="HSN/SAC"
                                className="h-11 font-mono"
                            />
                        </div>
                    ) : null}
                    {kind === "SALE" && lots.length ? (
                        <select value={lotId} onChange={(e) => {
                            setLotId(e.target.value)
                            const lot = lots.find((l) => l.id === e.target.value)
                            if (lot) {
                                setTitle(lot.title)
                                setGrams(String(lot.remainingGrossMg / 1000))
                            }
                        }} className="h-11 w-full rounded-2xl border bg-background px-3">
                            <option value="">Pick a lot</option>
                            {lots.map((l) => (
                                <option key={l.id} value={l.id}>{l.title} · {l.remainingGrossMg / 1000} g</option>
                            ))}
                        </select>
                    ) : null}
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design / lot" className="h-11" />
                    <div className="grid grid-cols-2 gap-2">
                        <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="Grams" className="h-11" />
                        <Input inputMode="decimal" value={touch} onChange={(e) => setTouch(e.target.value)} placeholder="Touch %" className="h-11" />
                    </div>
                    <p className="text-sm tabular-nums text-muted-foreground">
                        Bill {preview ? `₹${Math.round(preview / 100).toLocaleString("en-IN")}` : "—"} at {touch || "?"} touch
                    </p>
                    <label className="flex h-11 items-center justify-between rounded-2xl bg-muted/50 px-3 text-sm">
                        Udhar
                        <input type="checkbox" checked={udhar} onChange={(e) => setUdhar(e.target.checked)} />
                    </label>
                    {udhar ? (
                        <Input inputMode="decimal" value={payNow} onChange={(e) => setPayNow(e.target.value)} placeholder="Pay now ₹ (optional)" className="h-11" />
                    ) : null}
                    <Button type="submit" className="h-11 w-full rounded-full" disabled={pending || !Number(grams)}>
                        {kind === "PURCHASE" ? "Take stock in" : "Save bill"}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    )
}
