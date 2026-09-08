import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { ensureMoneyBackfill, formatAdminMoney, moneyTotals } from "@/lib/admin/money"
import { AdminStat } from "@/components/admin/admin-stat"

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
    await requireAdmin()
    await ensureMoneyBackfill()
    const m15 = new Date(Date.now() - 15 * 60 * 1000)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [live, dayTot, weekTot, ar, unpaid, tape, mix, top] = await Promise.all([
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
    ])
    const shopIds = top.map((row) => row.profileId)
    const shops = shopIds.length
        ? await prisma.profile.findMany({ where: { id: { in: shopIds } }, select: { id: true, displayName: true } })
        : ([] as Array<{ id: string; displayName: string }>)
    const shopName = new Map(shops.map((s) => [s.id, s.displayName] as const))

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Money</h1>
                <p className="text-sm text-muted-foreground">Cross-shop consumer GMV. AR is yours, not the jeweller&apos;s.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStat label="Live (15m)" value={formatAdminMoney(live.amountCents)} hint={`${live.count} paid`} />
                <AdminStat label="24h GMV" value={formatAdminMoney(dayTot.amountCents)} hint={`${dayTot.count} paid`} />
                <AdminStat label="7d GMV" value={formatAdminMoney(weekTot.amountCents)} hint={`${weekTot.count} paid`} />
                <AdminStat label="AR revenue 7d (you)" value={formatAdminMoney(ar.amountCents)} hint={unpaid ? `${unpaid} unpaid/pending` : "shop Stripe still hits the platform account"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-xl border p-4">
                    <h2 className="text-sm font-medium">Pay methods 24h</h2>
                    <ul className="mt-2 space-y-1 text-sm">
                        {mix.map((row) => (
                            <li key={row.payMethod || "unknown"} className="flex justify-between">
                                <span>{row.payMethod || "unknown"}</span>
                                <span className="text-muted-foreground">{formatAdminMoney(row._sum.amountCents || 0)} · {row._count}</span>
                            </li>
                        ))}
                        {mix.length === 0 ? <li className="text-muted-foreground">No paid events yet.</li> : null}
                    </ul>
                </section>
                <section className="rounded-xl border p-4">
                    <h2 className="text-sm font-medium">Top shops 24h</h2>
                    <ul className="mt-2 space-y-1 text-sm">
                        {top.map((row) => (
                            <li key={row.profileId} className="flex justify-between gap-2">
                                <Link href={`/admin/shops/${row.profileId}`} className="truncate hover:underline">{shopName.get(row.profileId) || row.profileId}</Link>
                                <span className="shrink-0 text-muted-foreground">{formatAdminMoney(row._sum.amountCents || 0)}</span>
                            </li>
                        ))}
                        {top.length === 0 ? <li className="text-muted-foreground">No GMV today.</li> : null}
                    </ul>
                </section>
            </div>
            <section className="rounded-xl border">
                <div className="border-b px-4 py-3">
                    <h2 className="text-sm font-medium">Live tape</h2>
                </div>
                <div className="divide-y">
                    {tape.map((row) => (
                        <Link key={row.id} href={`/admin/shops/${row.profileId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40">
                            <span className="min-w-0">
                                <span className="block truncate font-medium">{row.profile.displayName}</span>
                                <span className="block truncate text-xs text-muted-foreground">{row.kind} · {row.payMethod || "—"} · {row.visitorEmail || "visitor"}</span>
                            </span>
                            <span className="shrink-0 text-right">
                                <span className="block">{formatAdminMoney(row.amountCents, row.currency)}</span>
                                <span className="block text-[11px] text-muted-foreground">{ago(row.createdAt)}</span>
                            </span>
                        </Link>
                    ))}
                    {tape.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No paid events recorded yet.</p> : null}
                </div>
            </section>
        </div>
    )
}
