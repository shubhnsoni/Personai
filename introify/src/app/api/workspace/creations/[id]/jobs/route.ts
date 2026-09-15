import { NextResponse } from "next/server"
import { defineCreationJob } from "@/lib/creation-jobs"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    try {
        const job = await defineCreationJob(session.profileId, id, {
            name: String(body.name || ""),
            description: typeof body.description === "string" ? body.description : undefined,
            inputHint: typeof body.inputHint === "string" ? body.inputHint : undefined,
        })
        if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 })
        return NextResponse.json({ job })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not define that job." }, { status: 400 })
    }
}
