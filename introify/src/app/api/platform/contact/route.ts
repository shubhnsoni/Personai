import { NextResponse } from "next/server"
import { inquiryRateLimited, notifyOperator, parseInquiryInput, recordPlatformInquiry } from "@/lib/platform-inbox"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Write a short message so we know how to help." }, { status: 400 })
    }
    const parsed = parseInquiryInput({
        kind: "CONTACT",
        email: typeof body.email === "string" ? body.email : "",
        name: typeof body.name === "string" ? body.name : "",
        message: typeof body.message === "string" ? body.message : "",
        honeypot: typeof body.company === "string" ? body.company : "",
    })
    if ("spam" in parsed) return NextResponse.json({ ok: true })
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
    if (inquiryRateLimited(`contact:${parsed.email}`)) {
        return NextResponse.json({ error: "Please wait a moment before sending another message." }, { status: 429 })
    }
    try {
        await recordPlatformInquiry({ kind: "CONTACT", ...parsed, ip })
        await notifyOperator({ kind: "CONTACT", email: parsed.email, name: parsed.name, message: parsed.message })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("[contact]", error)
        return NextResponse.json({ error: "We couldn’t send that just now. Email us directly or try again." }, { status: 500 })
    }
}
