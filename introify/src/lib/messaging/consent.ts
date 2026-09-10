import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export type MessagingChannel = "SMS" | "WHATSAPP" | "EMAIL"

export type MessagingChoice = {
    recipient: string
    channel: MessagingChannel
    purpose: string
    granted: boolean
    templateVersion: string
    at: Date
}

const CONTEXT = "introify:messaging-callback:v1"

export function recordMessagingChoice(existing: readonly MessagingChoice[], next: MessagingChoice) {
    return [...existing, next]
}

export function isSuppressed(records: readonly MessagingChoice[], recipient: string, channel: MessagingChannel) {
    const relevant = records.filter((row) => row.recipient === recipient && row.channel === channel)
    const latest = relevant[relevant.length - 1]
    return latest ? !latest.granted : false
}

function signingKey(secret: string) {
    return createHash("sha256").update(CONTEXT).update("\0").update(secret).digest()
}

export function signMessagingCallback(body: string, secret: string) {
    return createHmac("sha256", signingKey(secret)).update(body).digest("base64url")
}

export function verifyMessagingCallback(body: string, token: string, secret: string) {
    if (!token || token.length > 2048 || !secret) return false
    const expected = createHmac("sha256", signingKey(secret)).update(body).digest()
    let supplied: Buffer
    try { supplied = Buffer.from(token, "base64url") } catch { return false }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function applyDeliveryCallback(_payload: { status: string }) {
    return { recorded: true, sent: false as const }
}
