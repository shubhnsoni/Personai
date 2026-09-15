import { NextResponse } from "next/server"
import { chatWithCreation } from "@/lib/creation-jobs"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    try {
        const result = await chatWithCreation(session.profileId, id, String(body.message || ""))
        if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 })
        return NextResponse.json(result)
    } catch (error) {
        const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500
        return NextResponse.json({ error: error instanceof Error ? error.message : "Chat is unavailable." }, { status: Number.isFinite(status) ? status : 500 })
    }
}
