import { prisma } from "@/lib/prisma"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminRow } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminVisitorPage({
    params,
    searchParams,
}: {
    params: Promise<{ vid: string }>
    searchParams: Promise<{ shop?: string }>
}) {
    const { vid } = await params
    const { shop } = await searchParams
    const visitorId = decodeURIComponent(vid)
    const sessions = await prisma.visitorSession.findMany({
        where: {
            visitorId,
            ...(shop ? { profileId: shop } : {}),
        },
        include: {
            profile: { select: { id: true, slug: true, displayName: true } },
            pages: { orderBy: { enteredAt: "asc" } },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
    }).catch(() => [])
    const events = await prisma.profileEvent.findMany({
        where: {
            visitor: visitorId,
            ...(shop ? { profileId: shop } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: 80,
    }).catch(() => [])
    const shopName = sessions[0]?.profile.displayName

    return (
        <div className="space-y-5">
            <AdminPageHead title="Visitor" hint={`${visitorId.slice(0, 12)}…${shopName ? ` · ${shopName}` : ""}`} />
            {sessions.map((session) => (
                <AdminPanel
                    key={session.id}
                    title={session.profile.displayName}
                    action={<span className="text-[11px] text-muted-foreground">{session.device || "—"} · {session.country || "—"}</span>}
                >
                    {session.pages.length === 0 ? <AdminEmpty>No pageviews stored.</AdminEmpty> : session.pages.map((page) => (
                        <AdminRow key={page.id}>
                            <span className="min-w-0 flex-1 truncate">{page.path}</span>
                            <span className="text-xs text-muted-foreground">{page.ms != null ? `${Math.round(page.ms / 1000)}s` : "open"}</span>
                        </AdminRow>
                    ))}
                </AdminPanel>
            ))}
            <AdminPanel title="Named events">
                {events.length === 0 ? <AdminEmpty>No named events for this visitor.</AdminEmpty> : events.map((row) => (
                    <AdminRow key={row.id}>
                        <span className="flex-1 truncate">{row.name}{row.path ? ` · ${row.path}` : ""}</span>
                        <span className="text-xs text-muted-foreground">{row.createdAt.toISOString().slice(11, 19)}</span>
                    </AdminRow>
                ))}
            </AdminPanel>
            {sessions.length === 0 && events.length === 0 ? <AdminEmpty>No sessions for this id.</AdminEmpty> : null}
        </div>
    )
}
