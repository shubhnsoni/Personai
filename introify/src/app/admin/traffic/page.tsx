import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"

export const dynamic = "force-dynamic"

function median(values: number[]) {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export default async function AdminTrafficPage() {
    await requireAdmin()
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

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Traffic</h1>
                <p className="text-sm text-muted-foreground">
                    {liveCount} live · {dayCount} sessions 24h · {weekCount} / 7d · median dwell {Math.round(medianDwell / 1000)}s
                </p>
            </div>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Funnel 24h</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    land {eventMap.visit || dayCount} → shop {eventMap.shop_view || 0} → PDP {eventMap.pdp_view || 0} → chat {eventMap.chat_open || 0} → WA {eventMap.wa_tap || 0} · live {eventMap.live_requested || 0}
                </p>
            </section>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Live now</h2>
                <div className="mt-2 divide-y">
                    {live.map((row) => (
                        <div key={row.id} className="flex justify-between gap-3 py-2 text-sm">
                            <Link href={`/admin/shops/${row.profileId}`} className="font-medium hover:underline">{row.profile.displayName}</Link>
                            <Link
                                href={`/admin/visitors/${encodeURIComponent(row.visitorId)}?shop=${row.profileId}`}
                                className="truncate text-xs text-muted-foreground hover:underline"
                            >
                                {row.pages[0]?.path || row.landPath || "/"} · {row.country || row.device || "—"}
                            </Link>
                        </div>
                    ))}
                    {live.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nobody on a public page right now.</p> : null}
                </div>
            </section>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Top title="Paths" rows={byPath} />
                <Top title="Referrers" rows={byRef} />
                <Top title="Countries" rows={byCountry} />
                <Top title="UTM" rows={byUtm} />
            </div>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Recent sessions</h2>
                <div className="mt-2 divide-y">
                    {recent.slice(0, 20).map((row) => (
                        <Link
                            key={row.id}
                            href={`/admin/visitors/${encodeURIComponent(row.visitorId)}?shop=${row.profileId}`}
                            className="flex justify-between gap-3 py-2 text-sm hover:bg-muted/30"
                        >
                            <span className="truncate">{row.profile.displayName} · {row.pages[0]?.path || row.landPath || "/"}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{row.utmSource || row.referrerHost || row.country || "direct"}</span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    )
}

function Top({ title, rows }: { title: string; rows: Record<string, number> }) {
    const list = Object.entries(rows).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return (
        <section className="rounded-xl border p-4">
            <h2 className="text-sm font-medium">{title}</h2>
            <ul className="mt-2 space-y-1 text-sm">
                {list.map(([key, n]) => (
                    <li key={key} className="flex justify-between gap-2">
                        <span className="truncate">{key}</span>
                        <span className="text-muted-foreground">{n}</span>
                    </li>
                ))}
                {list.length === 0 ? <li className="text-muted-foreground">No data yet.</li> : null}
            </ul>
        </section>
    )
}
