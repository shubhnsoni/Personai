import Link from "@/components/navigation/transition-link"
import { prisma } from "@/lib/prisma"
import { shopSetupChecks } from "@/lib/admin/setup-score"
import { loadPlatformAiSettings, providerConfigured } from "@/lib/admin/ai-settings"
import { ensureMoneyBackfill, formatAdminMoney, moneyTotals } from "@/lib/admin/money"
import { measureCapacity, recordCapacitySample } from "@/lib/admin/capacity"
import { AdminEmpty, AdminKpi, AdminKpiStrip, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
    await ensureMoneyBackfill()
    const since = new Date(Date.now() - 2 * 60 * 1000)
    const liveWindow = new Date(Date.now() - 15 * 60 * 1000)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [liveNow, waitingCount, waitingLive, ai, lastAi, gmv15, gmv24, lastTxn, capacity, unpaid, pendingShops] = await Promise.all([
        prisma.visitorSession.count({ where: { lastSeenAt: { gte: since }, endedAt: null } }).catch(() => 0),
        prisma.conversation.count({ where: { mode: "LIVE_REQUESTED" } }).catch(() => 0),
        prisma.conversation.findMany({
            where: { mode: "LIVE_REQUESTED" },
            include: { profile: { select: { slug: true, displayName: true, liveChatSlaMinutes: true } } },
            orderBy: { liveRequestedAt: "asc" },
            take: 8,
        }),
        loadPlatformAiSettings(),
        prisma.aiCallLog.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
        moneyTotals(liveWindow),
        moneyTotals(day),
        prisma.moneyEvent.findFirst({
            where: { payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            orderBy: { createdAt: "desc" },
            include: { profile: { select: { displayName: true } } },
        }).catch(() => null),
        measureCapacity(),
        prisma.moneyEvent.count({ where: { payStatus: { in: ["UNPAID", "PENDING"] }, createdAt: { gte: day } } }).catch(() => 0),
        prisma.profile.findMany({
            where: {
                slug: { not: { startsWith: "try-" } },
                OR: [{ isPublic: false }, { digitalProducts: { none: {} } }],
            },
            include: {
                user: { select: { email: true } },
                _count: { select: { digitalProducts: true, conversations: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 12,
        }),
    ])
    await recordCapacitySample(capacity)

    const pending = pendingShops
        .map((shop) => ({ shop, setup: shopSetupChecks(shop) }))
        .filter((row) => row.setup.pending.length > 0)
        .slice(0, 8)

    const late = waitingLive.filter((row) => {
        const waited = row.liveRequestedAt ? Math.round((Date.now() - row.liveRequestedAt.getTime()) / 60000) : 0
        return waited > (row.profile.liveChatSlaMinutes || 10)
    })

    return (
        <div className="space-y-5">
            <AdminPageHead title="Today" hint="Cross-shop pulse. Open a row to act." />
            <AdminKpiStrip columns={4}>
                <AdminKpi
                    title="Live GMV (15m)"
                    value={formatAdminMoney(gmv15.amountCents)}
                    href="/admin/money"
                    subtitle={lastTxn ? `${lastTxn.profile.displayName} · ${formatAdminMoney(lastTxn.amountCents, lastTxn.currency)}` : `${gmv24.count} paid in 24h`}
                />
                <AdminKpi title="Live visitors" value={liveNow} href="/admin/traffic" />
                <AdminKpi
                    title="Load"
                    value={capacity.band.toUpperCase()}
                    href="/admin/capacity"
                    subtitle={`${capacity.liveVisitors} live · DB ${capacity.dbMs}ms`}
                    hot={capacity.band !== "ok"}
                />
                <AdminKpi
                    title="Waiting chats"
                    value={waitingCount}
                    href="/admin/support"
                    subtitle={providerConfigured(ai.defaultProvider) ? `AI ${ai.defaultProvider}` : "AI not configured"}
                    hot={waitingCount > 0}
                />
            </AdminKpiStrip>

            {capacity.band !== "ok" || late.length > 0 || (lastAi && !lastAi.ok) || unpaid > 8 ? (
                <AdminPanel title="Needs you">
                    {capacity.band !== "ok" ? (
                        <AdminRow href="/admin/capacity">
                            <span className="flex-1">Load is {capacity.band}</span>
                            <span className="text-xs text-amber-400">Capacity</span>
                        </AdminRow>
                    ) : null}
                    {late.map((row) => (
                        <AdminRow key={row.id} href="/admin/support">
                            <span className="flex-1 truncate">{row.profile.displayName} waiting past SLA</span>
                            <span className="text-xs text-red-400">{row.visitorName || row.visitorEmail || "Visitor"}</span>
                        </AdminRow>
                    ))}
                    {lastAi && !lastAi.ok ? (
                        <AdminRow href="/admin/ai">
                            <span className="flex-1">Last AI call failed</span>
                            <span className="text-xs text-red-400">{lastAi.provider}</span>
                        </AdminRow>
                    ) : null}
                    {unpaid > 8 ? (
                        <AdminRow href="/admin/money">
                            <span className="flex-1">Unpaid / pending spike</span>
                            <span className="text-xs text-amber-400">{unpaid} in 24h</span>
                        </AdminRow>
                    ) : null}
                </AdminPanel>
            ) : null}

            <AdminPanel title="Pending setup">
                {pending.length === 0 ? (
                    <AdminEmpty>No incomplete live shops.</AdminEmpty>
                ) : pending.map(({ shop, setup }) => (
                    <AdminRow key={shop.id} href={`/admin/shops/${shop.id}`}>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{shop.displayName}</span>
                            <span className="block truncate text-xs text-muted-foreground">{shop.user.email} · {setup.pending.join(", ")}</span>
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">{setup.score}%</span>
                    </AdminRow>
                ))}
            </AdminPanel>

            {waitingLive.length > 0 ? (
                <AdminPanel title="Live chat waiting" action={<Link href="/admin/support" className="text-xs text-muted-foreground hover:text-foreground">Queue</Link>}>
                    {waitingLive.map((row) => (
                        <AdminRow key={row.id} href="/admin/support">
                            <span className="flex-1 truncate">{row.profile.displayName}</span>
                            <span className="text-xs text-muted-foreground">{row.visitorName || row.visitorEmail || "Visitor"}</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
            ) : null}
        </div>
    )
}
