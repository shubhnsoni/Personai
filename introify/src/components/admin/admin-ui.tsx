import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function AdminPageHead({
    title,
    hint,
    action,
}: {
    title: string
    hint?: string
    action?: ReactNode
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">{title}</h2>
                {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}

export function AdminKpiStrip({
    columns,
    children,
}: {
    columns: number
    children: ReactNode
}) {
    return (
        <div
            className="studio-panel grid divide-y divide-white/8 overflow-hidden rounded-2xl sm:divide-x sm:divide-y-0"
            style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` }}
        >
            {children}
        </div>
    )
}

export function AdminKpi({
    title,
    value,
    subtitle,
    href,
    hot,
}: {
    title: string
    value: string | number
    subtitle?: string
    href?: string
    hot?: boolean
}) {
    const inner = (
        <>
            <p className="truncate text-[11px] text-muted-foreground">{title}</p>
            <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
            {subtitle ? <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p> : null}
        </>
    )
    const className = cn("min-w-0 px-3 py-2.5", hot && "bg-cyan-400/5")
    if (!href) return <div className={className}>{inner}</div>
    return (
        <Link href={href} className={cn(className, "transition-colors hover:bg-white/4")}>
            {inner}
        </Link>
    )
}

export function AdminPanel({
    title,
    action,
    className,
    children,
}: {
    title?: string
    action?: ReactNode
    className?: string
    children: ReactNode
}) {
    return (
        <section className={cn("studio-panel overflow-hidden rounded-2xl", className)}>
            {title ? (
                <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                    <h3 className="text-sm font-medium">{title}</h3>
                    {action}
                </div>
            ) : null}
            {children}
        </section>
    )
}

export function AdminEmpty({ children }: { children: ReactNode }) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>
}

export function AdminStatus({
    ok,
    warn,
    label,
}: {
    ok?: boolean
    warn?: boolean
    label: string
}) {
    const tone = warn ? "bg-amber-400" : ok ? "bg-emerald-400" : "bg-muted-foreground/40"
    return (
        <span className="inline-flex items-center gap-2 text-sm">
            <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
            {label}
        </span>
    )
}

export function AdminTable({
    columns,
    children,
}: {
    columns: string[]
    children: ReactNode
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                        {columns.map((column) => (
                            <th key={column} className="px-4 py-2 font-medium">{column}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    )
}

export function AdminRow({
    href,
    children,
    className,
}: {
    href?: string
    children: ReactNode
    className?: string
}) {
    const cls = cn(
        "flex min-h-12 items-center gap-3 px-4 py-3 text-sm transition-colors",
        href && "hover:bg-white/[0.04]",
        className,
    )
    if (href) return <Link href={href} className={cls}>{children}</Link>
    return <div className={cls}>{children}</div>
}
