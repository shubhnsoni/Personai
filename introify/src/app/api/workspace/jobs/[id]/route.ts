import { NextResponse } from "next/server"
import { getOwnedRun } from "@/lib/creation-jobs"
import { requireWorkspaceProfile } from "@/lib/workspace-session"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireWorkspaceProfile()
    if (session.error) return session.error
    const { id } = await params
    const run = await getOwnedRun(session.profileId, id)
    if (!run) return NextResponse.json({ error: "Not found." }, { status: 404 })
    return NextResponse.json({ run })
}
