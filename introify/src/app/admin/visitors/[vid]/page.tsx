import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"

export const dynamic = "force-dynamic"

export default async function AdminVisitorPage({
    params,
    searchParams,
}: {
    params: Promise<{ vid: string }>
    searchParams: Promise<{ shop?: string }>
}) {
    await requireAdmin()
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
        <div className="space-y-6">
            <div>
                <Link href="/admin/traffic" className="text-xs text-muted-foreground">Traffic</Link>
                <h1 className="text-2xl font-semibold tracking-tight">Visitor</h1>
                <p className="text-sm text-muted-foreground">{visitorId.slice(0, 12)}… {shopName ? `· ${shopName}` : ""}</p>
            </div>
            {sessions.map((session) => (
                <section key={session.id} className="rounded-xl border p-4">
                    <div className="flex justify-between gap-3 text-sm">
                        <Link href={`/admin/shops/${session.profileId}`} className="font-medium hover:underline">{session.profile.displayName}</Link>
                        <span className="text-xs text-muted-foreground">{session.device || "—"} · {session.country || "—"} · {session.utmSource || session.referrerHost || "direct"}</span>
                    </div>
                    <ol className="mt-3 space-y-1 text-sm">
                        {session.pages.map((page) => (
                            <li key={page.id} className="flex justify-between gap-2">
                                <span className="truncate">{page.path}</span>
                                <span className="text-xs text-muted-foreground">{page.ms != null ? `${Math.round(page.ms / 1000)}s` : "open"}</span>
                            </li>
                        ))}
                        {session.pages.length === 0 ? <li className="text-muted-foreground">No pageviews stored.</li> : null}
                    </ol>
                </section>
            ))}
            <section className="rounded-xl border p-4">
                <h2 className="text-sm font-medium">Named events</h2>
                <ul className="mt-2 space-y-1 text-sm">
                    {events.map((row) => (
                        <li key={row.id} className="flex justify-between gap-2">
                            <span>{row.name}{row.path ? ` · ${row.path}` : ""}</span>
                            <span className="text-xs text-muted-foreground">{row.createdAt.toISOString().slice(11, 19)}</span>
                        </li>
                    ))}
                    {events.length === 0 ? <li className="text-muted-foreground">No named events for this visitor.</li> : null}
                </ul>
            </section>
            {sessions.length === 0 && events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions for this id.</p>
            ) : null}
        </div>
    )
}
