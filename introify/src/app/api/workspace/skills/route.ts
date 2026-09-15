import { NextResponse } from "next/server"
import { attachCreationSkill } from "@/lib/workspace-market"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const body = await req.json().catch(() => ({}))
    try {
        const dep = await attachCreationSkill(session.profileId, String(body.hostId || ""), String(body.usesId || ""))
        if (!dep) return NextResponse.json({ error: "Pick two AIs you own." }, { status: 404 })
        return NextResponse.json({ dep })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not attach that skill." }, { status: 400 })
    }
}
