import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function StudioPanel({
    className,
    children,
}: {
    className?: string
    children: ReactNode
}) {
    return (
        <div className={cn("studio-panel overflow-hidden rounded-2xl", className)}>
            {children}
        </div>
    )
}

export function StudioKpiStrip({
    columns,
    children,
}: {
    columns: number
    children: ReactNode
}) {
    return (
        <div
            className="studio-panel grid divide-x divide-white/8 overflow-hidden rounded-2xl"
            style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` }}
        >
            {children}
        </div>
    )
}

export function StudioKpi({
    title,
    value,
    subtitle,
    href,
    hot,
}: {
    title: string
    value: string | number
    subtitle?: string
    href: string
    hot?: boolean
}) {
    return (
        <Link
            href={href}
            className={cn(
                "min-w-0 px-3 py-2.5 transition-colors hover:bg-white/4",
                hot && "bg-cyan-400/5",
            )}
        >
            <p className="truncate text-[11px] text-muted-foreground">{title}</p>
            <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
            {subtitle ? <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p> : null}
        </Link>
    )
}

export function StudioPageHead({
    kicker,
    title,
    hint,
    action,
}: {
    kicker?: string
    title: string
    hint?: string
    action?: ReactNode
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                {kicker ? (
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">{kicker}</p>
                ) : null}
                <h2 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">{title}</h2>
                {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}

export function StudioRow({
    href,
    children,
    className,
}: {
    href: string
    children: ReactNode
    className?: string
}) {
    return (
        <Link
            href={href}
            className={cn(
                "flex min-h-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]",
                className,
            )}
        >
            {children}
        </Link>
    )
}
