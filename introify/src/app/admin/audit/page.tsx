import { prisma } from "@/lib/prisma"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

const ACTION_LABEL: Record<string, string> = {
    impersonate_start: "Impersonated a shop",
    impersonate_stop: "Stopped impersonation",
    publish: "Published a shop",
    unpublish: "Unpublished a shop",
    suspend: "Suspended a shop",
    unsuspend: "Unsuspended a shop",
    suspend_user: "Suspended a user",
    unsuspend_user: "Unsuspended a user",
    promote_admin: "Made admin",
    demote_admin: "Demoted admin",
    ai_settings: "Changed AI settings",
    shop_ai_override: "Set shop AI override",
}

export default async function AdminAuditPage({
    searchParams,
}: {
    searchParams: Promise<{ action?: string }>
}) {
    const { action } = await searchParams
    const rows = await prisma.auditEvent.findMany({
        where: action ? { action } : {},
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
    const actions = [...new Set(rows.map((row) => row.action))]

    return (
        <div className="space-y-5">
            <AdminPageHead title="Audit" hint="Impersonate, publish, suspend, AI switches, role changes." />
            {actions.length > 1 ? (
                <div className="flex flex-wrap gap-2 text-xs">
                    <a href="/admin/audit" className={!action ? "rounded-full bg-cyan-400/10 px-2.5 py-1 font-medium" : "rounded-full px-2.5 py-1 text-muted-foreground"}>All</a>
                    {actions.map((name) => (
                        <a
                            key={name}
                            href={`/admin/audit?action=${encodeURIComponent(name)}`}
                            className={action === name ? "rounded-full bg-cyan-400/10 px-2.5 py-1 font-medium" : "rounded-full px-2.5 py-1 text-muted-foreground"}
                        >
                            {ACTION_LABEL[name] || name}
                        </a>
                    ))}
                </div>
            ) : null}
            <AdminPanel>
                {rows.length === 0 ? <AdminEmpty>No audit rows yet.</AdminEmpty> : rows.map((row) => (
                    <AdminRow key={row.id} href={row.profileId ? `/admin/shops/${row.profileId}` : undefined}>
                        <span className="min-w-0 flex-1">
                            <span className="block font-medium">{ACTION_LABEL[row.action] || row.action}</span>
                            <span className="block text-xs text-muted-foreground">
                                {email.get(row.actorUserId) || row.actorUserId}
                                {row.profileId ? ` · ${shop.get(row.profileId) || row.profileId}` : ""}
                            </span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">{row.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
        </div>
    )
}
