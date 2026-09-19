import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { findShopOwnerByWhatsapp } from "@/lib/whatsapp/shop-owner"
import { findWhatsappNumberForInboundTo } from "@/lib/whatsapp/numbers"
import { validateTwilioSignature, sendTwilioWhatsappText, twilioWhatsappFrom } from "@/lib/whatsapp/twilio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseForm(body: string): Record<string, string> {
    const params: Record<string, string> = {}
    const sp = new URLSearchParams(body)
    sp.forEach((value, key) => {
        params[key] = value
    })
    return params
}

function webhookPublicUrl(request: Request): string {
    const proto = request.headers.get("x-forwarded-proto") || "https"
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
    if (host) return `${proto}://${host}/api/whatsapp/twilio`
    return `${env.appUrl.replace(/\/$/, "")}/api/whatsapp/twilio`
}

/**
 * Twilio WhatsApp inbound webhook.
 * S1: validate signature → allowlist shop owners → short ack.
 * S2 TODO: AI draft + batch webview + createProduct.
 */
export async function POST(request: Request) {
    const raw = await request.text()
    const params = parseForm(raw)
    const signature = request.headers.get("x-twilio-signature") || ""
    const from = params.From || ""
    const to = params.To || ""

    const number = await findWhatsappNumberForInboundTo(to)
    if (!number || number.status !== "ACTIVE") {
        return new NextResponse(null, { status: 204 })
    }
    if (!number.authToken) {
        return NextResponse.json({ error: "WhatsApp sender credentials missing" }, { status: 503 })
    }

    const url = webhookPublicUrl(request)
    const okSig = validateTwilioSignature({
        authToken: number.authToken,
        signature,
        url,
        params,
    })
    if (!okSig) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const owner = await findShopOwnerByWhatsapp(from)
    if (!owner) {
        // Silent ignore: registered shop owners only.
        return new NextResponse(null, { status: 204 })
    }

    // S1 ack stub — S2 will replace with AI listing draft + webview + createProduct.
    const ack =
        `Hi ${owner.displayName} — Introify got your WhatsApp. ` +
        `Product intake from chat is next; for now this is just an acknowledgement.`

    if (number.accountSid && number.authToken) {
        await sendTwilioWhatsappText({
            accountSid: number.accountSid,
            authToken: number.authToken,
            from: number.whatsappFrom || twilioWhatsappFrom(number.e164),
            to: from,
            body: ack,
        })
    }

    return new NextResponse(null, { status: 204 })
}
