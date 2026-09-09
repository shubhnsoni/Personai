import { prisma } from "@/lib/prisma"
import { AdminEmpty, AdminKpi, AdminKpiStrip, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

function median(values: number[]) {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export default async function AdminTrafficPage() {
    const liveSince = new Date(Date.now() - 2 * 60 * 1000)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [live, liveCount, dayCount, weekCount, recent, dwell, events] = await Promise.all([
        prisma.visitorSession.findMany({
            where: { lastSeenAt: { gte: liveSince }, endedAt: null },
            include: { profile: { select: { slug: true, displayName: true } }, pages: { orderBy: { enteredAt: "desc" }, take: 1 } },
            orderBy: { lastSeenAt: "desc" },
            take: 50,
        }).catch(() => []),
        prisma.visitorSession.count({ where: { lastSeenAt: { gte: liveSince }, endedAt: null } }).catch(() => 0),
        prisma.visitorSession.count({ where: { startedAt: { gte: day } } }).catch(() => 0),
        prisma.visitorSession.count({ where: { startedAt: { gte: week } } }).catch(() => 0),
        prisma.visitorSession.findMany({
            where: { startedAt: { gte: day } },
            include: { profile: { select: { id: true, slug: true, displayName: true } }, pages: { orderBy: { enteredAt: "asc" } } },
            orderBy: { startedAt: "desc" },
            take: 80,
        }).catch(() => []),
        prisma.visitorPageview.findMany({
            where: { enteredAt: { gte: day }, ms: { not: null } },
            select: { ms: true },
            take: 500,
        }).catch(() => []),
        prisma.profileEvent.groupBy({
            by: ["name"],
            where: { createdAt: { gte: day } },
            _count: true,
        }).catch((): Array<{ name: string; _count: number }> => []),
    ])

    const byPath: Record<string, number> = {}
    const byRef: Record<string, number> = {}
    const byCountry: Record<string, number> = {}
    const byUtm: Record<string, number> = {}
    for (const session of recent) {
        const path = session.pages[0]?.path || session.landPath || "/"
        byPath[path] = (byPath[path] || 0) + 1
        const ref = session.referrerHost || session.landRef || "(direct)"
        byRef[ref] = (byRef[ref] || 0) + 1
        const country = session.country || "unknown"
        byCountry[country] = (byCountry[country] || 0) + 1
        const utm = [session.utmSource, session.utmMedium, session.utmCampaign].filter(Boolean).join(" / ") || "(none)"
        byUtm[utm] = (byUtm[utm] || 0) + 1
    }
    const eventMap = Object.fromEntries(events.map((e) => [e.name, e._count]))
    const medianDwell = median(dwell.map((d) => d.ms || 0))

    const funnel = [
        { label: "Land", n: eventMap.visit || dayCount },
        { label: "Shop", n: eventMap.shop_view || 0 },
        { label: "PDP", n: eventMap.pdp_view || 0 },
        { label: "Chat", n: eventMap.chat_open || 0 },
        { label: "WA", n: eventMap.wa_tap || 0 },
    ]
    const funnelMax = Math.max(...funnel.map((step) => step.n), 1)

    return (
        <div className="space-y-5">
            <AdminPageHead title="Traffic" hint={`${liveCount} live · ${dayCount} sessions 24h · ${weekCount} / 7d · median dwell ${Math.round(medianDwell / 1000)}s`} />
            <AdminKpiStrip columns={4}>
                <AdminKpi title="Live" value={liveCount} />
                <AdminKpi title="24h sessions" value={dayCount} />
                <AdminKpi title="7d sessions" value={weekCount} />
                <AdminKpi title="Median dwell" value={`${Math.round(medianDwell / 1000)}s`} />
            </AdminKpiStrip>
            <AdminPanel title="Funnel 24h">
                <div className="grid grid-cols-5 gap-2 px-4 py-3">
                    {funnel.map((step) => (
                        <div key={step.label} className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{step.label}</p>
                            <p className="text-sm font-semibold tabular-nums">{step.n}</p>
                            <div className="mt-2 h-1 rounded-full bg-white/8">
                                <div className="h-1 rounded-full bg-[#00D7FF]" style={{ width: `${Math.round((step.n / funnelMax) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </AdminPanel>
            <AdminPanel title="Live now">
                {live.length === 0 ? <AdminEmpty>Nobody on a public page right now.</AdminEmpty> : live.map((row) => (
                    <AdminRow key={row.id} href={`/admin/visitors/${encodeURIComponent(row.visitorId)}?shop=${row.profileId}`}>
                        <span className="flex-1 truncate font-medium">{row.profile.displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">{row.pages[0]?.path || row.landPath || "/"} · {row.country || row.device || "—"}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Top title="Paths" rows={byPath} />
                <Top title="Referrers" rows={byRef} />
                <Top title="Countries" rows={byCountry} />
                <Top title="UTM" rows={byUtm} />
            </div>
            <AdminPanel title="Recent sessions">
                {recent.length === 0 ? <AdminEmpty>No sessions in the last 24 hours.</AdminEmpty> : recent.slice(0, 20).map((row) => (
                    <AdminRow key={row.id} href={`/admin/visitors/${encodeURIComponent(row.visitorId)}?shop=${row.profileId}`}>
                        <span className="min-w-0 flex-1 truncate">{row.profile.displayName} · {row.pages[0]?.path || row.landPath || "/"}</span>
                        <span className="text-xs text-muted-foreground">{row.utmSource || row.referrerHost || row.country || "direct"}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}

function Top({ title, rows }: { title: string; rows: Record<string, number> }) {
    const list = Object.entries(rows).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return (
        <AdminPanel title={title}>
            {list.length === 0 ? <AdminEmpty>No data yet.</AdminEmpty> : list.map(([key, n]) => (
                <AdminRow key={key}>
                    <span className="min-w-0 flex-1 truncate">{key}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{n}</span>
                </AdminRow>
            ))}
        </AdminPanel>
    )
}
