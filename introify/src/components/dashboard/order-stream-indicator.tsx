"use client"

import { useOrderStream } from "@/lib/use-order-stream"
import { cn } from "@/lib/utils"

/**
 * Live badge for the staff order board. Shows the transport state honestly so
 * stale data is never presented as current.
 */
export function OrderStreamIndicator({ className }: { className?: string }) {
    const { degraded, lastEventAt } = useOrderStream("/api/events/orders", "/api/events/orders/cursor")

    return (
        <span
            className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}
            aria-live="polite"
        >
            <span
                aria-hidden
                className={cn(
                    "size-1.5 rounded-full",
                    degraded ? "bg-amber-500" : "animate-pulse bg-emerald-500",
                )}
            />
            {degraded ? "Reconnecting — polling every 2s" : "Live"}
            {lastEventAt && !degraded ? (
                <span className="tabular-nums opacity-60">
                    · updated {new Date(lastEventAt).toLocaleTimeString()}
                </span>
            ) : null}
        </span>
    )
}
