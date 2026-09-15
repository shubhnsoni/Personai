import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function BridgePage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const session = await prisma.bridgeSession.upsert({
        where: { profileId: user.activeProfile.id },
        update: {},
        create: { profileId: user.activeProfile.id },
    })

    const online = session.status === "online"

    return (
        <div className="w-page">
            <div className="w-bridge-hero">
                <h1 className="w-h1">Desktop Bridge</h1>
                <p className="w-lede">Cloud jobs still run on Introify servers. Photoshop, After Effects, and AutoCAD control is not required to complete work.</p>
                <div className="w-bridge-status">
                    <div>
                        <b>{online ? "Connected" : "Offline"}</b>
                        <small>Last seen {session.lastSeen.toLocaleString()}</small>
                    </div>
                    <span className={`w-jtag ${online ? "done" : "wait"}`}>{online ? "Online" : "Cloud only"}</span>
                </div>
            </div>
            <section className="w-panel">
                <h2 className="w-h2">What this is</h2>
                <p>{session.detail}</p>
                <div className="w-scope-row">
                    <i style={{ background: "var(--w-success)" }} aria-hidden="true" />
                    <div>
                        <b>Cloud jobs</b>
                        <small>Runs, results, and visitor chat stay on Introify.</small>
                    </div>
                </div>
                <div className="w-scope-row">
                    <i style={{ background: "var(--w-mut)" }} aria-hidden="true" />
                    <div>
                        <b>Desktop apps</b>
                        <small>Not required. Bridge stores an offline session until a desktop client exists.</small>
                    </div>
                </div>
            </section>
        </div>
    )
}
