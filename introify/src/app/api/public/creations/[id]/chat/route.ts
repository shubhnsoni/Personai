import { NextResponse } from "next/server"
import { chatWithPublicCreation } from "@/lib/creation-jobs"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon"
    const limit = checkRateLimit(`public-creation-chat:${id}:${ip}`, 8)
    if (!limit.allowed) return NextResponse.json({ error: "Too many messages. Try again in a minute." }, { status: 429 })
    const body = await req.json().catch(() => ({}))
    try {
        const result = await chatWithPublicCreation(id, String(body.message || ""))
        if (!result) return NextResponse.json({ error: "This AI is not available to visitors." }, { status: 404 })
        return NextResponse.json(result)
    } catch (error) {
        const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500
        return NextResponse.json({ error: error instanceof Error ? error.message : "Chat is unavailable." }, { status: Number.isFinite(status) ? status : 500 })
    }
}
