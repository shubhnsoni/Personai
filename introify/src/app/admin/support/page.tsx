import { prisma } from "@/lib/prisma"
import { ImpersonateButton } from "@/components/admin/admin-actions"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminTable } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"

export default async function AdminSupportPage() {
    const rows = await prisma.conversation.findMany({
        where: { mode: { in: ["LIVE_REQUESTED", "LIVE"] } },
        include: { profile: { select: { id: true, slug: true, displayName: true, liveChatSlaMinutes: true } } },
        orderBy: { liveRequestedAt: "asc" },
        take: 50,
    })
    const now = Date.now()
    const waiting = rows.filter((row) => row.mode === "LIVE_REQUESTED").length

    return (
        <div className="space-y-5">
            <AdminPageHead title="Support" hint={`${waiting} waiting · ${rows.length - waiting} live. Reply in the shop inbox as support.`} />
            <AdminPanel>
                <AdminTable columns={["Shop", "Visitor", "Wait", "SLA", ""]}>
                    {rows.map((row) => {
                        const waited = row.liveRequestedAt ? Math.round((now - row.liveRequestedAt.getTime()) / 60000) : 0
                        const sla = row.profile.liveChatSlaMinutes || 10
                        const late = row.mode === "LIVE_REQUESTED" && waited > sla
                        return (
                            <tr key={row.id} className="border-t border-white/8">
                                <td className="px-4 py-2.5 font-medium">{row.profile.displayName}</td>
                                <td className="px-4 py-2.5 text-xs">{row.visitorName || row.visitorEmail || "Visitor"}</td>
                                <td className={`px-4 py-2.5 text-xs tabular-nums ${late ? "text-red-400" : "text-muted-foreground"}`}>
                                    {row.mode === "LIVE" ? "Live" : `${waited}m`}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{sla}m</td>
                                <td className="px-4 py-2.5 text-right">
                                    <ImpersonateButton profileId={row.profile.id} href="/dashboard/inbox" label="Reply" />
                                </td>
                            </tr>
                        )
                    })}
                </AdminTable>
                {rows.length === 0 ? <AdminEmpty>No live or waiting chats.</AdminEmpty> : null}
            </AdminPanel>
        </div>
    )
}
