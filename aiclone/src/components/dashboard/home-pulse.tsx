"use client"

import { AnalyticsCharts } from "@/components/dashboard/analytics-charts"
import { StudioPulse } from "@/components/dashboard/studio-pulse"
import { StudioKpi, StudioPanel } from "@/components/dashboard/studio-ui"
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
    const shown = cells.slice(0, 4)

    return (
        <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
                {shown.map((cell) => (
                    <StudioKpi key={cell.title} {...cell} />
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

            <div className="hidden gap-3 lg:grid lg:grid-cols-12">
                <StudioPanel className="p-5 lg:col-span-8">
                    <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Last 30 days</p>
                    <AnalyticsCharts data={chartData} hideLeads={hideLeads} hideSales={hideSales} />
                    {stats.sources.length > 0 ? (
                        <p className="mt-4 text-[11px] text-muted-foreground">
                            {stats.sources.map((s) => `${s.ref} · ${s.n}`).join("   ")}
                        </p>
                    ) : null}
                </StudioPanel>
                <StudioPanel className="p-5 lg:col-span-4">
                    <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Funnel</p>
                    <div className="flex flex-col gap-3">
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
                </StudioPanel>
            </div>
        </>
    )
}

function FunnelRow({ label, value, pct }: { label: string; value: string | number; pct: number }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                    className="h-full rounded-full bg-[#00D7FF]"
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
            </div>
        </div>
    )
}
