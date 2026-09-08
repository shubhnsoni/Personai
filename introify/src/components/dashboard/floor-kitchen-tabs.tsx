"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function FloorKitchenTabs({
    floor,
    kitchen,
    openOrders,
    actions,
}: {
    floor: ReactNode
    kitchen: ReactNode
    openOrders: number
    actions?: ReactNode
}) {
    const [tab, setTab] = useState<"floor" | "kitchen">("floor")
    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-[12rem] flex-1 gap-1 rounded-full bg-muted p-1">
                    <button
                        type="button"
                        onClick={() => setTab("floor")}
                        className={cn(
                            "h-8 flex-1 rounded-full text-sm font-medium",
                            tab === "floor" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                        )}
                    >
                        Floor
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("kitchen")}
                        className={cn(
                            "h-8 flex-1 rounded-full text-sm font-medium",
                            tab === "kitchen" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                        )}
                    >
                        Kitchen{openOrders ? ` · ${openOrders}` : ""}
                    </button>
                </div>
                {actions}
            </div>
            <div>{tab === "floor" ? floor : kitchen}</div>
        </div>
    )
}
