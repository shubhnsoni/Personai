import { NextResponse } from "next/server"
import { applyDeliveryCallback, verifyMessagingCallback } from "@/lib/messaging/consent"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
    const secret = process.env.MESSAGING_CALLBACK_SECRET
    if (!secret) return NextResponse.json({ error: "Messaging callbacks are not configured." }, { status: 503 })
    const body = await request.text()
    const token = request.headers.get("x-introify-messaging-signature") || ""
    if (!verifyMessagingCallback(body, token, secret)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    let payload: { status?: string }
    try { payload = JSON.parse(body) as { status?: string } } catch {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }
    return NextResponse.json(applyDeliveryCallback({ status: payload.status || "unknown" }))
}
