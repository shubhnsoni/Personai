import Link from "next/link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const schedules = await prisma.creationSchedule.findMany({
        where: { creation: { profileId: user.activeProfile.id } },
        include: { creation: { select: { name: true } }, job: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
    })

    return (
        <div className="w-page">
            <h1 className="w-h1">Background jobs</h1>
            <p className="w-lede">Scheduled reports stay Read/Create. Spending or sending still needs approval. Nothing here controls desktop software.</p>
            {schedules.length === 0 ? (
                <div className="w-empty">
                    <h2>Nothing scheduled</h2>
                    <p>Offer a nightly report job, then attach a daily cadence. The owner still approves anything with real-world consequences.</p>
                    <Link href="/workspace" className="w-btn">Open an AI</Link>
                </div>
            ) : (
                <ul className="w-notes">
                    {schedules.map((row) => (
                        <li key={row.id}>
                            <b>{row.job.name}</b>
                            <p>{row.creation.name} · {row.cadence} · {row.enabled ? "Running" : "Paused"}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
