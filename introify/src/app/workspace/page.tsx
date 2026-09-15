import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Sparkles } from "lucide-react"
import { syncUser } from "@/lib/auth-sync"
import { listCreations } from "@/lib/creations"
import { hiredCreations } from "@/lib/workspace-market"

export const dynamic = "force-dynamic"

export default async function WorkspaceHome() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const items = await listCreations(user.activeProfile.id)
    const hired = await hiredCreations(user.activeProfile.id)

    return (
        <div className="w-page">
            <div className="w-titlebar">
                <div>
                    <h1 className="w-h1">My AIs</h1>
                    <p className="w-lede">Private until you showcase them. Hired work appears here too — you hire the job, you do not own the AI.</p>
                </div>
                <Link href="/workspace/create" className="w-btn">
                    <Plus size={16} aria-hidden="true" /> Create
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="w-empty">
                    <Sparkles size={28} aria-hidden="true" />
                    <h2>Create your first AI</h2>
                    <p>Describe an outcome. Introify will turn it into working instructions, kept private by default.</p>
                    <Link href="/workspace/create" className="w-btn">Start with a conversation</Link>
                </div>
            ) : (
                <ul className="w-card-grid">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link href={`/workspace/ai/${item.id}`} className="w-creation-card">
                                <span className="w-creation-avatar" aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span>
                                <div>
                                    <h2>{item.name}</h2>
                                    <p>{item.purpose || item.description || "No purpose yet"}</p>
                                    <div className="w-card-meta">
                                        <span className={`w-chip vis-${item.visibility.toLowerCase()}`}>{item.visibility.toLowerCase()}</span>
                                        <span>{item._count.runs} jobs</span>
                                        <span>{item._count.knowledge} notes</span>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {hired.length ? (
                <section style={{ marginTop: 32 }}>
                    <h2 className="w-h2">Hired</h2>
                    <ul className="w-card-grid">
                        {hired.map((row) => (
                            <li key={row.id}>
                                <Link href={`/${row.creation.profile.slug}/ai/${row.creation.slug}`} className="w-creation-card">
                                    <span className="w-creation-avatar" aria-hidden="true">{row.creation.name.slice(0, 2).toUpperCase()}</span>
                                    <div>
                                        <h2>{row.creation.name}</h2>
                                        <p>{row.creation.purpose || `From ${row.creation.profile.displayName}`}</p>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    )
}
