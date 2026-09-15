import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { teamEventPlan, teamTemplates } from "@/lib/workspace-teams"
import { CreateTeamForm } from "@/components/workspace/create-team-form"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const teams = await prisma.creationTeam.findMany({
        where: { profileId: user.activeProfile.id },
        include: { members: { include: { creation: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
    })
    const creations = await prisma.creation.findMany({
        where: { profileId: user.activeProfile.id },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
    })
    const plan = teamEventPlan("reservation")

    return (
        <div className="w-page">
            <h1 className="w-h1">AI teams</h1>
            <p className="w-lede">Assemble specialists. A reservation can update covers, prep, ingredients, and staffing without one AI doing every job.</p>
            <section className="w-panel">
                <h2 className="w-h2">Reservation example</h2>
                <ul className="w-notes">{plan.map((row) => <li key={row.skill}><b>{row.skill}</b><p>{row.job}</p></li>)}</ul>
            </section>
            <section className="w-panel">
                <h2 className="w-h2">Templates</h2>
                <p className="w-lede">{teamTemplates().map((item) => item.name).join(" · ")}</p>
                <CreateTeamForm creations={creations} templates={teamTemplates()} />
            </section>
            {teams.length === 0 ? (
                <div className="w-empty"><h2>No teams yet</h2><p>Create AIs first, then group them.</p></div>
            ) : (
                <ul className="w-notes">{teams.map((team) => (
                    <li key={team.id}><b>{team.name}</b><p>{team.members.map((m) => m.creation.name).join(", ") || "No members"}</p></li>
                ))}</ul>
            )}
        </div>
    )
}
