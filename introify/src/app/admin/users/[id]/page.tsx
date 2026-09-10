import Link from "@/components/navigation/transition-link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { ImpersonateButton, UserAdminButtons, UserPlanSelect } from "@/components/admin/admin-actions"
import { effectivePaidPlan } from "@/lib/billing/periods"
import { isPlanId } from "@/lib/billing/catalog"
import { formatAdminMoney } from "@/lib/admin/money"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin()
    const { id } = await params
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            profiles: {
                select: { id: true, slug: true, displayName: true, isPublic: true, suspendedAt: true, roleTemplate: true },
                orderBy: { updatedAt: "desc" },
            },
        },
    })
    if (!user) notFound()
    const account = await prisma.billingAccount.findUnique({
        where: { defaultForUserId: user.id },
        select: { subscription: { select: { planId: true, status: true, paidThrough: true } } },
    })
    const paid = effectivePaidPlan(account?.subscription || null, new Date())
    const planId = paid && isPlanId(account?.subscription?.planId) ? account.subscription.planId : "free"
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const shopIds = user.profiles.map((p) => p.id)
    const gmv = shopIds.length
        ? await prisma.moneyEvent.aggregate({
            where: { profileId: { in: shopIds }, createdAt: { gte: week }, payStatus: { in: ["PAID", "SUCCEEDED", "COMPLETED"] } },
            _sum: { amountCents: true },
            _count: true,
        }).catch(() => ({ _sum: { amountCents: 0 }, _count: 0 }))
        : { _sum: { amountCents: 0 }, _count: 0 }

    return (
        <div className="space-y-5">
            <AdminPageHead
                title={user.name || user.email}
                hint={`${user.email} · ${user.role} · ${planId} · 7d GMV ${formatAdminMoney(gmv._sum.amountCents || 0)}`}
                action={(
                    <UserAdminButtons
                        userId={user.id}
                        role={user.role}
                        suspended={user.profiles.some((p) => Boolean(p.suspendedAt))}
                    />
                )}
            />
            <AdminPanel title="Plan">
                <AdminRow>
                    <div className="min-w-0 flex-1">
                        <span className="block font-medium">Complimentary or assigned plan</span>
                        <span className="block text-xs text-muted-foreground">Does not charge Stripe. Live billing can later replace this assignment.</span>
                    </div>
                    <UserPlanSelect userId={user.id} planId={planId} />
                </AdminRow>
            </AdminPanel>
            <AdminPanel title="Shops">
                {user.profiles.length === 0 ? <AdminEmpty>No shops.</AdminEmpty> : user.profiles.map((shop) => (
                    <AdminRow key={shop.id}>
                        <Link href={`/admin/shops/${shop.id}`} className="min-w-0 flex-1 hover:underline">
                            <span className="block truncate font-medium">{shop.displayName}</span>
                            <span className="block text-xs text-muted-foreground">/{shop.slug} · {shop.suspendedAt ? "Suspended" : shop.isPublic ? "Public" : "Private"}</span>
                        </Link>
                        <ImpersonateButton profileId={shop.id} />
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}
