import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { UserAdminButtons } from "@/components/admin/admin-actions"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>
}) {
    await requireAdmin()
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

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                    <h1 className="text-2xl font-semibold tracking-tight">People</h1>
                    <p className="text-sm text-muted-foreground">Shop owners and Introify admins. Visitors live under Traffic.</p>
                </div>
                <form className="flex gap-2">
                    <input name="q" defaultValue={query} placeholder="Search email" className="h-9 rounded-md border bg-background px-3 text-sm" />
                    <button className="h-9 rounded-md border px-3 text-sm" type="submit">Search</button>
                </form>
            </div>
            <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 font-medium">User</th>
                            <th className="px-3 py-2 font-medium">Role</th>
                            <th className="px-3 py-2 font-medium">Shops</th>
                            <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="border-t">
                                <td className="px-3 py-2">
                                    <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">{user.name || user.email}</Link>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </td>
                                <td className="px-3 py-2 text-xs">{user.role}</td>
                                <td className="px-3 py-2 text-xs">{user.profiles.length}</td>
                                <td className="px-3 py-2">
                                    <UserAdminButtons
                                        userId={user.id}
                                        role={user.role}
                                        suspended={user.profiles.some((p) => Boolean(p.suspendedAt))}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">No users.</p> : null}
            </div>
        </div>
    )
}
