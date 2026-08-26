"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { advanceOrder, cancelOrder, markOrderPaid, setLineStatus } from "@/app/actions/orders"
import type { RestaurantOrderLineStatus, RestaurantOrderStatus } from "@/lib/restaurant-orders"

const ORDER_ACTION: Partial<Record<RestaurantOrderStatus, string>> = {
    PLACED: "Accept",
    ACCEPTED: "Start preparing",
    PREPARING: "Mark ready",
    READY: "Mark served",
    SERVED: "Mark paid",
}

const LINE_NEXT: Partial<Record<RestaurantOrderLineStatus, RestaurantOrderLineStatus>> = {
    QUEUED: "PREPARING",
    PREPARING: "READY",
    READY: "SERVED",
}

export function RestaurantOrderControls({
    orderId,
    status,
    lines,
}: {
    orderId: string
    status: RestaurantOrderStatus
    lines: Array<{ id: string; title: string; status: RestaurantOrderLineStatus }>
}) {
    const router = useRouter()
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const closed = status === "PAID" || status === "CANCELLED"

    async function run(key: string, action: () => Promise<unknown>) {
        setBusy(key)
        setError(null)
        try {
            await action()
            router.refresh()
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not update the order")
        } finally {
            setBusy(null)
        }
    }

    const orderAction = ORDER_ACTION[status]
    return (
        <div className="mt-3 space-y-2">
            {!closed && orderAction ? (
                <Button
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={busy !== null}
                    onClick={() => run("order", () => status === "SERVED" ? markOrderPaid(orderId) : advanceOrder(orderId))}
                >
                    {busy === "order" ? "Updating…" : orderAction}
                </Button>
            ) : null}
            {!closed ? (
                <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 h-8 rounded-full"
                    disabled={busy !== null}
                    onClick={() => {
                        const reason = window.prompt("Why is this order being cancelled?")?.trim()
                        if (reason) void run("cancel", () => cancelOrder(orderId, reason))
                    }}
                >
                    {busy === "cancel" ? "Cancelling…" : "Cancel"}
                </Button>
            ) : null}

            {!closed && lines.some((line) => LINE_NEXT[line.status]) ? (
                <div className="flex flex-wrap gap-1.5">
                    {lines.map((line) => {
                        const next = LINE_NEXT[line.status]
                        if (!next) return null
                        const key = `line:${line.id}`
                        return (
                            <Button
                                key={line.id}
                                size="sm"
                                variant="secondary"
                                className="h-7 rounded-full text-[11px]"
                                disabled={busy !== null}
                                onClick={() => run(key, () => setLineStatus(line.id, next))}
                            >
                                {busy === key ? "Updating…" : `${line.title}: ${next.toLowerCase()}`}
                            </Button>
                        )
                    })}
                </div>
            ) : null}
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
    )
}
