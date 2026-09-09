import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { shopSetupChecks } from "@/lib/admin/setup-score"
import { formatAdminMoney, shopPipeline } from "@/lib/admin/money"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminTable } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 40

const FILTERS = [
    { id: "", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "selling", label: "Selling" },
    { id: "silent", label: "Silent" },
    { id: "dormant", label: "Dormant" },
    { id: "setup", label: "Setup" },
    { id: "suspended", label: "Suspended" },
]

function shopsHref(input: { q?: string; filter?: string; page?: number }) {
    const params = new URLSearchParams()
    if (input.q) params.set("q", input.q)
    if (input.filter) params.set("filter", input.filter)
    if (input.page && input.page > 1) params.set("page", String(input.page))
    const qs = params.toString()
    return qs ? `/admin/shops?${qs}` : "/admin/shops"
}

export default async function AdminShopsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}) {
    const { q, filter, page: pageRaw } = await searchParams
    const query = q?.trim() || ""
    const page = Math.max(1, Number(pageRaw) || 1)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const fortnight = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const where = {
        slug: { not: { startsWith: "try-" } },
        ...(query
            ? {
                OR: [
                    { slug: { contains: query, mode: "insensitive" as const } },
                    { displayName: { contains: query, mode: "insensitive" as const } },
                    { user: { email: { contains: query, mode: "insensitive" as const } } },
                ],
            }
            : {}),
    }
    const shops = await prisma.profile.findMany({
        where,
        include: {
            user: { select: { email: true } },
            _count: { select: { digitalProducts: true, conversations: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
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
        prisma.profile.count({ where }),
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
            <AdminPageHead
                title="Shops"
                hint={`${total} tenants`}
                action={(
                    <form className="flex gap-2">
                        {filter ? <input type="hidden" name="filter" value={filter} /> : null}
                        <input name="q" defaultValue={query} placeholder="Search email or slug" className="h-8 rounded-full border border-white/10 bg-transparent px-3 text-xs" />
                        <button className="h-8 rounded-full border border-white/10 px-3 text-xs" type="submit">Search</button>
                    </form>
                )}
            />
            <div className="flex flex-wrap gap-2 text-xs">
                {FILTERS.map((item) => (
                    <Link
                        key={item.id || "all"}
                        href={shopsHref({ q: query, filter: item.id || undefined })}
                        className={filter === item.id || (!filter && !item.id)
                            ? "rounded-full bg-cyan-400/10 px-2.5 py-1 font-medium text-foreground"
                            : "rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground"}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
            <AdminPanel>
                <AdminTable columns={["Shop", "Owner", "Setup", "24h GMV", "Pipeline"]}>
                    {rows.map(({ shop, setup, pipeline, gmv }) => (
                        <tr key={shop.id} className="border-t border-white/8">
                            <td className="px-4 py-2.5">
                                <Link href={`/admin/shops/${shop.id}`} className="font-medium hover:underline">{shop.displayName}</Link>
                                <p className="text-xs text-muted-foreground">/{shop.slug}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs">{shop.user.email}</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{setup.score}%</td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{gmv ? formatAdminMoney(gmv) : "—"}</td>
                            <td className="px-4 py-2.5 text-xs">{shop.suspendedAt ? "suspended" : pipeline}</td>
                        </tr>
                    ))}
                </AdminTable>
                {rows.length === 0 ? <AdminEmpty>No shops.</AdminEmpty> : null}
            </AdminPanel>
            {total > PAGE_SIZE ? (
                <div className="flex justify-end gap-2 text-xs">
                    {page > 1 ? <Link href={shopsHref({ q: query, filter, page: page - 1 })} className="text-muted-foreground hover:text-foreground">Previous</Link> : null}
                    {page * PAGE_SIZE < total ? <Link href={shopsHref({ q: query, filter, page: page + 1 })} className="text-muted-foreground hover:text-foreground">Next</Link> : null}
                </div>
            ) : null}
        </div>
    )
}
