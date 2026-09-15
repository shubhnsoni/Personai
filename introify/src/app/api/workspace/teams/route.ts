import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const body = await req.json().catch(() => ({}))
    const name = String(body.name || "").trim().slice(0, 80)
    if (name.length < 2) return NextResponse.json({ error: "Name the team." }, { status: 400 })
    const ids = Array.isArray(body.creationIds) ? body.creationIds.filter((id: unknown) => typeof id === "string") : []
    const owned = await prisma.creation.findMany({ where: { profileId: session.profileId, id: { in: ids } }, select: { id: true } })
    const team = await prisma.creationTeam.create({
        data: {
            profileId: session.profileId,
            name,
            template: typeof body.template === "string" ? body.template : null,
            members: { create: owned.map((row) => ({ creationId: row.id })) },
        },
    })
    return NextResponse.json({ team })
}
