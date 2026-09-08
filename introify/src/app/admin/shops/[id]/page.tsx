import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { shopSetupChecks } from "@/lib/admin/setup-score"
import { ImpersonateButton, ShopAdminButtons, ShopAiOverrideSelect } from "@/components/admin/admin-actions"
import { formatAdminMoney } from "@/lib/admin/money"

export const dynamic = "force-dynamic"

export default async function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin()
    const { id } = await params
    const shop = await prisma.profile.findUnique({
        where: { id },
        include: {
            user: { select: { email: true, name: true } },
            _count: { select: { digitalProducts: true, conversations: true } },
            conversations: { orderBy: { lastMessageAt: "desc" }, take: 6, select: { id: true, visitorName: true, mode: true, lastMessageAt: true } },
        },
    })
    if (!shop) notFound()
    const setup = shopSetupChecks(shop)
    const live = await prisma.visitorSession.count({
        where: { profileId: shop.id, lastSeenAt: { gte: new Date(Date.now() - 2 * 60 * 1000) }, endedAt: null },
    }).catch(() => 0)
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [gmv, tape] = await Promise.all([
        prisma.moneyEvent.aggregate({
            where: { profileId: shop.id, createdAt: { gte: day }, payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            _sum: { amountCents: true },
            _count: true,
        }).catch(() => ({ _sum: { amountCents: 0 }, _count: 0 })),
        prisma.moneyEvent.findMany({
            where: { profileId: shop.id },
            orderBy: { createdAt: "desc" },
            take: 8,
        }).catch(() => []),
    ])

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link href="/admin/shops" className="text-xs text-muted-foreground">Shops</Link>
                    <h1 className="text-2xl font-semibold tracking-tight">{shop.displayName}</h1>
                    <p className="text-sm text-muted-foreground">{shop.user.email} · /{shop.slug} · {shop.roleTemplate}</p>
                </div>
                <ShopAdminButtons profileId={shop.id} isPublic={shop.isPublic} suspended={Boolean(shop.suspendedAt)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-xl border p-4">
                    <h2 className="text-sm font-medium">Setup {setup.score}%</h2>
                    <ul className="mt-3 space-y-1.5 text-sm">
                        {setup.checks.map((check) => (
                            <li key={check.id} className={check.ok ? "text-foreground" : "text-muted-foreground"}>
                                {check.ok ? "●" : "○"} {check.label}
                            </li>
                        ))}
                    </ul>
                </section>
                <section className="space-y-3 rounded-xl border p-4">
                    <h2 className="text-sm font-medium">AI</h2>
                    <p className="text-xs text-muted-foreground">Model on the shop: {shop.aiModel}. Provider override is yours.</p>
                    <ShopAiOverrideSelect profileId={shop.id} value={shop.aiProviderOverride} />
                    <p className="text-xs text-muted-foreground">{live} visitor{live === 1 ? "" : "s"} live now · 24h GMV {formatAdminMoney(gmv._sum.amountCents || 0)}</p>
                    <div className="flex gap-2">
                        <Link href={`/${shop.slug}`} className="text-xs underline" target="_blank">Open public page</Link>
                        <ImpersonateButton profileId={shop.id} href="/dashboard/inbox" label="Inbox" />
                    </div>
                </section>
            </div>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Money tape</h2>
                <div className="mt-2 divide-y">
                    {tape.map((row) => (
                        <div key={row.id} className="flex justify-between py-2 text-sm">
                            <span>{row.kind} · {row.payMethod || "—"}</span>
                            <span className="text-xs text-muted-foreground">{formatAdminMoney(row.amountCents, row.currency)}</span>
                        </div>
                    ))}
                    {tape.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No money events.</p> : null}
                </div>
            </section>
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Recent chats</h2>
                <div className="mt-2 divide-y">
                    {shop.conversations.map((row) => (
                        <div key={row.id} className="flex justify-between py-2 text-sm">
                            <span>{row.visitorName || "Visitor"}</span>
                            <span className="text-xs text-muted-foreground">{row.mode}</span>
                        </div>
                    ))}
                    {shop.conversations.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No chats yet.</p> : null}
                </div>
            </section>
        </div>
    )
}
