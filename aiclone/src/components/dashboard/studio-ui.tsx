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
                "studio-panel rounded-2xl px-4 py-4 transition-colors hover:border-cyan-400/25",
                hot && "border-cyan-400/30 bg-cyan-400/5",
            )}
        >
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums lg:text-[2rem]">{value}</p>
            {subtitle ? <p className="mt-2 text-[11px] text-muted-foreground">{subtitle}</p> : null}
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
