import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { remixPresets, skillDependencyLine } from "@/lib/workspace-teams"
import { AttachSkillForm } from "@/components/workspace/attach-skill-form"

export const dynamic = "force-dynamic"

export default async function SkillsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const creations = await prisma.creation.findMany({
        where: { profileId: user.activeProfile.id },
        include: { skillUses: { include: { uses: { select: { name: true } } } } },
        orderBy: { updatedAt: "desc" },
    })
    const remix = remixPresets()

    return (
        <div className="w-page">
            <h1 className="w-h1">Composable skills</h1>
            <p className="w-lede">One AI may use another where you allow it. Dependencies stay visible. Remix presets do not turn on a royalty engine.</p>
            <div className="w-composer">
                <h2 className="w-h2">Remix presets</h2>
                <div className="w-stackflow">
                    {remix.map((item) => (
                        <span key={item.id} className="w-stacknode">
                            <b>{item.label}</b>
                            <small>{item.royaltyLive ? "Royalty live" : "No royalty engine"}</small>
                        </span>
                    ))}
                </div>
            </div>
            {creations.length >= 2 ? (
                <section className="w-panel">
                    <h2 className="w-h2">Attach a dependency</h2>
                    <AttachSkillForm creations={creations.map((item) => ({ id: item.id, name: item.name }))} />
                </section>
            ) : null}
            {creations.length === 0 ? (
                <div className="w-empty"><h2>No skills yet</h2><p>Create an AI, then attach another as a dependency.</p></div>
            ) : (
                <div className="w-skill-grid">
                    {creations.map((item) => (
                        <article key={item.id} className={`w-skill${item.skillUses.length ? " on" : ""}`}>
                            <div className="w-skill-top">
                                <span className="w-skill-cat">{item.skillUses.length ? "Uses others" : "Standalone"}</span>
                            </div>
                            <h3>{item.name}</h3>
                            <p>{skillDependencyLine({ name: item.name, uses: item.skillUses.map((dep) => dep.uses.name) })}</p>
                        </article>
                    ))}
                </div>
            )}
        </div>
    )
}
