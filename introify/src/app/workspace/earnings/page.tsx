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
            <p className="w-lede">{earnings.payoutStatus}</p>
            <ul className="w-card-grid" style={{ marginTop: 24 }}>
                <li className="w-creation-card"><div><h2>{earnings.jobsSold}</h2><p>Jobs sold</p></div></li>
                <li className="w-creation-card"><div><h2>{formatInr(earnings.grossCents)}</h2><p>Gross</p></div></li>
                <li className="w-creation-card"><div><h2>{formatInr(earnings.feeCents)}</h2><p>Introify fee</p></div></li>
                <li className="w-creation-card"><div><h2>{formatInr(earnings.netCents)}</h2><p>Net</p></div></li>
            </ul>
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
