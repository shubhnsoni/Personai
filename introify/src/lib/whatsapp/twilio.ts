import crypto from "crypto"

/** Twilio webhook signature validation (X-Twilio-Signature). */
export function validateTwilioSignature(opts: {
    authToken: string
    signature: string
    url: string
    params: Record<string, string>
}): boolean {
    const { authToken, signature, url, params } = opts
    if (!authToken || !signature) return false
    const sortedKeys = Object.keys(params).sort()
    let data = url
    for (const key of sortedKeys) {
        data += key + (params[key] ?? "")
    }
    const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64")
    try {
        const a = Buffer.from(expected)
        const b = Buffer.from(signature)
        if (a.length !== b.length) return false
        return crypto.timingSafeEqual(a, b)
    } catch {
        return false
    }
}

export function twilioWhatsappFrom(e164: string): string {
    const n = e164.startsWith("+") ? e164 : `+${e164.replace(/\D/g, "")}`
    return n.startsWith("whatsapp:") ? n : `whatsapp:${n}`
}

export async function sendTwilioWhatsappText(opts: {
    accountSid: string
    authToken: string
    from: string
    to: string
    body: string
}): Promise<{ ok: boolean; sid?: string; error?: string }> {
    const { accountSid, authToken, from, to, body } = opts
    if (!accountSid || !authToken) {
        return { ok: false, error: "missing_credentials" }
    }
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`
    const form = new URLSearchParams()
    form.set("From", from.startsWith("whatsapp:") ? from : twilioWhatsappFrom(from))
    form.set("To", to.startsWith("whatsapp:") ? to : twilioWhatsappFrom(to))
    form.set("Body", body)
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        })
        const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
        if (!res.ok) {
            return { ok: false, error: json.message || `twilio_${res.status}` }
        }
        return { ok: true, sid: json.sid }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "twilio_fetch_failed" }
    }
}
