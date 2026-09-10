import Link from "@/components/navigation/transition-link"
import { prisma } from "@/lib/prisma"
import { UserAdminButtons, UserPlanSelect } from "@/components/admin/admin-actions"
import { assignedPlanId } from "@/lib/admin/plan-grant"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminTable } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>
}) {
    const { q } = await searchParams
    const query = q?.trim() || ""
    const users = await prisma.user.findMany({
        where: query
            ? {
                OR: [
                    { email: { contains: query, mode: "insensitive" } },
                    { name: { contains: query, mode: "insensitive" } },
                ],
            }
            : {},
        include: {
            profiles: { select: { id: true, displayName: true, suspendedAt: true, isPublic: true, updatedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
    })
    const now = new Date()
    const accounts = await prisma.billingAccount.findMany({
        where: { defaultForUserId: { in: users.map((user) => user.id) } },
        select: {
            defaultForUserId: true,
            subscription: { select: { planId: true, status: true, paidThrough: true } },
        },
    })
    const planByUser = new Map(
        accounts.flatMap((account) => account.defaultForUserId
            ? [[account.defaultForUserId, assignedPlanId(account.subscription, now)] as const]
            : []),
    )

    return (
        <div className="space-y-5">
            <AdminPageHead
                title="People"
                hint="Shop owners and Introify admins. Visitors live under Traffic."
                action={(
                    <form className="flex gap-2">
                        <input name="q" defaultValue={query} placeholder="Search email" className="h-8 rounded-full border border-white/10 bg-transparent px-3 text-xs" />
                        <button className="h-8 rounded-full border border-white/10 px-3 text-xs" type="submit">Search</button>
                    </form>
                )}
            />
            <AdminPanel>
                <AdminTable columns={["User", "Role", "Plan", "Shops", "Joined", "Actions"]}>
                    {users.map((user) => (
                        <tr key={user.id} className="border-t border-white/8">
                            <td className="px-4 py-2.5">
                                <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">{user.name || user.email}</Link>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs">{user.role}</td>
                            <td className="px-4 py-2.5">
                                <UserPlanSelect userId={user.id} planId={planByUser.get(user.id) || "free"} />
                            </td>
                            <td className="px-4 py-2.5 text-xs tabular-nums">{user.profiles.length}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{user.createdAt.toISOString().slice(0, 10)}</td>
                            <td className="px-4 py-2.5">
                                <UserAdminButtons
                                    userId={user.id}
                                    role={user.role}
                                    suspended={user.profiles.some((p) => Boolean(p.suspendedAt))}
                                />
                            </td>
                        </tr>
                    ))}
                </AdminTable>
                {users.length === 0 ? <AdminEmpty>No users.</AdminEmpty> : null}
            </AdminPanel>
        </div>
    )
}
