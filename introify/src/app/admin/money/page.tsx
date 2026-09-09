import { prisma } from "@/lib/prisma"
import { ensureMoneyBackfill, formatAdminMoney, moneyTotals, moneyTotalsByCurrency } from "@/lib/admin/money"
import { AdminEmpty, AdminKpi, AdminKpiStrip, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

function ago(at: Date) {
    const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000))
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.round(mins / 60)
    if (hours < 48) return `${hours}h ago`
    return `${Math.round(hours / 24)}d ago`
}

export default async function AdminMoneyPage() {
    await ensureMoneyBackfill()
    const m15 = new Date(Date.now() - 15 * 60 * 1000)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [live, dayTot, weekTot, ar, unpaid, tape, mix, top, fx] = await Promise.all([
        moneyTotals(m15),
        moneyTotals(day),
        moneyTotals(week),
        moneyTotals(week, ["AR"]),
        prisma.moneyEvent.count({ where: { payStatus: { in: ["UNPAID", "PENDING"] }, createdAt: { gte: week } } }).catch(() => 0),
        prisma.moneyEvent.findMany({
            where: { payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            include: { profile: { select: { id: true, displayName: true, slug: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
        }).catch(() => []),
        prisma.moneyEvent.groupBy({
            by: ["payMethod"],
            where: { payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] }, createdAt: { gte: day }, kind: { not: "AR" } },
            _sum: { amountCents: true },
            _count: true,
        }).catch((): Array<{ payMethod: string | null; _sum: { amountCents: number | null }; _count: number }> => []),
        prisma.moneyEvent.groupBy({
            by: ["profileId"],
            where: { payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] }, createdAt: { gte: day }, kind: { not: "AR" } },
            _sum: { amountCents: true },
            _count: true,
            orderBy: { _sum: { amountCents: "desc" } },
            take: 8,
        }).catch((): Array<{ profileId: string; _sum: { amountCents: number | null }; _count: number }> => []),
        moneyTotalsByCurrency(day),
    ])
    const shopIds = top.map((row) => row.profileId)
    const shops = shopIds.length
        ? await prisma.profile.findMany({ where: { id: { in: shopIds } }, select: { id: true, displayName: true } })
        : ([] as Array<{ id: string; displayName: string }>)
    const shopName = new Map(shops.map((s) => [s.id, s.displayName] as const))

    const fxHint = fx.length > 1
        ? fx.map((row) => `${row.currency} ${formatAdminMoney(row.amountCents, row.currency)}`).join(" · ")
        : undefined

    return (
        <div className="space-y-5">
            <AdminPageHead title="Money" hint="Cross-shop consumer GMV. AR is yours, not the jeweller's." />
            <AdminKpiStrip columns={4}>
                <AdminKpi title="Live (15m)" value={formatAdminMoney(live.amountCents)} subtitle={`${live.count} paid`} />
                <AdminKpi title="24h GMV" value={formatAdminMoney(dayTot.amountCents)} subtitle={fxHint || `${dayTot.count} paid`} />
                <AdminKpi title="7d GMV" value={formatAdminMoney(weekTot.amountCents)} subtitle={`${weekTot.count} paid`} />
                <AdminKpi title="AR 7d (you)" value={formatAdminMoney(ar.amountCents)} subtitle={unpaid ? `${unpaid} unpaid/pending` : "platform Stripe"} />
            </AdminKpiStrip>
            <div className="grid gap-4 md:grid-cols-2">
                <AdminPanel title="Pay methods 24h">
                    {mix.length === 0 ? <AdminEmpty>No paid events yet.</AdminEmpty> : mix.map((row) => (
                        <AdminRow key={row.payMethod || "unknown"}>
                            <span className="flex-1">{row.payMethod || "unknown"}</span>
                            <span className="text-xs text-muted-foreground">{formatAdminMoney(row._sum.amountCents || 0)} · {row._count}</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
                <AdminPanel title="Top shops 24h">
                    {top.length === 0 ? <AdminEmpty>No GMV today.</AdminEmpty> : top.map((row) => (
                        <AdminRow key={row.profileId} href={`/admin/shops/${row.profileId}`}>
                            <span className="min-w-0 flex-1 truncate">{shopName.get(row.profileId) || row.profileId}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{formatAdminMoney(row._sum.amountCents || 0)}</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
            </div>
            <AdminPanel title="Live tape">
                {tape.length === 0 ? <AdminEmpty>No paid events recorded yet.</AdminEmpty> : tape.map((row) => (
                    <AdminRow key={row.id} href={`/admin/shops/${row.profileId}`}>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{row.profile.displayName}</span>
                            <span className="block truncate text-xs text-muted-foreground">{row.kind} · {row.payMethod || "—"} · {row.visitorEmail || "visitor"}</span>
                        </span>
                        <span className="shrink-0 text-right">
                            <span className="block tabular-nums">{formatAdminMoney(row.amountCents, row.currency)}</span>
                            <span className="block text-[11px] text-muted-foreground">{ago(row.createdAt)}</span>
                        </span>
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}
