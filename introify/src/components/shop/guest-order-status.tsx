"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { formatStoredPrice, type DisplayCurrency } from "@/lib/pricing"
import { upiPayHref } from "@/lib/payment-qr"
import { drawQrCard } from "@/lib/qr-draw"
import { guestConfirmPaid } from "@/app/actions/orders"
import { LiveOrderCountButton } from "@/components/shop/live-order-button"
import { ReceiptPrinter } from "@/components/shop/receipt-printer"
import type { ReceiptData } from "@/lib/receipt"

type GuestOrder = {
    token: string
    number: number
    status: string
    payStatus: string
    payMethod: string | null
    payMode?: "PREPAID" | "LATER"
    guestPaid?: boolean
    channel: string
    tableLabel: string | null
    totalCents: number
    currency: string
    placedAt: string
    readyAt: string | null
    dueAt?: string | null
    staffNote?: string | null
    shopName: string
    slug: string
    upiId: string | null
    paymentQrUrl: string | null
    logoUrl: string | null
    lines: Array<{ title: string; qty: number; modifiersLabel: string | null; status: string; lineTotalCents: number }>
}

const ETA_MS = 15 * 60 * 1000

function statusCopy(status: string) {
    switch (status) {
        case "PLACED": return "Waiting for the kitchen"
        case "ACCEPTED": return "Accepted — starting soon"
        case "PREPARING": return "Cooking now"
        case "READY": return "Ready"
        case "SERVED": return "Delivered"
        case "PAID": return "Paid"
        case "CANCELLED": return "Cancelled"
        default: return status
    }
}

export function GuestOrderStatus({ initial }: { initial: GuestOrder }) {
    const [order, setOrder] = useState(initial)
    const [now, setNow] = useState<number | null>(null)
    const [upiQr, setUpiQr] = useState<string | null>(null)
    const [sayingPaid, setSayingPaid] = useState(false)
    const [receiptOpen, setReceiptOpen] = useState(false)

    useEffect(() => {
        setNow(Date.now())
        const tick = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(tick)
    }, [])

    useEffect(() => {
        let stop = false
        async function pull() {
            try {
                const res = await fetch(`/api/o/${order.token}`, { cache: "no-store" })
                if (!res.ok) return
                const next = await res.json() as GuestOrder
                if (!stop) setOrder(next)
            } catch { /* keep last snapshot */ }
        }
        const id = window.setInterval(pull, 4000)
        return () => { stop = true; window.clearInterval(id) }
    }, [order.token])

    const remaining = useMemo(() => {
        if (now == null) return null
        if (["READY", "SERVED", "PAID", "CANCELLED"].includes(order.status)) return 0
        const placed = new Date(order.placedAt).getTime()
        const due = order.dueAt ? new Date(order.dueAt).getTime() : placed + ETA_MS
        const end = due - placed > 3.5 * 60 * 60 * 1000 ? placed + ETA_MS : due
        return Math.max(0, end - now)
    }, [order.placedAt, order.dueAt, order.status, now])

    const mm = Math.floor((remaining || 0) / 60000)
    const ss = Math.floor(((remaining || 0) % 60000) / 1000)
    const unpaid = order.payStatus !== "PAID" && order.status !== "CANCELLED"
    const prepaid = order.payMode === "PREPAID" || order.payMethod === "UPI"
    const rupees = Math.round(order.totalCents / 100)
    const payHref = order.upiId
        ? upiPayHref({ upiId: order.upiId, name: order.shopName, amountRupees: rupees, note: `Order ${order.number}` })
        : null
    const money = (cents: number) => formatStoredPrice(cents, order.currency, order.currency as DisplayCurrency)
    const receiptData: ReceiptData = {
        shopName: order.shopName,
        number: order.number,
        tableLabel: order.tableLabel,
        guestName: null,
        status: order.status,
        payStatus: order.payStatus,
        payMethod: order.payMethod,
        placedAt: new Date(order.placedAt).toLocaleString(),
        lines: order.lines.map((line) => ({
            qty: line.qty,
            title: line.title,
            modifiersLabel: line.modifiersLabel,
            lineTotal: money(line.lineTotalCents),
        })),
        subtotal: money(order.totalCents),
        total: money(order.totalCents),
        upiId: order.upiId,
    }

    useEffect(() => {
        if (!unpaid || !payHref) { setUpiQr(null); return }
        drawQrCard({ url: payHref, name: `Pay ${order.shopName}`, style: "ink", size: 720 })
            .then(setUpiQr)
            .catch(() => setUpiQr(null))
    }, [unpaid, payHref, order.shopName])

    return (
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{order.shopName}</p>
                    <h1 className="text-2xl font-semibold">Order #{order.number}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/${order.slug}/menu`} className="text-sm text-muted-foreground underline">Menu</Link>
                </div>
            </div>

            <section className="rounded-3xl bg-card p-5 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.5)]">
                <p className="text-sm font-semibold">{statusCopy(order.status)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {order.tableLabel ? `Table ${order.tableLabel.replace(/^table\s+/i, "")}` : "Takeaway"}
                    {order.payStatus === "PAID" ? " · Paid" : order.guestPaid ? " · You marked paid" : " · Payment pending"}
                </p>
                {order.staffNote ? <p className="mt-2 text-sm text-cyan-800 dark:text-cyan-300">{order.staffNote}</p> : null}
                {order.status === "CANCELLED" ? null : remaining == null ? (
                    <p className="mt-4 font-mono text-4xl font-semibold tabular-nums tracking-tight">--:--</p>
                ) : remaining > 0 ? (
                    <p className="mt-4 font-mono text-4xl font-semibold tabular-nums tracking-tight">
                        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                    </p>
                ) : (
                    <p className="mt-4 text-2xl font-semibold">{order.status === "READY" ? "Come pick it up" : order.status === "PAID" || order.status === "SERVED" ? "Done" : "Almost there"}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Kitchen timer · updates live</p>
            </section>

            <section className="space-y-2 rounded-3xl bg-card p-4">
                {order.lines.map((line, i) => (
                    <div key={`${line.title}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                            <p className="font-medium">{line.qty}× {line.title}</p>
                            {line.modifiersLabel ? <p className="text-xs text-muted-foreground">{line.modifiersLabel}</p> : null}
                            <p className="text-[11px] text-muted-foreground">{line.status}</p>
                        </div>
                        <span className="tabular-nums">{formatStoredPrice(line.lineTotalCents, order.currency, order.currency as DisplayCurrency)}</span>
                    </div>
                ))}
                <div className="flex justify-between border-t border-border/50 pt-2 text-sm font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatStoredPrice(order.totalCents, order.currency, order.currency as DisplayCurrency)}</span>
                </div>
                <button
                    type="button"
                    className="mt-3 w-full rounded-full border border-border py-2 text-sm"
                    onClick={() => setReceiptOpen(true)}
                >
                    Receipt
                </button>
            </section>

            {unpaid ? (
                <section className="rounded-3xl bg-card p-4">
                    <p className="text-sm font-semibold">{prepaid ? "Pay now" : "Pay here"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {prepaid ? "Prepaid — scan the QR or open UPI." : "Pay at the table or counter, or scan UPI."}
                    </p>
                    <div className="mt-3 grid gap-3">
                        {order.paymentQrUrl ? (
                            <img src={order.paymentQrUrl} alt="Restaurant payment QR" className="mx-auto w-full max-w-[220px] rounded-2xl bg-white p-2" />
                        ) : upiQr ? (
                            <img src={upiQr} alt="UPI QR" className="mx-auto w-full max-w-[220px] rounded-2xl" />
                        ) : null}
                        {order.upiId ? (
                            <p className="text-center text-sm">UPI <span className="font-semibold">{order.upiId}</span></p>
                        ) : null}
                        {payHref ? (
                            <a
                                href={payHref}
                                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white"
                            >
                                Pay ₹{rupees}
                            </a>
                        ) : null}
                        {prepaid && !order.guestPaid ? (
                            <button
                                type="button"
                                disabled={sayingPaid}
                                className="text-center text-sm text-muted-foreground underline"
                                onClick={async () => {
                                    setSayingPaid(true)
                                    try {
                                        await guestConfirmPaid(order.token)
                                        setOrder((cur) => ({ ...cur, guestPaid: true }))
                                    } finally {
                                        setSayingPaid(false)
                                    }
                                }}
                            >
                                {sayingPaid ? "Telling kitchen…" : "I've completed payment"}
                            </button>
                        ) : null}
                    </div>
                </section>
            ) : null}

            <div className="pointer-events-none fixed bottom-5 right-4 z-30">
                <div className="pointer-events-auto">
                    <LiveOrderCountButton slug={order.slug} />
                </div>
            </div>
            {receiptOpen ? <ReceiptPrinter data={receiptData} onClose={() => setReceiptOpen(false)} /> : null}
        </div>
    )
}
