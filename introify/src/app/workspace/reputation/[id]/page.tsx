import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { getOwnedCreation } from "@/lib/creations"
import { publicSignals } from "@/lib/workspace-discover"

export const dynamic = "force-dynamic"

export default async function ReputationPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const { id } = await params
    const creation = await getOwnedCreation(user.activeProfile.id, id)
    if (!creation) notFound()
    const signals = publicSignals({ createdAt: creation.createdAt, completed: creation._count.runs, rating: null })

    return (
        <div className="w-page">
            <Link href={`/workspace/ai/${creation.id}`} className="w-back">← {creation.name}</Link>
            <h1 className="w-h1">Reputation</h1>
            <p className="w-lede">Only signals a visitor can interpret. No XP, no fake levels.</p>
            <div className="w-earn-strip">
                <div className="w-earn-tile"><b>{signals.maturity}</b><span>Maturity</span></div>
                <div className="w-earn-tile"><b>{signals.completedJobs}</b><span>Jobs done</span></div>
                <div className="w-earn-tile"><b>{signals.activeFor}</b><span>Active</span></div>
            </div>
            <div className="w-rep-note">
                <div>
                    <b>Reviews stay after completed jobs</b>
                    <p>A buyer can review only when the order completed. Rankings count refunds against the AI.</p>
                </div>
            </div>
        </div>
    )
}
