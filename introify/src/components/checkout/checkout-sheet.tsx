"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { usePricing } from "@/components/pricing-provider"
import { formatCheckoutPrice } from "@/lib/pricing"
import { isPhysical, whatsappHref } from "@/lib/commerce"
import { placeManualOrder } from "@/app/actions/products"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import { readBuyerMemory, writeBuyerMemory } from "@/lib/checkout-memory"
import { confidentialUploadsEnabled } from "@/lib/private-upload-policy"
import { ProfileStage } from "@/components/profile/profile-stage"
import {
    guestOrderReference,
    payMethodLabel,
    writeGuestShopOrder,
    type GuestShopOrder,
    type GuestShopPayMethod,
} from "@/lib/guest-shop-orders"
import { writePriorOrderItemIds } from "@/lib/restaurant-menu-sections"
import { notifyGuestShopOrdersChanged, GuestShopOrdersButton } from "@/components/shop/guest-shop-orders"

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
    requiresRx?: boolean
}

type Confirmation = {
    order: GuestShopOrder
    headline: string
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
    const [rxUrl, setRxUrl] = useState("")
    const [rxNote, setRxNote] = useState("")
    const [doctorName, setDoctorName] = useState("")
    const [rxBusy, setRxBusy] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
    const { currency: requestCurrency } = usePricing()
    const physical = item.itemType === "product" && isPhysical(item.fulfillment)
    const total = item.priceCents + (physical && (item.shipMode === "DELIVER" || item.shipMode === "BOTH") ? (item.shipFeeCents || 0) : 0)

    useEffect(() => {
        try {
            const remembered = readBuyerMemory(window.localStorage)
            if (remembered) {
                setEmail(remembered.email)
                setName(remembered.name)
            }
        } catch {}
    }, [])

    // Preserve catalog currency end-to-end (MK jewellery ₹ ticket must not become $1800).
    const price = formatCheckoutPrice(total, item.currency, requestCurrency)
    const cta =
        item.soldOut ? "Sold out"
        : item.itemType === "course" ? (item.priceCents === 0 ? "Enroll free" : `Enroll · ${price}`)
        : item.itemType === "event" ? "Register"
        : item.itemType === "community" ? "Join"
        : payMethod === "WHATSAPP" ? "WhatsApp the shop"
        : payMethod === "UPI" ? `Pay UPI · ${price}`
        : payMethod === "COD" ? `Order COD · ${price}`
        : item.priceCents === 0 ? "Get" : `Buy · ${price}`

    const persistGuestOrder = (input: {
        id: string
        slug: string
        method: GuestShopPayMethod
        status?: GuestShopOrder["status"]
        headline: string
    }) => {
        const order = writeGuestShopOrder({
            id: input.id,
            slug: input.slug,
            title: item.title,
            itemNames: [item.title + (variant ? ` (${variant})` : "")],
            totalCents: total,
            currency: (item.currency || "INR").toUpperCase(),
            payMethod: input.method,
            status: input.status,
        })
        try {
            writePriorOrderItemIds(input.slug, [item.itemId])
        } catch {}
        notifyGuestShopOrdersChanged()
        setConfirmation({ order, headline: input.headline })
        return order
    }

    const submit = async () => {
        if (!name.trim() || !email.includes("@")) {
            setError("Name and a real email are required.")
            return
        }
        if (item.soldOut) return
        if (item.requiresRx && !confidentialUploadsEnabled()) {
            setError("Prescription collection is not available yet.")
            return
        }
        if (item.requiresRx && !rxUrl.trim() && !rxNote.trim()) {
            setError("Attach a prescription photo or enter a short Rx note.")
            return
        }
        setBusy(true)
        setError(null)
        try {
            writeBuyerMemory(window.localStorage, { name: name.trim(), email: email.trim() })
            if (item.itemType === "product" && payMethod !== "CARD") {
                const order = await placeManualOrder({
                    productId: item.itemId,
                    visitorName: name.trim(),
                    visitorEmail: email.trim(),
                    payMethod,
                    address: [variant, address.trim()].filter(Boolean).join(" · ") || undefined,
                    prescriptionUrl: item.requiresRx ? rxUrl.trim() || undefined : undefined,
                    rxNote: item.requiresRx ? rxNote.trim() || undefined : undefined,
                    doctorName: item.requiresRx ? doctorName.trim() || undefined : undefined,
                })
                if (payMethod === "WHATSAPP") {
                    const href = whatsappHref(
                        item.whatsapp || order.whatsapp,
                        `Hi, I want ${item.title}${variant ? ` (${variant})` : ""} (${price}). Order ${guestOrderReference(order.id)}. Name: ${name.trim()}${item.requiresRx && (rxUrl || rxNote) ? ` · Rx: ${rxUrl || rxNote}${doctorName ? ` (Dr. ${doctorName})` : ""}` : ""}`,
                    )
                    if (href) window.open(href, "_blank")
                    persistGuestOrder({
                        id: order.id,
                        slug: order.slug,
                        method: "WHATSAPP",
                        status: "HANDOFF",
                        headline: "WhatsApp opened — shop has your request",
                    })
                    return
                }
                if (payMethod === "UPI") {
                    persistGuestOrder({
                        id: order.id,
                        slug: order.slug,
                        method: "UPI",
                        headline: `Pay ${price} via UPI`,
                    })
                    return
                }
                persistGuestOrder({
                    id: order.id,
                    slug: order.slug,
                    method: "COD",
                    headline: "Order placed",
                })
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
                const sessionId = typeof data.sessionId === "string" && data.sessionId
                    ? data.sessionId
                    : `card-${Date.now()}`
                const slugGuess = typeof data.profileSlug === "string" ? data.profileSlug : ""
                // Best-effort local handoff record before leaving for Stripe.
                if (slugGuess || item.itemType === "product") {
                    try {
                        // Stripe success lands on /{slug}; slug may be absent on older responses.
                        const metaSlug = slugGuess || (typeof window !== "undefined"
                            ? window.location.pathname.split("/").filter(Boolean)[0] || "shop"
                            : "shop")
                        persistGuestOrder({
                            id: sessionId,
                            slug: metaSlug,
                            method: "CARD",
                            status: "PENDING_CARD",
                            headline: "Opening secure card checkout",
                        })
                    } catch {}
                }
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
            const raw = e instanceof Error ? e.message : ""
            const friendly =
                !raw || /Minified React error #441|Server Components render/i.test(raw)
                    ? "Could not place that order. Check your details and try again."
                    : raw
            setError(friendly)
        } finally {
            setBusy(false)
        }
    }

    return (
        <ProfileStage
            open
            onClose={onClose}
            forcePopup
            zClass="z-[60]"
            className="bg-background text-foreground border-border"
        >
            <div className="relative min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex h-12 items-center justify-between gap-2 border-b border-border px-2">
                    <h2 className="min-w-0 truncate px-2 text-sm font-medium">{item.title}</h2>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4">
                {item.description && !confirmation ? <p className="mb-3 text-sm text-muted-foreground line-clamp-3">{item.description}</p> : null}
                {!confirmation ? <p className="mb-4 text-2xl font-semibold tabular-nums">{price}</p> : null}
                {item.gstin && !confirmation ? <p className="mb-3 text-[11px] text-muted-foreground">GSTIN {item.gstin}</p> : null}
                {confirmation ? (
                    <div className="space-y-3" data-testid="checkout-confirmation">
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{confirmation.headline}</p>
                            <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Order reference</p>
                            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums" data-testid="checkout-order-ref">
                                {confirmation.order.reference}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-muted px-3 py-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium">{confirmation.order.itemNames[0]}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {payMethodLabel(confirmation.order.payMethod)}
                                    </p>
                                </div>
                                <span className="shrink-0 text-base font-semibold tabular-nums" data-testid="checkout-order-total">
                                    {formatCheckoutPrice(
                                        confirmation.order.totalCents,
                                        confirmation.order.currency,
                                        confirmation.order.currency === "INR" ? "INR" : requestCurrency,
                                    )}
                                </span>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">{confirmation.order.nextStep}</p>
                            {confirmation.order.payMethod === "UPI" && (item.upiId) ? (
                                <p className="mt-2 text-xs font-medium">UPI ID · {item.upiId}</p>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-2">
                            {confirmation.order.slug ? (
                                <div className="flex justify-center">
                                    <GuestShopOrdersButton slug={confirmation.order.slug} label="text" className="!h-10 w-full justify-center rounded-full border border-border bg-background text-sm font-medium" />
                                </div>
                            ) : null}
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full rounded-full"
                                onClick={onClose}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                ) : (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Your name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina Rao" autoComplete="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
                        <p className="text-xs text-muted-foreground">
                            {physical ? "We'll email the order confirmation." : "We send a link to your library. No password."}
                        </p>
                    </div>
                    {item.variants && item.variants.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {item.variants.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setVariant(name)}
                                    className={`h-8 rounded-full px-3 text-xs ${variant === name ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
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
                    {item.requiresRx ? (
                        <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                            <Label>Prescription</Label>
                            {!confidentialUploadsEnabled() ? (
                                <p className="text-[11px] text-muted-foreground">Prescription collection is not available yet. Private storage is required before confidential files can be uploaded.</p>
                            ) : (
                            <p className="text-[11px] text-muted-foreground">Upload a photo or enter a short Rx note. Optional doctor name.</p>
                            )}
                            {confidentialUploadsEnabled() && rxUrl ? (
                                <div className="flex items-center justify-between gap-2">
                                    <a href={rxUrl} target="_blank" rel="noreferrer" className="truncate text-xs underline">View attached</a>
                                    <button type="button" className="text-xs text-muted-foreground" onClick={() => setRxUrl("")}>Remove</button>
                                </div>
                            ) : confidentialUploadsEnabled() ? (
                                <Input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    disabled={rxBusy}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        setRxBusy(true)
                                        setError(null)
                                        try {
                                            const body = new FormData()
                                            body.append("file", file)
                                            const res = await fetch("/api/upload", { method: "POST", body })
                                            const json = await res.json()
                                            if (!json.url) throw new Error("Upload failed")
                                            setRxUrl(json.url)
                                        } catch {
                                            setError("Could not upload the prescription")
                                        } finally {
                                            setRxBusy(false)
                                        }
                                    }}
                                />
                            ) : null}
                            {confidentialUploadsEnabled() ? (
                                <>
                            <Input
                                value={rxNote}
                                onChange={(e) => setRxNote(e.target.value)}
                                placeholder="Short Rx note (if no photo)"
                                className="h-10 rounded-xl"
                            />
                            <Input
                                value={doctorName}
                                onChange={(e) => setDoctorName(e.target.value)}
                                placeholder="Doctor name (optional)"
                                className="h-10 rounded-xl"
                            />
                                </>
                            ) : null}
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
                                        className={`h-9 rounded-full text-xs font-medium ${payMethod === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                                    >
                                        {id === "WHATSAPP" ? <WhatsAppIcon className="mx-auto h-4 w-4" /> : label}
                                    </button>
                                )
                            })}
                        </div>
                    ) : null}
                    {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
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
        </ProfileStage>
    )
}

