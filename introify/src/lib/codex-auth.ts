import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { readFile, writeFile, mkdir } from "node:fs/promises"

export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
export const CODEX_TOKEN_REFRESH_URL = "https://auth.openai.com/oauth/token"
const AUTH_CLAIM = "https://api.openai.com/auth"

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

export async function loadCodexCredentials(path = codexAuthPath()): Promise<CodexCredentials> {
    let text: string
    try {
        text = await readFile(path, "utf8")
    } catch {
        throw new CodexAuthError(`No ChatGPT credentials at ${path}; run \`codex login\`.`)
    }
    try {
        return readCodexCredentialsFromObject(JSON.parse(text))
    } catch (err) {
        if (err instanceof CodexAuthError) throw err
        throw new CodexAuthError(`Could not read ChatGPT credentials at ${path}.`)
    }
}

export async function refreshCodexCredentials(
    credentials: CodexCredentials,
    path = codexAuthPath(),
): Promise<CodexCredentials> {
    if (!credentials.refreshToken) {
        throw new CodexAuthError("ChatGPT access token was rejected; run `codex login`.")
    }
    const res = await fetch(CODEX_TOKEN_REFRESH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: CODEX_OAUTH_CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: credentials.refreshToken,
        }),
    })
    if (!res.ok) {
        throw new CodexAuthError(`ChatGPT token refresh failed (HTTP ${res.status}); run \`codex login\`.`)
    }
    const refreshed = await res.json() as Record<string, unknown>
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
    await persistRefreshedTokens(path, refreshed).catch(() => {})
    return next
}

async function persistRefreshedTokens(path: string, refreshed: Record<string, unknown>) {
    let payload: Record<string, unknown> = {}
    try {
        payload = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
    } catch {
        payload = {}
    }
    const tokens = payload.tokens && typeof payload.tokens === "object"
        ? { ...(payload.tokens as Record<string, unknown>) }
        : {}
    for (const key of ["id_token", "access_token", "refresh_token"] as const) {
        const value = refreshed[key]
        if (typeof value === "string" && value) tokens[key] = value
    }
    payload.tokens = tokens
    payload.last_refresh = new Date().toISOString()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 })
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
