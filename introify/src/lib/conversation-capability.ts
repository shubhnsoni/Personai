import { createHash, createHmac, timingSafeEqual } from "node:crypto"

const CAPABILITY_VERSION = 1
export const CONVERSATION_CAPABILITY_TTL_SECONDS = 60 * 60 * 24
const CAPABILITY_CONTEXT = "personai:conversation-capability:v1"

type CapabilityPayload = Readonly<{
    v: number
    c: string
    p: string
    i: string
    e: number
}>

function capabilitySigningKey(secret: string): Buffer {
    return createHash("sha256").update(CAPABILITY_CONTEXT).update("\0").update(secret).digest()
}

export function conversationCapabilityCookieName(profileId: string): string {
    const scope = createHash("sha256").update(profileId).digest("hex").slice(0, 24)
    return `pl_cc_${scope}`
}

export function issueConversationCapability(input: {
    conversationId: string
    profileId: string
    visitorId: string
    secret: string
    nowMs?: number
    ttlSeconds?: number
}): string {
    const nowMs = input.nowMs ?? Date.now()
    const ttlSeconds = input.ttlSeconds ?? CONVERSATION_CAPABILITY_TTL_SECONDS
    const payload: CapabilityPayload = {
        v: CAPABILITY_VERSION,
        c: input.conversationId,
        p: input.profileId,
        i: input.visitorId,
        e: Math.floor(nowMs / 1000) + ttlSeconds,
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
    const signature = createHmac("sha256", capabilitySigningKey(input.secret)).update(encoded).digest("base64url")
    return `${encoded}.${signature}`
}

export function verifyConversationCapability(input: {
    token: string
    conversationId: string
    profileId: string
    visitorId: string
    secret: string
    nowMs?: number
}): boolean {
    if (!input.token || input.token.length > 2048) return false
    const [encoded, suppliedSignature, extra] = input.token.split(".")
    if (!encoded || !suppliedSignature || extra !== undefined) return false

    const expectedSignature = createHmac("sha256", capabilitySigningKey(input.secret)).update(encoded).digest()
    let supplied: Buffer
    try {
        supplied = Buffer.from(suppliedSignature, "base64url")
    } catch {
        return false
    }
    if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) return false

    let payload: CapabilityPayload
    try {
        payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CapabilityPayload
    } catch {
        return false
    }
    const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000)
    return payload.v === CAPABILITY_VERSION
        && payload.c === input.conversationId
        && payload.p === input.profileId
        && payload.i === input.visitorId
        && Number.isSafeInteger(payload.e)
        && payload.e > nowSeconds
}

export function productionCapabilitySecret(): string | null {
    return process.env.CONVERSATION_CAPABILITY_SECRET
        || process.env.CLERK_SECRET_KEY
        || process.env.XAI_API_KEY
        || process.env.OPENAI_API_KEY
        || null
}
