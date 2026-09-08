"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { advanceOrder, extendOrder, markOrderPaid, rejectOrder } from "@/app/actions/orders"
import type { RestaurantOrderStatus } from "@/lib/restaurant-orders"

const NEXT_LABEL: Partial<Record<RestaurantOrderStatus, string>> = {
    PLACED: "Approve",
    ACCEPTED: "Mark cooking",
    PREPARING: "Mark ready",
    READY: "Deliver",
    SERVED: "Mark paid",
}

export function RestaurantOrderControls({
    orderId,
    status,
    staffNote,
    dueAt,
    guestPaid,
}: {
    orderId: string
    status: RestaurantOrderStatus
    staffNote?: string | null
    dueAt?: string | null
    guestPaid?: boolean
}) {
    const router = useRouter()
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [note, setNote] = useState("")
    const closed = status === "PAID" || status === "CANCELLED"
    const next = NEXT_LABEL[status]

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

    return (
        <div className="mt-2 space-y-1.5">
            {guestPaid && status !== "PAID" ? (
                <p className="text-xs font-medium text-emerald-700">Guest says they paid</p>
            ) : null}
            {staffNote ? <p className="text-xs text-muted-foreground">Kitchen note: {staffNote}</p> : null}
            {dueAt && !closed ? (
                <p className="text-xs text-muted-foreground">Due {new Date(dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
                {next && !closed ? (
                    <Button
                        size="sm"
                        className="h-8 rounded-full"
                        disabled={busy !== null}
                        onClick={() => run("next", () => status === "SERVED" ? markOrderPaid(orderId) : advanceOrder(orderId))}
                    >
                        {busy === "next" ? "Updating…" : next}
                    </Button>
                ) : null}
                {status === "PLACED" ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full"
                        disabled={busy !== null}
                        onClick={() => {
                            const reason = window.prompt("Reject reason?")?.trim()
                            if (reason) void run("reject", () => rejectOrder(orderId, reason))
                        }}
                    >
                        {busy === "reject" ? "Rejecting…" : "Reject"}
                    </Button>
                ) : !closed ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full"
                        disabled={busy !== null}
                        onClick={() => {
                            const reason = window.prompt("Cancel reason?")?.trim()
                            if (reason) void run("reject", () => rejectOrder(orderId, reason))
                        }}
                    >
                        Cancel
                    </Button>
                ) : null}
            </div>
            {!closed && (status === "ACCEPTED" || status === "PREPARING" || status === "PLACED") ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    {[5, 10, 15].map((mins) => (
                        <Button
                            key={mins}
                            size="sm"
                            variant="secondary"
                            className="h-7 rounded-full text-[11px]"
                            disabled={busy !== null}
                            onClick={() => run(`plus${mins}`, () => extendOrder(orderId, mins, note || undefined))}
                        >
                            +{mins} min
                        </Button>
                    ))}
                    <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Note with extra time (optional)"
                        className="h-8 min-w-40 flex-1 rounded-full text-xs"
                    />
                </div>
            ) : null}
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
    )
}
