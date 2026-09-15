import { NextResponse } from "next/server"
import { runCreationJob } from "@/lib/creation-jobs"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    try {
        const run = await runCreationJob(session.profileId, id, {
            jobId: typeof body.jobId === "string" ? body.jobId : undefined,
            jobName: typeof body.jobName === "string" ? body.jobName : undefined,
            prompt: String(body.prompt || body.input || ""),
        })
        if (!run) return NextResponse.json({ error: "Not found." }, { status: 404 })
        return NextResponse.json({ run })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "The job could not start." }, { status: 400 })
    }
}
