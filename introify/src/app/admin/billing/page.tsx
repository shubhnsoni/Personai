import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin/require-admin"
import { getPublicBillingAvailability } from "@/lib/billing/config"
import { AdminEmpty, AdminPageHead, AdminPanel, AdminTable } from "@/components/admin/admin-ui"

export const dynamic = "force-dynamic"
export default async function PlatformBillingOperations() {
    await requireAdmin()
    const [subscriptions, events, jobs, holds] = await Promise.all([
        prisma.platformSubscription.findMany({ include: { account: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
        prisma.billingProviderEvent.findMany({ where: { status: { not: "DONE" } }, select: { id: true, type: true, status: true, attempts: true, error: true }, orderBy: { createdAt: "asc" }, take: 40 }),
        prisma.arBuild.findMany({ where: { status: { in: ["UNKNOWN", "HELD", "DELIVERY_RETRY"] } }, select: { id: true, profileId: true, status: true, providerTaskId: true, error: true }, orderBy: { updatedAt: "asc" }, take: 40 }),
        prisma.billingAccount.findMany({ where: { status: { not: "ACTIVE" } }, select: { id: true, name: true, status: true }, take: 40 }),
    ])
    const readiness = getPublicBillingAvailability()
    return <div className="space-y-6">
        <AdminPageHead title="Platform billing" hint="Confirmed subscriptions, payment retries and generation exceptions." />
        <div className="grid gap-3 sm:grid-cols-3">{Object.entries(readiness).map(([key, ready]) => <div key={key} className="studio-panel rounded-xl p-4"><p className="text-xs uppercase text-muted-foreground">{key}</p><p className="mt-1 font-medium">{ready ? "Configured" : "Disabled or incomplete"}</p></div>)}</div>
        <AdminPanel title="Subscriptions">{!subscriptions.length ? <AdminEmpty>No confirmed platform subscriptions yet.</AdminEmpty> : <AdminTable columns={["Account", "Plan", "Status", "Paid through"]}>{subscriptions.map(s => <tr key={s.id}><td className="p-4">{s.account.name}</td><td className="p-4 capitalize">{s.planId} · {s.cadence}</td><td className="p-4">{s.status}{s.cancelAtPeriodEnd ? " · renewal off" : ""}</td><td className="p-4">{s.paidThrough?.toISOString().slice(0, 10) || "—"}</td></tr>)}</AdminTable>}</AdminPanel>
        <AdminPanel title="Payment events awaiting reconciliation">{!events.length ? <AdminEmpty>No pending payment events.</AdminEmpty> : <AdminTable columns={["Event", "Type", "Attempts", "State"]}>{events.map(e => <tr key={e.id}><td className="max-w-56 break-all p-4 text-xs">{e.id}</td><td className="p-4">{e.type}</td><td className="p-4">{e.attempts}</td><td className="p-4">{e.status}</td></tr>)}</AdminTable>}</AdminPanel>
        <AdminPanel title="Generation review">{!jobs.length ? <AdminEmpty>No generation exceptions.</AdminEmpty> : <><p className="px-4 py-3 text-sm text-muted-foreground">Unknown dispatches retain their reservation. Verify the original supplier task before attaching a result or returning a unit; never submit the same generation again.</p><AdminTable columns={["Job", "State", "Supplier task", "Reason"]}>{jobs.map(j => <tr key={j.id}><td className="max-w-48 break-all p-4 text-xs">{j.id}</td><td className="p-4">{j.status}</td><td className="max-w-48 break-all p-4 text-xs">{j.providerTaskId || "Unconfirmed"}</td><td className="p-4">{j.error}</td></tr>)}</AdminTable></>}</AdminPanel>
        <AdminPanel title="Accounts on hold">{!holds.length ? <AdminEmpty>No payment holds.</AdminEmpty> : <AdminTable columns={["Account", "Reference", "Status"]}>{holds.map(a => <tr key={a.id}><td className="p-4">{a.name}</td><td className="break-all p-4 text-xs">{a.id}</td><td className="p-4">{a.status}</td></tr>)}</AdminTable>}</AdminPanel>
    </div>
}
