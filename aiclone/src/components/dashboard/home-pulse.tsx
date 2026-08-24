"use client"

import Link from "next/link"
import { TrendingUp } from "lucide-react"
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts"
import { StudioPulse } from "@/components/dashboard/studio-pulse"
import type { HomeStats } from "@/lib/analytics"

export function HomePulse({ stats, slug }: { stats: HomeStats; slug: string }) {
    const cells: { title: string; value: string | number; subtitle: string; href: string; hot?: boolean }[] = [
        { title: "Visits", value: stats.visits, subtitle: `${stats.visits7} this week`, href: `/${slug}` },
        { title: "Chats", value: stats.chats, subtitle: `${stats.chats30} / 30d`, href: "/dashboard/inbox", hot: stats.unanswered > 0 },
    ]
    if (stats.leads != null) {
        cells.push({
            title: "Leads",
            value: stats.leads,
            subtitle: `${stats.leads7 || 0} this week`,
            href: "/dashboard/leads",
            hot: (stats.leads7 || 0) > 0,
        })
    }
    if (stats.bookings != null) {
        cells.push({
            title: stats.bookingNoun,
            value: stats.bookings,
            subtitle: `${stats.upcoming || 0} upcoming`,
            href: "/dashboard/calendar",
        })
    }
    if (stats.revenueCents != null) {
        cells.push({
            title: "Revenue",
            value: `$${(stats.revenueCents / 100).toFixed(0)}`,
            subtitle: `${stats.sales || 0} sales`,
            href: "/dashboard/money",
        })
    }
    if (stats.menuViews != null && cells.length < 4) {
        cells.push({
            title: "Menu views",
            value: stats.menuViews,
            subtitle: `${stats.reserves || 0} reserve taps`,
            href: "/dashboard/products",
        })
    }

    const hideLeads = stats.leads == null
    const hideSales = stats.revenueCents == null
    const chartData = stats.series

    return (
        <>
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/70 bg-card lg:grid-cols-4">
                {cells.slice(0, 4).map((cell) => (
                    <StatCell key={cell.title} {...cell} />
                ))}
            </div>

            <div className="lg:hidden">
                <StudioPulse
                    data={chartData}
                    funnel={{
                        chats: stats.funnel.chats,
                        leads: stats.funnel.leads,
                        buys: stats.funnel.buys,
                        revenue: stats.revenueCents != null ? `$${(stats.revenueCents / 100).toFixed(0)}` : "$0",
                        chatLead: !hideLeads && stats.chats > 0 ? `${((stats.funnel.leads / stats.chats) * 100).toFixed(0)}% chat→lead` : undefined,
                        leadBuy: !hideSales && stats.funnel.leads > 0 ? `${((stats.funnel.buys / stats.funnel.leads) * 100).toFixed(0)}% lead→buy` : undefined,
                        hideLeads,
                        hideSales,
                        visits: stats.visits,
                    }}
                />
            </div>
            <div className="hidden gap-2 lg:grid lg:grid-cols-5">
                <div className="rounded-2xl border border-border/70 bg-card p-3 md:p-4 lg:col-span-3">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Last 30 days
                    </div>
                    <AnalyticsCharts data={chartData} hideLeads={hideLeads} hideSales={hideSales} />
                    {stats.sources.length > 0 ? (
                        <p className="mt-3 text-[11px] text-muted-foreground">
                            {stats.sources.map((s) => `${s.ref} · ${s.n}`).join("   ")}
                        </p>
                    ) : null}
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-3 md:p-4 lg:col-span-2">
                    <p className="mb-3 text-xs font-medium text-muted-foreground">Funnel</p>
                    <div className="flex flex-col gap-2">
                        <FunnelRow label="Visits" value={stats.funnel.visits} pct={100} />
                        <FunnelRow
                            label="Chats"
                            value={stats.funnel.chats}
                            pct={stats.funnel.visits > 0 ? Math.max(12, (stats.funnel.chats / stats.funnel.visits) * 100) : 12}
                        />
                        {!hideLeads ? (
                            <FunnelRow
                                label="Leads"
                                value={stats.funnel.leads}
                                pct={stats.funnel.chats > 0 ? Math.max(12, (stats.funnel.leads / stats.funnel.chats) * 100) : 12}
                            />
                        ) : null}
                        {!hideSales ? (
                            <FunnelRow
                                label="Buys"
                                value={stats.funnel.buys}
                                pct={stats.funnel.leads > 0 ? Math.max(12, (stats.funnel.buys / stats.funnel.leads) * 100) : 12}
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    )
}

function StatCell({ title, value, subtitle, href, hot = false }: {
    title: string; value: string | number; subtitle: string; href: string; hot?: boolean
}) {
    return (
        <Link
            href={href}
            className={`border-b border-r border-border/60 px-3 py-3 last:border-r-0 even:border-r-0 lg:even:border-r lg:[&:nth-child(4)]:border-r-0 lg:border-b-0 ${hot ? "bg-aurora/5" : ""}`}
        >
            <p className="text-[11px] text-muted-foreground">{title}</p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </Link>
    )
}

function FunnelRow({ label, value, pct }: { label: string; value: string | number; pct: number }) {
    return (
        <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-aurora to-aurora-2"
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
            </div>
        </div>
    )
}
