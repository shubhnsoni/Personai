import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { ensureProfileConnections } from "@/lib/workspace-market"
import { connectionCatalog, connectionHealth, defaultManifest } from "@/lib/workspace-connections"

export const dynamic = "force-dynamic"

export default async function ConnectionsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const rows = await ensureProfileConnections(user.activeProfile.id)
    const catalog = connectionCatalog()
    const manifest = defaultManifest("Complete concrete work")

    return (
        <div className="w-page">
            <h1 className="w-h1">Connections</h1>
            <p className="w-lede">Connect a service once. Each AI asks for its own scopes. Removing one AI does not disconnect the others.</p>
            <ul className="w-joblist" style={{ marginTop: 24 }}>
                {rows.map((row) => {
                    const meta = catalog.find((item) => item.kind === row.kind)
                    return (
                        <li key={row.id} className="w-jobrow">
                            <div className="w-jobmeta">
                                <b>{row.label}</b>
                                <small>{meta?.blurb} {row.scopes.length ? `· ${row.scopes.join(", ")}` : ""}</small>
                            </div>
                            <span className={`w-jtag ${row.status === "connected" ? "done" : "wait"}`}>{connectionHealth(row.status)}</span>
                        </li>
                    )
                })}
            </ul>
            <section className="w-panel" style={{ marginTop: 24 }}>
                <h2 className="w-h2">Default capability manifest</h2>
                <p className="w-lede">Required: {manifest.required.join(", ")}. Allowed: {manifest.actions.join(", ")}. Approval: {manifest.approvalRequired.join(", ")}. Never: {manifest.disallowed.join(", ")}.</p>
            </section>
        </div>
    )
}
