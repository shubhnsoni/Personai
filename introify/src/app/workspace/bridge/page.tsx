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

    return (
        <div className="w-page">
            <h1 className="w-h1">Desktop Bridge</h1>
            <p className="w-lede">Cloud jobs still run on Introify servers. Photoshop, After Effects, and AutoCAD control is not required to complete work.</p>
            <div className="w-panel">
                <h2 className="w-h2">{session.status === "online" ? "Connected" : "Offline"}</h2>
                <p>{session.detail}</p>
                <p className="w-lede">Last seen {session.lastSeen.toLocaleString()}.</p>
            </div>
        </div>
    )
}
