"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Clock3, X } from "lucide-react"
import { useLiveOrders, type LiveOrder } from "@/components/shop/use-live-order"
import { cn } from "@/lib/utils"

function remainingLabel(dueAt?: string | null) {
    if (!dueAt) return null
    const ms = new Date(dueAt).getTime() - Date.now()
    if (ms <= 0) return "Due now"
    if (ms > 3.5 * 60 * 60 * 1000) return null
    const mm = Math.floor(ms / 60000)
    const ss = Math.floor((ms % 60000) / 1000)
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
}

function OrdersSheet({
    orders,
    onClose,
}: {
    orders: LiveOrder[]
    onClose: () => void
}) {
    return (
        <div className="fixed inset-0 z-[80]">
            <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
            <div className="absolute bottom-0 left-0 right-0 z-[61] max-h-[70dvh] overflow-auto rounded-t-[1.6rem] bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-[15px] font-semibold">Your orders</p>
                    <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-2">
                    {orders.map((order) => (
                        <Link
                            key={order.token}
                            href={`/o/${order.token}`}
                            onClick={onClose}
                            className="block rounded-2xl bg-muted px-3 py-3"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <Clock3 className="h-4 w-4" />
                                    Order #{order.number}
                                </span>
                                <span className="text-[12px] tabular-nums text-muted-foreground">
                                    {remainingLabel(order.dueAt) || order.status}
                                </span>
                            </span>
                            <span className="mt-1 block text-[12px] text-muted-foreground">
                                {order.tableLabel || "Takeaway"}
                                {order.titles?.length ? ` · ${order.titles.join(", ")}` : ""}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function LiveOrderCountButton({ slug, className }: { slug: string; className?: string }) {
    const orders = useLiveOrders(slug)
    const [open, setOpen] = useState(false)
    if (!orders.length) return null
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 text-zinc-950 shadow-[0_10px_28px_rgba(0,215,255,0.28)]",
                    className,
                )}
                aria-label={`${orders.length} live orders`}
            >
                <Clock3 className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-bold text-white">
                    {orders.length}
                </span>
            </button>
            {open && typeof document !== "undefined"
                ? createPortal(<OrdersSheet orders={orders} onClose={() => setOpen(false)} />, document.body)
                : null}
        </>
    )
}

export function LiveOrderHeaderButton({ slug }: { slug: string }) {
    return <LiveOrderCountButton slug={slug} className="h-9 w-9 shadow-none" />
}

export function LiveOrderTrackBar({ slug, className }: { slug: string; className?: string }) {
    return <LiveOrderCountButton slug={slug} className={className} />
}
