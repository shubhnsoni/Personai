import Link from "@/components/navigation/transition-link"

export function AdminStat({
    label,
    value,
    href,
    hint,
}: {
    label: string
    value: string
    href?: string
    hint?: string
}) {
    const inner = (
        <>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </>
    )
    const className = "rounded-xl border bg-card p-4"
    if (!href) return <div className={className}>{inner}</div>
    return <Link href={href} className={`${className} hover:bg-muted/30`}>{inner}</Link>
}
