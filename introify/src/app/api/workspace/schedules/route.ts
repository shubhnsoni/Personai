import { NextResponse } from "next/server"
import { scheduleCreationJob } from "@/lib/workspace-market"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const body = await req.json().catch(() => ({}))
    try {
        const schedule = await scheduleCreationJob(session.profileId, {
            creationId: String(body.creationId || ""),
            jobId: String(body.jobId || ""),
            cadence: String(body.cadence || ""),
        })
        if (!schedule) return NextResponse.json({ error: "Pick a job you own." }, { status: 404 })
        return NextResponse.json({ schedule })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not schedule that job." }, { status: 400 })
    }
}
