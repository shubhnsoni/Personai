"use client"

import { useTransition } from "react"
import { purgeExpiredAnalytics, recordPrivacyRequest } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { AdminEmpty, AdminPanel, AdminTable } from "@/components/admin/admin-ui"

export function PrivacyOps({
    requests,
}: {
    requests: { id: string; createdAt: string; meta: string | null }[]
}) {
    const [pending, start] = useTransition()
    return (
        <div className="space-y-5">
            <AdminPanel title="Privacy requests">
                <form
                    className="flex flex-wrap gap-2 border-b border-white/8 p-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        const data = new FormData(event.currentTarget)
                        start(() => recordPrivacyRequest({
                            email: String(data.get("email") || ""),
                            kind: String(data.get("kind") || "ACCESS") as "ACCESS" | "CORRECTION" | "DELETION",
                            note: String(data.get("note") || ""),
                        }))
                        event.currentTarget.reset()
                    }}
                >
                    <input name="email" required type="email" placeholder="Requester email" className="h-9 min-w-48 flex-1 rounded-md border bg-background px-2 text-sm" />
                    <select name="kind" className="h-9 rounded-md border bg-background px-2 text-sm">
                        <option value="ACCESS">Access</option>
                        <option value="CORRECTION">Correction</option>
                        <option value="DELETION">Deletion</option>
                    </select>
                    <input name="note" placeholder="Note" className="h-9 min-w-40 flex-1 rounded-md border bg-background px-2 text-sm" />
                    <Button size="sm" type="submit" disabled={pending}>Record</Button>
                    <Button size="sm" type="button" variant="outline" disabled={pending} onClick={() => start(async () => { await purgeExpiredAnalytics() })}>
                        Purge old analytics
                    </Button>
                </form>
                {requests.length === 0 ? <AdminEmpty>No privacy requests recorded.</AdminEmpty> : (
                    <AdminTable columns={["When", "Request"]}>
                        {requests.map((row) => (
                            <tr key={row.id} className="border-t border-white/8">
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.createdAt.slice(0, 10)}</td>
                                <td className="px-4 py-2.5 text-xs">{row.meta || row.id}</td>
                            </tr>
                        ))}
                    </AdminTable>
                )}
            </AdminPanel>
        </div>
    )
}
