"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ClipboardList, X } from "lucide-react"
import { formatCheckoutPrice } from "@/lib/pricing"
import {
    guestShopOrderCount,
    payMethodLabel,
    readGuestShopOrders,
    type GuestShopOrder,
} from "@/lib/guest-shop-orders"
import { cn } from "@/lib/utils"
import { bottomDrawerPanelClassName, bottomDrawerShellClassName } from "@/components/ui/sheet"

function statusLabel(order: GuestShopOrder) {
    switch (order.status) {
        case "HANDOFF": return "WhatsApp handoff"
        case "PENDING_CARD": return "Card checkout"
        default: return "Placed"
    }
}

function OrdersPanel({
    slug,
    orders,
    onClose,
}: {
    slug: string
    orders: GuestShopOrder[]
    onClose: () => void
}) {
    return (
        <div className={cn("fixed inset-0 z-[80]", bottomDrawerShellClassName)}>
            <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
            <div className={cn("relative z-[61] w-full overflow-auto overscroll-contain rounded-t-[1.6rem] bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl md:max-w-lg lg:max-w-xl md:rounded-2xl", bottomDrawerPanelClassName)}>
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-[15px] font-semibold">Your orders</p>
                    <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {orders.length === 0 ? (
                    <p className="rounded-2xl bg-muted px-3 py-4 text-sm text-muted-foreground">
                        No saved orders on this device for {slug} yet. Place a COD, UPI, WhatsApp, or card order to see it here.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {orders.map((order) => (
                            <article key={order.id} className="rounded-2xl bg-muted px-3 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold tabular-nums">{order.reference}</p>
                                        <p className="mt-0.5 truncate text-[13px] text-foreground">{order.itemNames.join(", ")}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                        {statusLabel(order)}
                                    </span>
                                </div>
                                <p className="mt-2 text-[12px] text-muted-foreground">
                                    {payMethodLabel(order.payMethod)}
                                    {" · "}
                                    <span className="tabular-nums text-foreground">
                                        {formatCheckoutPrice(order.totalCents, order.currency, order.currency === "INR" ? "INR" : "USD")}
                                    </span>
                                </p>
                                <p className="mt-1 text-[12px] text-muted-foreground">{order.nextStep}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {new Date(order.createdAt).toLocaleString()}
                                </p>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function GuestShopOrdersButton({
    slug,
    className,
    label = "icon",
}: {
    slug: string
    className?: string
    /** icon = header chip; text = PDP ghost button */
    label?: "icon" | "text"
}) {
    const [count, setCount] = useState(0)
    const [orders, setOrders] = useState<GuestShopOrder[]>([])
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const refresh = () => {
            setCount(guestShopOrderCount(slug))
            setOrders(readGuestShopOrders(slug))
        }
        refresh()
        const onStorage = (event: StorageEvent) => {
            if (!event.key || event.key === `pl-guest-shop-orders-${slug}`) refresh()
        }
        window.addEventListener("storage", onStorage)
        window.addEventListener("pl-guest-shop-orders", refresh as EventListener)
        return () => {
            window.removeEventListener("storage", onStorage)
            window.removeEventListener("pl-guest-shop-orders", refresh as EventListener)
        }
    }, [slug])

    if (label === "icon" && count === 0) return null

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setOrders(readGuestShopOrders(slug))
                    setCount(guestShopOrderCount(slug))
                    setOpen(true)
                }}
                className={cn(
                    label === "text"
                        ? "ghost-btn"
                        : "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted",
                    className,
                )}
                aria-label={count ? `Your orders (${count})` : "Your orders"}
            >
                {label === "text" ? (
                    count > 0 ? `Orders · ${count}` : "Your orders"
                ) : (
                    <>
                        <ClipboardList className="h-4 w-4" />
                        {count > 0 ? (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
                                {count}
                            </span>
                        ) : null}
                    </>
                )}
            </button>
            {open && typeof document !== "undefined"
                ? createPortal(
                    <OrdersPanel slug={slug} orders={orders} onClose={() => setOpen(false)} />,
                    document.body,
                )
                : null}
        </>
    )
}

/** Call after writing a guest order so open headers/PDPs refresh without a full reload. */
export function notifyGuestShopOrdersChanged() {
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event("pl-guest-shop-orders"))
}
