import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { shopSetupChecks } from "@/lib/admin/setup-score"
import { loadPlatformAiSettings, providerConfigured } from "@/lib/admin/ai-settings"
import { ensureMoneyBackfill, formatAdminMoney, moneyTotals } from "@/lib/admin/money"
import { measureCapacity, recordCapacitySample } from "@/lib/admin/capacity"
import { AdminStat } from "@/components/admin/admin-stat"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
    await requireAdmin()
    await ensureMoneyBackfill()
    const since = new Date(Date.now() - 2 * 60 * 1000)
    const liveWindow = new Date(Date.now() - 15 * 60 * 1000)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [liveNow, shopCount, waitingCount, waitingLive, ai, lastAi, gmv15, gmv24, lastTxn, capacity, shops] = await Promise.all([
        prisma.visitorSession.count({ where: { lastSeenAt: { gte: since }, endedAt: null } }).catch(() => 0),
        prisma.profile.count({ where: { slug: { not: { startsWith: "try-" } } } }),
        prisma.conversation.count({ where: { mode: "LIVE_REQUESTED" } }).catch(() => 0),
        prisma.conversation.findMany({
            where: { mode: "LIVE_REQUESTED" },
            include: { profile: { select: { slug: true, displayName: true } } },
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
        prisma.profile.findMany({
            where: { slug: { not: { startsWith: "try-" } } },
            include: {
                user: { select: { email: true } },
                _count: { select: { digitalProducts: true, conversations: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 40,
        }),
    ])
    await recordCapacitySample(capacity)

    const pending = shops
        .map((shop) => ({ shop, setup: shopSetupChecks(shop) }))
        .filter((row) => row.setup.pending.length > 0 || (row.shop.isPublic && (row.shop._count.digitalProducts === 0)))
        .slice(0, 8)

    return (
        <div className="space-y-8">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStat
                    label="Live GMV (15m)"
                    value={formatAdminMoney(gmv15.amountCents)}
                    href="/admin/money"
                    hint={lastTxn ? `${lastTxn.profile.displayName} · ${formatAdminMoney(lastTxn.amountCents, lastTxn.currency)}` : `${gmv24.count} paid in 24h`}
                />
                <AdminStat label="Live visitors" value={String(liveNow)} href="/admin/traffic" />
                <AdminStat
                    label="Load"
                    value={capacity.band.toUpperCase()}
                    href="/admin/capacity"
                    hint={`${capacity.liveVisitors} live · DB ${capacity.dbMs}ms`}
                />
                <AdminStat
                    label="AI default"
                    value={ai.defaultProvider}
                    href="/admin/ai"
                    hint={lastAi ? (lastAi.ok ? `${lastAi.provider} ok` : `${lastAi.provider} failed`) : providerConfigured(ai.defaultProvider) ? "configured" : "not configured"}
                />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AdminStat label="Shops" value={String(shopCount)} href="/admin/shops" />
                <AdminStat label="Waiting live chat" value={String(waitingCount)} href="/admin/support" />
                <AdminStat label="GMV 24h" value={formatAdminMoney(gmv24.amountCents)} href="/admin/money" hint={`${gmv24.count} paid`} />
            </div>

            {capacity.band !== "ok" ? (
                <section className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
                    Load is <span className="font-medium">{capacity.band}</span>. Open{" "}
                    <Link href="/admin/capacity" className="underline">Capacity</Link> for the suggested server config.
                </section>
            ) : null}

            <section className="space-y-3">
                <h2 className="text-sm font-medium">Pending setup</h2>
                {pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No incomplete live shops.</p>
                ) : (
                    <div className="divide-y rounded-xl border">
                        {pending.map(({ shop, setup }) => (
                            <Link key={shop.id} href={`/admin/shops/${shop.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/40">
                                <span className="min-w-0">
                                    <span className="block truncate font-medium">{shop.displayName}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{shop.user.email} · {setup.pending.join(", ")}</span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">{setup.score}%</span>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {waitingLive.length > 0 ? (
                <section className="space-y-3">
                    <h2 className="text-sm font-medium">Live chat waiting</h2>
                    <div className="divide-y rounded-xl border">
                        {waitingLive.map((row) => (
                            <Link key={row.id} href="/admin/support" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40">
                                <span>{row.profile.displayName}</span>
                                <span className="text-xs text-muted-foreground">{row.visitorName || row.visitorEmail || "Visitor"}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    )
}
