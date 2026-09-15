import { NextResponse } from "next/server"
import { requestJobOrder } from "@/lib/workspace-market"
import { syncUser } from "@/lib/auth-sync"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const user = await syncUser().catch(() => null)
    try {
        const order = await requestJobOrder({
            creationId: id,
            jobId: String(body.jobId || ""),
            prompt: String(body.prompt || body.input || ""),
            buyerProfileId: user?.activeProfile?.id || null,
            buyerEmail: user?.email || (typeof body.email === "string" ? body.email : null),
        })
        return NextResponse.json({ order })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start that job."
        const status = /not open yet/i.test(message) ? 409 : 400
        return NextResponse.json({ error: message }, { status })
    }
}
