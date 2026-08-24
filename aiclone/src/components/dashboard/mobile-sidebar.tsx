"use client"

import { usePathname, useRouter } from "next/navigation"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { countForHref, type NavCounts } from "@/lib/nav-counts"
import { isActivePath, visibleNavItems } from "./sidebar"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"

interface MobileSidebarProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    counts?: NavCounts
    role?: string | null
    extras?: import("@/lib/surfaces").SurfaceExtras | null
}

export function MobileSidebar({ open, onOpenChange, counts, role, extras }: MobileSidebarProps) {
    const pathname = usePathname()
    const router = useRouter()

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="z-[60] max-h-[80dvh] gap-0 rounded-t-3xl border-t p-0 sm:max-w-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <SheetHeader className="relative shrink-0 space-y-0 p-0">
                    <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" />
                    <div className="flex h-12 items-center px-4 pr-12">
                        <SheetTitle className="sr-only">Menu</SheetTitle>
                        <Logo href="/dashboard" size="sm" />
                    </div>
                </SheetHeader>
                <div className="min-h-0 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="grid grid-cols-2 gap-2.5">
                        {visibleNavItems(role, extras).map((item) => {
                            const active = isActivePath(pathname, item)
                            const stat = counts ? countForHref(counts, item.href) : null
                            const value = stat?.value ?? 0
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => {
                                        if (pathname !== item.href) router.push(item.href)
                                        onOpenChange(false)
                                    }}
                                    className={cn(
                                        "flex min-h-[5.75rem] flex-col justify-between rounded-2xl border p-3 text-left touch-manipulation",
                                        active
                                            ? "border-aurora/40 bg-aurora/10"
                                            : "border-border/70 bg-card"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div
                                            className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-xl",
                                                active ? "bg-aurora/20 text-aurora" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        {item.href !== "/dashboard" && (
                                            <div className="text-right">
                                                <p className="text-xl font-semibold leading-none tabular-nums">{value}</p>
                                                {stat?.fresh ? (
                                                    <p className="mt-1 text-[11px] font-medium text-aurora">{stat.fresh} new</p>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-end justify-between gap-2">
                                        <p className="min-w-0 text-sm font-medium leading-tight">{item.name}</p>
                                        {item.href !== "/dashboard" && stat?.spark && stat.spark.some((n) => n > 0) ? (
                                            <MiniSpark
                                                values={stat.spark}
                                                className={cn(
                                                    "shrink-0",
                                                    stat.spark[stat.spark.length - 1] >= stat.spark[0]
                                                        ? "text-aurora"
                                                        : "text-orange-400"
                                                )}
                                            />
                                        ) : null}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                    <div className="mt-3 border-t border-border/60 pt-2">
                        <StudioSignOut />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function MiniSpark({ values, className }: { values: number[]; className?: string }) {
    const w = 44
    const h = 16
    const max = Math.max(1, ...values)
    const points = values.map((v, i) => {
        const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w
        const y = h - 1.5 - (v / max) * (h - 3)
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(" ")
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
            />
        </svg>
    )
}
