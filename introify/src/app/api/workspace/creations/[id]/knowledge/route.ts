import { NextResponse } from "next/server"
import { addCreationKnowledge } from "@/lib/creations"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    try {
        const item = await addCreationKnowledge(session.profileId, id, String(body.title || "Note"), String(body.rawText || body.text || ""))
        if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 })
        return NextResponse.json({ item })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save that note." }, { status: 400 })
    }
}
