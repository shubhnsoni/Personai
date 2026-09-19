import { describe, expect, it } from "vitest"
import { last10Digits, normalizeE164, phonesMatch } from "@/lib/whatsapp/phone"
import { validateTwilioSignature } from "@/lib/whatsapp/twilio"
import crypto from "crypto"

describe("whatsapp phone normalize", () => {
    it("normalizes India 10-digit to +91", () => {
        expect(normalizeE164("7970547297")).toBe("+917970547297")
        expect(normalizeE164("+91 79705 47297")).toBe("+917970547297")
        expect(normalizeE164("whatsapp:+917970547297")).toBe("+917970547297")
    })

    it("preserves explicit country codes", () => {
        expect(normalizeE164("+14155552671")).toBe("+14155552671")
        expect(normalizeE164("0014155552671")).toBe("+14155552671")
    })

    it("matches E.164 and last-10", () => {
        expect(phonesMatch("+917970547297", "7970547297")).toBe(true)
        expect(phonesMatch("whatsapp:+917970547297", "+91-7970-547297")).toBe(true)
        expect(phonesMatch("+917970547297", "+14155552671")).toBe(false)
        expect(last10Digits("+917970547297")).toBe("7970547297")
    })
})

describe("twilio signature", () => {
    const authToken = "test_auth_token_123"
    const url = "https://introify.com/api/whatsapp/twilio"
    const params = { From: "whatsapp:+917970547297", To: "whatsapp:+917970547297", Body: "hi" }

    function sign(token: string, targetUrl: string, body: Record<string, string>) {
        const sorted = Object.keys(body).sort()
        let data = targetUrl
        for (const key of sorted) data += key + body[key]
        return crypto.createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64")
    }

    it("accepts a valid X-Twilio-Signature", () => {
        const signature = sign(authToken, url, params)
        expect(validateTwilioSignature({ authToken, signature, url, params })).toBe(true)
    })

    it("rejects a bad signature", () => {
        expect(
            validateTwilioSignature({
                authToken,
                signature: "not-a-real-signature============",
                url,
                params,
            }),
        ).toBe(false)
    })

    it("rejects when auth token is wrong", () => {
        const signature = sign(authToken, url, params)
        expect(validateTwilioSignature({ authToken: "other", signature, url, params })).toBe(false)
    })
})

describe("shop owner allowlist (pure)", () => {
    it("phonesMatch is the allowlist predicate used before ack", () => {
        // Webhook silently ignores when findShopOwnerByWhatsapp returns null.
        // Matching uses phonesMatch against Profile.whatsapp.
        expect(phonesMatch("9798123456", "+919798123456")).toBe(true)
        expect(phonesMatch("9798123456", "+911111111111")).toBe(false)
    })
})
