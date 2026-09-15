import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { remixPresets, skillDependencyLine } from "@/lib/workspace-teams"

export const dynamic = "force-dynamic"

export default async function SkillsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const creations = await prisma.creation.findMany({
        where: { profileId: user.activeProfile.id },
        include: { skillUses: { include: { uses: { select: { name: true } } } } },
        orderBy: { updatedAt: "desc" },
    })

    return (
        <div className="w-page">
            <h1 className="w-h1">Composable skills</h1>
            <p className="w-lede">One AI may use another where you allow it. Dependencies stay visible. Remix presets do not turn on a royalty engine.</p>
            <p className="w-lede">Remix: {remixPresets().map((item) => item.label).join(" · ")}.</p>
            {creations.length === 0 ? (
                <div className="w-empty"><h2>No skills yet</h2><p>Create an AI, then attach another as a dependency.</p></div>
            ) : (
                <ul className="w-notes">
                    {creations.map((item) => (
                        <li key={item.id}>
                            <b>{item.name}</b>
                            <p>{skillDependencyLine({ name: item.name, uses: item.skillUses.map((dep) => dep.uses.name) })}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
