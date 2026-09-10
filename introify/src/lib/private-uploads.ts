import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { resolve } from "node:path"
import { validUploadSegments } from "@/lib/uploads-storage"

export { confidentialUploadsEnabled } from "@/lib/private-upload-policy"

const CONTEXT = "introify:private-upload:v1"

export function privateUploadsDirectory(cwd = process.cwd(), configured = process.env.PRIVATE_UPLOADS_DIR) {
    return configured?.trim() ? resolve(cwd, configured.trim()) : resolve(cwd, "private-uploads")
}

function signingKey(secret: string) {
    return createHash("sha256").update(CONTEXT).update("\0").update(secret).digest()
}

export function signPrivateUpload(input: { path: readonly string[]; secret: string; nowMs?: number; ttlSeconds?: number }) {
    if (!validUploadSegments(input.path)) throw new Error("Invalid private upload path")
    const payload = {
        p: input.path,
        e: Math.floor((input.nowMs ?? Date.now()) / 1000) + (input.ttlSeconds ?? 60 * 15),
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
    const signature = createHmac("sha256", signingKey(input.secret)).update(encoded).digest("base64url")
    return `${encoded}.${signature}`
}

export function verifyPrivateUpload(input: { token: string; path: readonly string[]; secret: string; nowMs?: number }) {
    if (!input.token || input.token.length > 2048 || !validUploadSegments(input.path)) return false
    const [encoded, suppliedSignature, extra] = input.token.split(".")
    if (!encoded || !suppliedSignature || extra !== undefined) return false
    const expected = createHmac("sha256", signingKey(input.secret)).update(encoded).digest()
    let supplied: Buffer
    try { supplied = Buffer.from(suppliedSignature, "base64url") } catch { return false }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false
    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { p: string[]; e: number }
        if (!Array.isArray(payload.p) || payload.p.join("/") !== input.path.join("/")) return false
        if (payload.e <= Math.floor((input.nowMs ?? Date.now()) / 1000)) return false
        return true
    } catch {
        return false
    }
}
