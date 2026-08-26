"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { useMoney } from "@/components/pricing-provider"
import { isPhysical, whatsappHref } from "@/lib/commerce"
import { placeManualOrder } from "@/app/actions/products"

export type CheckoutItem = {
    itemType: "product" | "course" | "event" | "community"
    itemId: string
    title: string
    priceCents: number
    currency?: string | null
    description?: string | null
    fulfillment?: string | null
    allowCod?: boolean
    upiId?: string | null
    whatsapp?: string | null
    shipMode?: string | null
    shipFeeCents?: number
    gstin?: string | null
    soldOut?: boolean
    variants?: string[]
}

export function CheckoutSheet({
    item,
    onClose,
}: {
    item: CheckoutItem
    onClose: () => void
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [address, setAddress] = useState("")
    const [variant, setVariant] = useState(item.variants?.[0] || "")
    const [payMethod, setPayMethod] = useState<"CARD" | "UPI" | "COD" | "WHATSAPP">(
        item.upiId ? "UPI" : item.whatsapp ? "WHATSAPP" : "CARD",
    )
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState<string | null>(null)
    const money = useMoney()
    const physical = item.itemType === "product" && isPhysical(item.fulfillment)
    const total = item.priceCents + (physical && (item.shipMode === "DELIVER" || item.shipMode === "BOTH") ? (item.shipFeeCents || 0) : 0)

    useEffect(() => {
        try {
            setEmail(localStorage.getItem("pl_buyer_email") || "")
            setName(localStorage.getItem("pl_buyer_name") || "")
        } catch {}
    }, [])

    const price = money(total, item.currency)
    const cta =
        item.soldOut ? "Sold out"
        : item.itemType === "course" ? (item.priceCents === 0 ? "Enroll free" : `Enroll · ${price}`)
        : item.itemType === "event" ? "Register"
        : item.itemType === "community" ? "Join"
        : payMethod === "WHATSAPP" ? "WhatsApp the shop"
        : payMethod === "UPI" ? `Pay UPI · ${price}`
        : payMethod === "COD" ? `Order COD · ${price}`
        : item.priceCents === 0 ? "Get" : `Buy · ${price}`

    const submit = async () => {
        if (!name.trim() || !email.includes("@")) {
            setError("Name and a real email are required.")
            return
        }
        if (item.soldOut) return
        setBusy(true)
        setError(null)
        try {
            localStorage.setItem("pl_buyer_email", email.trim())
            localStorage.setItem("pl_buyer_name", name.trim())
            if (item.itemType === "product" && payMethod !== "CARD") {
                const order = await placeManualOrder({
                    productId: item.itemId,
                    visitorName: name.trim(),
                    visitorEmail: email.trim(),
                    payMethod,
                    address: [variant, address.trim()].filter(Boolean).join(" · ") || undefined,
                })
                if (payMethod === "WHATSAPP") {
                    const href = whatsappHref(
                        item.whatsapp || order.whatsapp,
                        `Hi, I want ${item.title}${variant ? ` (${variant})` : ""} (${price}). Name: ${name.trim()}`,
                    )
                    if (href) window.open(href, "_blank")
                    setDone("WhatsApp opened. The shop has your order.")
                    return
                }
                if (payMethod === "UPI") {
                    setDone(`Pay ${price} to ${item.upiId || order.upiId || "the UPI ID on this page"}. They’ll confirm in Sales.`)
                    return
                }
                setDone("Order placed. Pay cash when you receive it.")
                return
            }
            const res = await fetch("/api/stripe/purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemType: item.itemType,
                    itemId: item.itemId,
                    visitorName: name.trim(),
                    visitorEmail: email.trim(),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error === "payments_not_configured" ? "Payments are not set up yet." : (data.error || "Checkout failed"))
            }
            if (data.url) {
                window.location.href = data.url
                return
            }
            if (data.libraryUrl) {
                window.location.href = data.libraryUrl
                return
            }
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl
                return
            }
            throw new Error("No checkout URL returned")
        } catch (e) {
            setError(e instanceof Error ? e.message : "Checkout failed")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative max-h-[min(88dvh,100%)] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl">
                <div className="flex h-12 items-center justify-between gap-2 border-b border-white/8 px-2">
                    <h2 className="min-w-0 truncate px-2 text-sm font-medium">{item.title}</h2>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4">
                {item.description && <p className="mb-3 text-sm text-zinc-400 line-clamp-3">{item.description}</p>}
                <p className="mb-4 text-2xl font-semibold tabular-nums">{price}</p>
                {item.gstin ? <p className="mb-3 text-[11px] text-zinc-500">GSTIN {item.gstin}</p> : null}
                {done ? (
                    <p className="rounded-2xl bg-white/5 px-3 py-3 text-sm text-zinc-200">{done}</p>
                ) : (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Your name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina Rao" autoComplete="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
                        <p className="text-xs text-zinc-500">We send a link to your library. No password.</p>
                    </div>
                    {item.variants && item.variants.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {item.variants.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setVariant(name)}
                                    className={`h-8 rounded-full px-3 text-xs ${variant === name ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300"}`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {physical ? (
                        <div className="space-y-1.5">
                            <Label>Address / pickup note</Label>
                            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
                        </div>
                    ) : null}
                    {item.itemType === "product" ? (
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                ["CARD", "Card"],
                                item.upiId ? ["UPI", "UPI"] : null,
                                item.allowCod ? ["COD", "COD"] : null,
                                item.whatsapp ? ["WHATSAPP", "WhatsApp"] : null,
                            ] as const).filter(Boolean).map((row) => {
                                const [id, label] = row as ["CARD" | "UPI" | "COD" | "WHATSAPP", string]
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setPayMethod(id)}
                                        className={`h-9 rounded-full text-xs font-medium ${payMethod === id ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300"}`}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    ) : null}
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button
                        className="h-11 w-full rounded-full bg-brand text-brand-foreground"
                        disabled={busy || item.soldOut}
                        onClick={submit}
                    >
                        {busy ? "Working..." : cta}
                    </Button>
                </div>
                )}
                </div>
            </div>
        </div>
    )
}
