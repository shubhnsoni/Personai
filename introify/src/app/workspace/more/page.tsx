import Link from "next/link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { workspaceToolLinks } from "@/lib/workspace-discover"

export const dynamic = "force-dynamic"

export default async function MorePage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    return (
        <div className="w-page">
            <h1 className="w-h1">More</h1>
            <p className="w-lede">Explore, earnings, cloud connections, teams, and Bridge — kept off the primary four so My AIs stays the home screen.</p>
            <ul className="w-card-grid" style={{ marginTop: 24 }}>
                {workspaceToolLinks().map((item) => (
                    <li key={item.href}>
                        <Link href={item.href} className="w-creation-card">
                            <div>
                                <h2>{item.label}</h2>
                                <p>{item.blurb}</p>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    )
}
