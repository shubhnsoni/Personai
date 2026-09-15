import { NextResponse } from "next/server"
import { createCreation, listCreations } from "@/lib/creations"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function GET() {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const items = await listCreations(session.profileId)
    return NextResponse.json({ items })
}

export async function POST(req: Request) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const body = await req.json().catch(() => ({}))
    try {
        const creation = await createCreation(session.profileId, {
            name: String(body.name || ""),
            purpose: typeof body.purpose === "string" ? body.purpose : undefined,
            description: typeof body.description === "string" ? body.description : undefined,
            instructions: typeof body.instructions === "string" ? body.instructions : undefined,
        })
        return NextResponse.json({ creation })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this AI." }, { status: 400 })
    }
}
