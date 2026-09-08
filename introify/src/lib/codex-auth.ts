import { existsSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises"

export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
export const CODEX_TOKEN_REFRESH_URL = "https://auth.openai.com/oauth/token"
const AUTH_CLAIM = "https://api.openai.com/auth"
const SOURCE_METADATA = "_introify_auth_source"
const REFRESH_TIMEOUT_MS = 30_000
type AuthPayload = Record<string, unknown>
const authOperations = new Map<string, Promise<unknown>>()
const refreshes = new Map<string, { accessToken: string; promise: Promise<CodexCredentials> }>()

export type CodexCredentials = {
    accessToken: string
    refreshToken: string
    accountId: string
    idToken: string
}

export class CodexAuthError extends Error {}

export function codexAuthPath() {
    const home = process.env.CODEX_HOME?.trim()
    const base = home ? home.replace(/^~(?=$|[\\/])/, homedir()) : join(homedir(), ".codex")
    return join(base, "auth.json")
}

export function isCodexEnabled() {
    if (process.env.CODEX_DISABLED === "1" || process.env.CODEX_DISABLED === "true") return false
    return true
}

/** Raw ChatGPT `auth.json` body, or standard base64 of that JSON. Hostinger env. */
export function codexAuthJsonFromEnv(): string | null {
    const raw = process.env.CODEX_AUTH_JSON?.trim()
    if (!raw) return null
    if (raw.startsWith("{")) return raw
    try {
        const decoded = Buffer.from(raw, "base64").toString("utf8").trim()
        return decoded.startsWith("{") ? decoded : null
    } catch {
        return null
    }
}

export function hasCodexAuthSource() {
    if (!isCodexEnabled()) return false
    if (codexAuthJsonFromEnv()) return true
    return existsSync(codexAuthPath())
}

function jwtClaims(token: string): Record<string, unknown> {
    const parts = token.split(".")
    if (parts.length !== 3) return {}
    try {
        const padded = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4)
        const json = Buffer.from(padded, "base64url").toString("utf8")
        const parsed = JSON.parse(json)
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
    } catch {
        return {}
    }
}

export function accountIdFromTokens(tokens: {
    account_id?: unknown
    id_token?: unknown
    access_token?: unknown
}) {
    const explicit = typeof tokens.account_id === "string" ? tokens.account_id.trim() : ""
    if (explicit) return explicit
    for (const key of ["id_token", "access_token"] as const) {
        const claims = jwtClaims(typeof tokens[key] === "string" ? tokens[key] : "")
        const auth = claims[AUTH_CLAIM]
        if (auth && typeof auth === "object") {
            const id = (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id
            if (typeof id === "string" && id.trim()) return id.trim()
        }
    }
    return ""
}

export function readCodexCredentialsFromObject(raw: unknown): CodexCredentials {
    const bag = raw && typeof raw === "object" ? raw as Record<string, unknown> : null
    const tokens = bag?.tokens && typeof bag.tokens === "object" ? bag.tokens as Record<string, unknown> : null
    const access = typeof tokens?.access_token === "string" ? tokens.access_token.trim() : ""
    if (!access) {
        throw new CodexAuthError("No ChatGPT access token; run `codex login`.")
    }
    return {
        accessToken: access,
        refreshToken: typeof tokens?.refresh_token === "string" ? tokens.refresh_token.trim() : "",
        accountId: accountIdFromTokens(tokens || {}),
        idToken: typeof tokens?.id_token === "string" ? tokens.id_token.trim() : "",
    }
}

// One app process must not rotate the same refresh token for concurrent visitors.
// Use a dedicated CODEX_HOME for this app, not a directory shared with another client.
function withAuthLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const key = resolve(path)
    const previous = authOperations.get(key) || Promise.resolve()
    const pending = previous.catch(() => {}).then(operation)
    authOperations.set(key, pending)
    const cleanup = () => {
        if (authOperations.get(key) === pending) authOperations.delete(key)
    }
    pending.then(cleanup, cleanup)
    return pending
}

async function loadAuthPayload(path: string): Promise<AuthPayload> {
    let saved: AuthPayload | null = null
    try {
        const parsed = JSON.parse(await readFile(path, "utf8"))
        readCodexCredentialsFromObject(parsed)
        saved = parsed as AuthPayload
    } catch { /* An explicit environment seed can recover a missing/invalid file. */ }

    const fromEnv = codexAuthJsonFromEnv()
    if (fromEnv) {
        let seed: AuthPayload
        try {
            seed = JSON.parse(fromEnv) as AuthPayload
        } catch {
            throw new CodexAuthError("CODEX_AUTH_JSON is not valid JSON.")
        }
        readCodexCredentialsFromObject(seed)
        delete seed[SOURCE_METADATA]
        const source = {
            fingerprint: createHash("sha256").update(JSON.stringify(seed)).digest("hex"),
            revision: process.env.CODEX_AUTH_REVISION?.trim() || "",
        }
        const metadata = saved?.[SOURCE_METADATA]
        const previous = metadata && typeof metadata === "object"
            ? metadata as Record<string, unknown>
            : null
        const changed = previous
            ? previous.fingerprint !== source.fingerprint || previous.revision !== source.revision
            : Boolean(source.revision)
        if (!saved || changed) {
            saved = { ...seed, [SOURCE_METADATA]: source }
            await persistAuthPayload(path, saved)
        } else if (!previous) {
            // Adopt pre-upgrade files without rolling back tokens they already refreshed.
            // Set/change CODEX_AUTH_REVISION to explicitly replace such a legacy file.
            saved = { ...saved, [SOURCE_METADATA]: source }
            await persistAuthPayload(path, saved)
        }
    }
    if (!saved) {
        throw new CodexAuthError(`No ChatGPT credentials at ${path}; run \`codex login\`.`)
    }
    return saved
}

export function loadCodexCredentials(path = codexAuthPath()): Promise<CodexCredentials> {
    return withAuthLock(path, async () => readCodexCredentialsFromObject(await loadAuthPayload(path)))
}

export function refreshCodexCredentials(
    credentials: CodexCredentials,
    path = codexAuthPath(),
): Promise<CodexCredentials> {
    const key = resolve(path)
    const pending = refreshes.get(key)
    if (pending?.accessToken === credentials.accessToken) return pending.promise
    const promise = withAuthLock(path, async () => {
        const payload = await loadAuthPayload(path)
        const latest = readCodexCredentialsFromObject(payload)
        // A prior request may have rotated this token before this 401 reached us.
        if (latest.accessToken !== credentials.accessToken) return latest
        return refreshAndPersist(latest, path, payload)
    })
    refreshes.set(key, { accessToken: credentials.accessToken, promise })
    const cleanup = () => {
        if (refreshes.get(key)?.promise === promise) refreshes.delete(key)
    }
    promise.then(cleanup, cleanup)
    return promise
}

async function refreshAndPersist(
    credentials: CodexCredentials,
    path: string,
    payload: AuthPayload,
): Promise<CodexCredentials> {
    if (!credentials.refreshToken) {
        throw new CodexAuthError("ChatGPT access token was rejected; run `codex login`.")
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)
    let refreshed: Record<string, unknown>
    try {
        const res = await fetch(CODEX_TOKEN_REFRESH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                client_id: CODEX_OAUTH_CLIENT_ID,
                grant_type: "refresh_token",
                refresh_token: credentials.refreshToken,
            }),
        })
        if (!res.ok) {
            throw new CodexAuthError(`ChatGPT token refresh failed (HTTP ${res.status}); run \`codex login\`.`)
        }
        refreshed = await res.json() as Record<string, unknown>
    } catch (error) {
        if (controller.signal.aborted) throw new CodexAuthError("ChatGPT token refresh timed out; try again.")
        throw error
    } finally {
        clearTimeout(timeout)
    }
    const access = typeof refreshed.access_token === "string" ? refreshed.access_token.trim() : ""
    if (!access) throw new CodexAuthError("ChatGPT token refresh returned no access token.")
    const next: CodexCredentials = {
        accessToken: access,
        refreshToken: typeof refreshed.refresh_token === "string" && refreshed.refresh_token.trim()
            ? refreshed.refresh_token.trim()
            : credentials.refreshToken,
        idToken: typeof refreshed.id_token === "string" && refreshed.id_token.trim()
            ? refreshed.id_token.trim()
            : credentials.idToken,
        accountId: credentials.accountId,
    }
    if (!next.accountId) {
        next.accountId = accountIdFromTokens({
            id_token: next.idToken,
            access_token: next.accessToken,
        })
    }
    const tokens = payload.tokens && typeof payload.tokens === "object"
        ? { ...(payload.tokens as Record<string, unknown>) }
        : {}
    payload.tokens = {
        ...tokens,
        access_token: next.accessToken,
        refresh_token: next.refreshToken,
        id_token: next.idToken,
        account_id: next.accountId,
    }
    payload.last_refresh = new Date().toISOString()
    await persistAuthPayload(path, payload)
    return next
}

async function persistAuthPayload(path: string, payload: AuthPayload) {
    const temporary = join(dirname(path), `.introify-auth-${randomUUID()}.tmp`)
    try {
        await mkdir(dirname(path), { recursive: true, mode: 0o700 })
        await writeFile(temporary, JSON.stringify(payload, null, 2), {
            encoding: "utf8", mode: 0o600, flag: "wx",
        })
        // Readers see either complete old JSON or complete new JSON, never a partial write.
        await rename(temporary, path)
    } catch {
        if (process.env.NODE_ENV === "production") {
            throw new CodexAuthError("Could not persist ChatGPT credentials; CODEX_HOME must be writable.")
        }
        // Preserve the local CLI's prior best-effort persistence behavior.
    } finally {
        await unlink(temporary).catch(() => {})
    }
}

export async function hasCodexCredentials() {
    if (!isCodexEnabled()) return false
    try {
        await loadCodexCredentials()
        return true
    } catch {
        return false
    }
}
