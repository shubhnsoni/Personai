import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"

export const dynamic = "force-dynamic"

export default async function AdminAuditPage() {
    await requireAdmin()
    const rows = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
    })
    const actorIds = [...new Set(rows.map((r) => r.actorUserId))]
    const shopIds = [...new Set(rows.map((r) => r.profileId).filter(Boolean))] as string[]
    const [actors, shops] = await Promise.all([
        actorIds.length
            ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
            : Promise.resolve([] as Array<{ id: string; email: string }>),
        shopIds.length
            ? prisma.profile.findMany({ where: { id: { in: shopIds } }, select: { id: true, displayName: true } })
            : Promise.resolve([] as Array<{ id: string; displayName: string }>),
    ])
    const email = new Map(actors.map((u) => [u.id, u.email] as const))
    const shop = new Map(shops.map((p) => [p.id, p.displayName] as const))

    return (
        <div className="space-y-5">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
                <p className="text-sm text-muted-foreground">Impersonate, publish, suspend, AI switches, role changes.</p>
            </div>
            <div className="divide-y rounded-xl border">
                {rows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                        <div className="min-w-0">
                            <p className="font-medium">{row.action}</p>
                            <p className="text-xs text-muted-foreground">
                                {email.get(row.actorUserId) || row.actorUserId}
                                {row.profileId ? (
                                    <>
                                        {" · "}
                                        <Link href={`/admin/shops/${row.profileId}`} className="hover:underline">{shop.get(row.profileId) || row.profileId}</Link>
                                    </>
                                ) : null}
                                {row.meta ? ` · ${row.meta}` : null}
                            </p>
                        </div>
                        <span className="text-xs text-muted-foreground">{row.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
                    </div>
                ))}
                {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No audit rows yet.</p> : null}
            </div>
        </div>
    )
}
