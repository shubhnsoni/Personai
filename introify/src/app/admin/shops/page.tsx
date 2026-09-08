import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { shopSetupChecks } from "@/lib/admin/setup-score"
import { formatAdminMoney, shopPipeline } from "@/lib/admin/money"

export const dynamic = "force-dynamic"

const FILTERS = [
    { id: "", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "selling", label: "Selling" },
    { id: "silent", label: "Silent" },
    { id: "dormant", label: "Dormant" },
]

export default async function AdminShopsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; filter?: string; qa?: string }>
}) {
    await requireAdmin()
    const { q, filter, qa } = await searchParams
    const showQa = qa === "1"
    const query = q?.trim() || ""
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const fortnight = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const shops = await prisma.profile.findMany({
        where: {
            ...(showQa ? {} : { slug: { not: { startsWith: "try-" } } }),
            ...(query
                ? {
                    OR: [
                        { slug: { contains: query, mode: "insensitive" } },
                        { displayName: { contains: query, mode: "insensitive" } },
                        { user: { email: { contains: query, mode: "insensitive" } } },
                    ],
                }
                : {}),
        },
        include: {
            user: { select: { email: true } },
            _count: { select: { digitalProducts: true, conversations: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 80,
    })
    const ids = shops.map((s) => s.id)
    type SumRow = { profileId: string; _sum: { amountCents: number | null } }
    type CountRow = { profileId: string; _count: number }
    const emptySum: SumRow[] = []
    const emptyCount: CountRow[] = []
    const [gmv24, gmv7, gmv14, sessions7, total] = await Promise.all([
        ids.length ? prisma.moneyEvent.groupBy({
            by: ["profileId"],
            where: { profileId: { in: ids }, createdAt: { gte: day }, payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            _sum: { amountCents: true },
        }).catch((): SumRow[] => emptySum) : emptySum,
        ids.length ? prisma.moneyEvent.groupBy({
            by: ["profileId"],
            where: { profileId: { in: ids }, createdAt: { gte: week }, payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            _count: true,
        }).catch((): CountRow[] => emptyCount) : emptyCount,
        ids.length ? prisma.moneyEvent.groupBy({
            by: ["profileId"],
            where: { profileId: { in: ids }, createdAt: { gte: fortnight }, payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            _count: true,
        }).catch((): CountRow[] => emptyCount) : emptyCount,
        ids.length ? prisma.visitorSession.groupBy({
            by: ["profileId"],
            where: { profileId: { in: ids }, startedAt: { gte: week } },
            _count: true,
        }).catch((): CountRow[] => emptyCount) : emptyCount,
        prisma.profile.count({ where: showQa ? {} : { slug: { not: { startsWith: "try-" } } } }),
    ])
    const gmvMap = new Map(gmv24.map((r) => [r.profileId, r._sum.amountCents || 0] as const))
    const paid7 = new Map(gmv7.map((r) => [r.profileId, r._count] as const))
    const paid14 = new Map(gmv14.map((r) => [r.profileId, r._count] as const))
    const sess7 = new Map(sessions7.map((r) => [r.profileId, r._count] as const))

    const rows = shops
        .map((shop) => {
            const setup = shopSetupChecks(shop)
            const pipeline = shopPipeline({
                isPublic: shop.isPublic,
                suspendedAt: shop.suspendedAt,
                setupPending: setup.pending.length,
                sessions7d: sess7.get(shop.id) || 0,
                chats: shop._count.conversations,
                paid7d: paid7.get(shop.id) || 0,
                paid14d: paid14.get(shop.id) || 0,
            })
            return { shop, setup, pipeline, gmv: gmvMap.get(shop.id) || 0 }
        })
        .filter((row) => {
            if (!filter) return true
            if (filter === "pending") return row.setup.pending.length > 0
            return row.pipeline === filter
        })

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                    <h1 className="text-2xl font-semibold tracking-tight">Shops</h1>
                    <p className="text-sm text-muted-foreground">{total} total</p>
                </div>
                <form className="flex gap-2">
                    <input name="q" defaultValue={query} placeholder="Search email or slug" className="h-9 rounded-md border bg-background px-3 text-sm" />
                    <button className="h-9 rounded-md border px-3 text-sm" type="submit">Search</button>
                </form>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
                {FILTERS.map((item) => (
                    <Link
                        key={item.id || "all"}
                        href={item.id ? `/admin/shops?filter=${item.id}` : "/admin/shops"}
                        className={filter === item.id || (!filter && !item.id) ? "font-medium" : "text-muted-foreground"}
                    >
                        {item.label}
                    </Link>
                ))}
                <Link href={showQa ? "/admin/shops" : "/admin/shops?qa=1"} className={showQa ? "font-medium" : "text-muted-foreground"}>
                    {showQa ? "Hide try-kits" : "Show try-kits"}
                </Link>
            </div>
            <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 font-medium">Shop</th>
                            <th className="px-3 py-2 font-medium">Owner</th>
                            <th className="px-3 py-2 font-medium">Setup</th>
                            <th className="px-3 py-2 font-medium">24h GMV</th>
                            <th className="px-3 py-2 font-medium">Pipeline</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ shop, setup, pipeline, gmv }) => (
                            <tr key={shop.id} className="border-t">
                                <td className="px-3 py-2">
                                    <Link href={`/admin/shops/${shop.id}`} className="font-medium hover:underline">{shop.displayName}</Link>
                                    <p className="text-xs text-muted-foreground">/{shop.slug}</p>
                                </td>
                                <td className="px-3 py-2 text-xs">{shop.user.email}</td>
                                <td className="px-3 py-2 text-xs">{setup.score}%</td>
                                <td className="px-3 py-2 text-xs">{gmv ? formatAdminMoney(gmv) : "—"}</td>
                                <td className="px-3 py-2 text-xs">{shop.suspendedAt ? "suspended" : pipeline}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">No shops.</p> : null}
            </div>
        </div>
    )
}
