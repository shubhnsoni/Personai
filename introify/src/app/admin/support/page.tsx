import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { ImpersonateButton } from "@/components/admin/admin-actions"

export const dynamic = "force-dynamic"

export default async function AdminSupportPage() {
    await requireAdmin()
    const rows = await prisma.conversation.findMany({
        where: { mode: { in: ["LIVE_REQUESTED", "LIVE"] } },
        include: { profile: { select: { id: true, slug: true, displayName: true, liveChatSlaMinutes: true } } },
        orderBy: { liveRequestedAt: "asc" },
        take: 50,
    })
    const now = Date.now()

    return (
        <div className="space-y-5">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
                <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
                <p className="text-sm text-muted-foreground">Live chats across shops. Open as support to reply in the shop inbox.</p>
            </div>
            <div className="divide-y rounded-xl border">
                {rows.map((row) => {
                    const waited = row.liveRequestedAt ? Math.round((now - row.liveRequestedAt.getTime()) / 60000) : 0
                    const sla = row.profile.liveChatSlaMinutes || 10
                    const late = row.mode === "LIVE_REQUESTED" && waited > sla
                    return (
                        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                            <div className="min-w-0">
                                <Link href={`/admin/shops/${row.profile.id}`} className="font-medium hover:underline">{row.profile.displayName}</Link>
                                <p className={`text-xs ${late ? "text-red-500" : "text-muted-foreground"}`}>
                                    {row.visitorName || row.visitorEmail || "Visitor"} · {row.mode === "LIVE" ? "Live" : `Waiting ${waited}m`}
                                    {late ? ` · SLA ${sla}m` : ""}
                                </p>
                            </div>
                            <ImpersonateButton profileId={row.profile.id} href="/dashboard/inbox" label="Reply in inbox" />
                        </div>
                    )
                })}
                {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No live chats waiting.</p> : null}
            </div>
        </div>
    )
}
