import { NextResponse } from "next/server"
import { inquiryRateLimited, notifyOperator, parseInquiryInput, recordPlatformInquiry } from "@/lib/platform-inbox"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    const parsed = parseInquiryInput({
        kind: "WAITLIST",
        email: typeof body.email === "string" ? body.email : "",
        name: typeof body.name === "string" ? body.name : "",
        plan: typeof body.plan === "string" ? body.plan : "",
        cadence: typeof body.cadence === "string" ? body.cadence : "",
        honeypot: typeof body.company === "string" ? body.company : "",
    })
    if ("spam" in parsed) return NextResponse.json({ ok: true })
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
    if (inquiryRateLimited(`waitlist:${parsed.email}`)) {
        return NextResponse.json({ error: "Please wait a moment before sending another request." }, { status: 429 })
    }
    try {
        await recordPlatformInquiry({ kind: "WAITLIST", ...parsed, ip })
        await notifyOperator({ kind: "WAITLIST", email: parsed.email, name: parsed.name, plan: parsed.plan })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("[waitlist]", error)
        return NextResponse.json({ error: "We couldn’t save that just now. Try again or email us from the contact page." }, { status: 500 })
    }
}
