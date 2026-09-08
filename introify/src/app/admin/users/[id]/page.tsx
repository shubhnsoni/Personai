import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { ImpersonateButton, UserAdminButtons } from "@/components/admin/admin-actions"
import { formatAdminMoney } from "@/lib/admin/money"

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
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link href="/admin/users" className="text-xs text-muted-foreground">People</Link>
                    <h1 className="text-2xl font-semibold tracking-tight">{user.name || user.email}</h1>
                    <p className="text-sm text-muted-foreground">{user.email} · {user.role} · 7d GMV {formatAdminMoney(gmv._sum.amountCents || 0)}</p>
                </div>
                <UserAdminButtons
                    userId={user.id}
                    role={user.role}
                    suspended={user.profiles.some((p) => Boolean(p.suspendedAt))}
                />
            </div>
            <section className="rounded-xl border">
                <div className="border-b px-4 py-3 text-sm font-medium">Shops</div>
                <div className="divide-y">
                    {user.profiles.map((shop) => (
                        <div key={shop.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <Link href={`/admin/shops/${shop.id}`} className="min-w-0 hover:underline">
                                <span className="block truncate font-medium">{shop.displayName}</span>
                                <span className="block text-xs text-muted-foreground">/{shop.slug} · {shop.suspendedAt ? "Suspended" : shop.isPublic ? "Public" : "Private"}</span>
                            </Link>
                            <ImpersonateButton profileId={shop.id} />
                        </div>
                    ))}
                    {user.profiles.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">No shops.</p> : null}
                </div>
            </section>
        </div>
    )
}
