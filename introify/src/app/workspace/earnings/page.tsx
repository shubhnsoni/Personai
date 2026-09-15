import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { earningsFor } from "@/lib/workspace-market"
import { formatInr } from "@/lib/workspace-economy"

export const dynamic = "force-dynamic"

export default async function EarningsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const earnings = await earningsFor(user.activeProfile.id)

    return (
        <div className="w-page">
            <h1 className="w-h1">Earnings</h1>
            <p className="w-lede">{earnings.payoutStatus} You hire the job — visitors do not buy the AI.</p>
            <div className="w-earn-strip">
                <div className="w-earn-tile"><b>{earnings.jobsSold}</b><span>Jobs sold</span></div>
                <div className="w-earn-tile"><b>{formatInr(earnings.grossCents)}</b><span>Gross</span></div>
                <div className="w-earn-tile"><b>{formatInr(earnings.feeCents)}</b><span>Introify fee</span></div>
                <div className="w-earn-tile"><b>{formatInr(earnings.netCents)}</b><span>Net</span></div>
            </div>
            {earnings.orders.length === 0 ? (
                <div className="w-empty" style={{ marginTop: 24 }}>
                    <h2>No sales yet</h2>
                    <p>Offer a concrete job on one of your AIs. Visitors chat first, then hire the work — not ownership of the AI.</p>
                </div>
            ) : (
                <div className="w-joblist" style={{ marginTop: 24 }}>
                    {earnings.orders.map((row) => (
                        <div key={row.id} className="w-jobrow">
                            <div className="w-jobmeta">
                                <b>{row.job}</b>
                                <small>{row.creation} · {row.status} · {row.amount}</small>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
