"use client"

import { useMemo, useState } from "react"

type Point = { date: string; visits?: number; conversations: number; leads: number; revenue: number }
type Metric = "visits" | "conversations" | "leads" | "revenue"

export function StudioPulse({
    data,
    funnel,
}: {
    data: Point[]
    funnel: { chats: number; leads: number; buys: number; revenue: string; chatLead?: string; leadBuy?: string; hideLeads?: boolean; hideSales?: boolean; visits?: number }
}) {
    const [metric, setMetric] = useState<Metric>("visits")
    const [period, setPeriod] = useState<7 | 14 | 30>(7)
    const slice = data.slice(-period)
    const values = slice.map((d) => d[metric] || 0)
    const max = Math.max(...values, 1)
    const total = values.reduce((a, b) => a + b, 0)

    const path = useMemo(() => {
        if (slice.length === 0) return ""
        const w = 280
        const h = 72
        return slice
            .map((d, i) => {
                const x = (i / Math.max(slice.length - 1, 1)) * w
                const y = h - (d[metric] / max) * (h - 8) - 4
                return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
            })
            .join(" ")
    }, [slice, metric, max])

    const fill = useMemo(() => {
        if (!path) return ""
        return `${path} L 280 72 L 0 72 Z`
    }, [path])

    const stages = [
        ...(funnel.visits != null ? [{ label: "Visit", value: funnel.visits, w: 100 }] : []),
        { label: "Chat", value: funnel.chats, w: funnel.visits ? Math.max(18, (funnel.chats / Math.max(funnel.visits, 1)) * 100) : 100 },
        ...(!funnel.hideLeads ? [{ label: "Lead", value: funnel.leads, w: funnel.chats > 0 ? Math.max(22, (funnel.leads / funnel.chats) * 100) : 22 }] : []),
        ...(!funnel.hideSales ? [
            { label: "Buy", value: funnel.buys, w: funnel.leads > 0 ? Math.max(16, (funnel.buys / funnel.leads) * 100) : 16 },
            { label: "Rev", value: funnel.revenue, w: 28 },
        ] : []),
    ]
    const metrics = (
        [
            ["visits", "Visits"],
            ["conversations", "Chats"],
            ...(!funnel.hideLeads ? [["leads", "Leads"] as const] : []),
            ...(!funnel.hideSales ? [["revenue", "Rev"] as const] : []),
        ] as const
    )

    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="flex flex-col gap-2 px-3 pt-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] text-muted-foreground">
                            Last {period} days
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                            {metric === "revenue" ? `${total.toFixed(0)}` : total}
                        </p>
                    </div>
                    <div className="flex gap-0.5 rounded-full bg-muted/70 p-0.5">
                        {([7, 14, 30] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                    period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                                }`}
                            >
                                {p}d
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-0.5 rounded-full bg-muted/70 p-0.5">
                    {metrics.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setMetric(key)}
                            className={`flex-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                metric === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <svg viewBox="0 0 280 72" className="mt-1 h-20 w-full px-1" preserveAspectRatio="none">
                <path d={fill} fill="url(#pulseFill)" opacity="0.35" />
                <path d={path} fill="none" stroke="var(--pl-aurora, #52E8FF)" strokeWidth="2.2" strokeLinecap="round" />
                <defs>
                    <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#52E8FF" />
                        <stop offset="100%" stopColor="#52E8FF" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="space-y-1.5 border-t border-border/60 px-3 py-3">
                {stages.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                        <span className="w-9 shrink-0 text-[10px] text-muted-foreground">{s.label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                                style={{ width: `${Math.min(100, s.w)}%` }}
                            />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[11px] font-medium tabular-nums">{s.value}</span>
                    </div>
                ))}
                {(funnel.chatLead || funnel.leadBuy) && (
                    <p className="pt-1 text-[10px] text-muted-foreground">
                        {[funnel.chatLead, funnel.leadBuy].filter(Boolean).join(" · ")}
                    </p>
                )}
            </div>
        </div>
    )
}
