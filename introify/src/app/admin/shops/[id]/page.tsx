import Link from "@/components/navigation/transition-link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { shopSetupChecks } from "@/lib/admin/setup-score"
import { ImpersonateButton, ShopAdminButtons, ShopAiOverrideSelect } from "@/components/admin/admin-actions"
import { formatAdminMoney } from "@/lib/admin/money"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminRow, AdminStatus } from "@/components/admin/admin-ui"

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
        <div className="space-y-5">
            <AdminPageHead
                title={shop.displayName}
                hint={`${shop.user.email} · /${shop.slug} · ${shop.roleTemplate}`}
                action={<ShopAdminButtons profileId={shop.id} isPublic={shop.isPublic} suspended={Boolean(shop.suspendedAt)} />}
            />
            <div className="grid gap-4 md:grid-cols-2">
                <AdminPanel title={`Setup ${setup.score}%`}>
                    {setup.checks.map((check) => (
                        <AdminRow key={check.id}>
                            <AdminStatus ok={check.ok} label={check.label} />
                        </AdminRow>
                    ))}
                </AdminPanel>
                <AdminPanel title="AI">
                    <div className="space-y-3 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Stored AI mode: {shop.aiModel}. This legacy override does not control published replies; commercial mappings are shown in Admin AI.</p>
                        <ShopAiOverrideSelect profileId={shop.id} value={shop.aiProviderOverride} />
                        <p className="text-xs text-muted-foreground">{live} visitor{live === 1 ? "" : "s"} live now · 24h GMV {formatAdminMoney(gmv._sum.amountCents || 0)}</p>
                        <div className="flex gap-2">
                            <Link href={`/${shop.slug}`} className="text-xs underline" target="_blank">Open public page</Link>
                            <ImpersonateButton profileId={shop.id} href="/dashboard/inbox" label="Inbox" />
                        </div>
                    </div>
                </AdminPanel>
            </div>
            <AdminPanel title="Money tape">
                {tape.length === 0 ? <AdminEmpty>No money events.</AdminEmpty> : tape.map((row) => (
                    <AdminRow key={row.id}>
                        <span className="flex-1">{row.kind} · {row.payMethod || "—"}</span>
                        <span className="text-xs text-muted-foreground">{formatAdminMoney(row.amountCents, row.currency)}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
            <AdminPanel title="Recent chats">
                {shop.conversations.length === 0 ? <AdminEmpty>No chats yet.</AdminEmpty> : shop.conversations.map((row) => (
                    <AdminRow key={row.id}>
                        <span className="flex-1">{row.visitorName || "Visitor"}</span>
                        <span className="text-xs text-muted-foreground">{row.mode}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}
