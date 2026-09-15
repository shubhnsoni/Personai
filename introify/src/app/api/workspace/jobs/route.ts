import { NextResponse } from "next/server"
import { listProfileJobRuns } from "@/lib/creation-jobs"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function GET() {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const items = await listProfileJobRuns(session.profileId)
    return NextResponse.json({ items })
}
