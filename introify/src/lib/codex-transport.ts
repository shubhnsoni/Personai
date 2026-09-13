const CODEX_ORIGIN = "https://chatgpt.com"
const AUTH_ORIGIN = "https://auth.openai.com"
const WARM_INTERVAL_MS = 4 * 60 * 1000
const WARM_RETRY_MS = 30_000

type Dispatcher = { close?: () => void }
let dispatcher: Dispatcher | null = null
let undiciFetch: typeof fetch | null = null

let warming: Promise<unknown> | null = null
let lastWarmAt = 0
let timer: ReturnType<typeof setInterval> | null = null

async function productionFetch(): Promise<typeof fetch> {
    if (undiciFetch) return undiciFetch
    const undici = await import("undici")
    dispatcher = new undici.Agent({
        keepAliveTimeout: 60_000,
        keepAliveMaxTimeout: 10 * 60_000,
        connections: 4,
        pipelining: 1,
    })
    undiciFetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        undici.fetch(input as never, { ...(init as object), dispatcher } as never)) as unknown as typeof fetch
    return undiciFetch
}

export async function codexFetch(input: string | URL, init?: RequestInit): Promise<Response> {
    if (process.env.VITEST) return fetch(input, init)
    const run = await productionFetch()
    return run(input, init)
}

async function warmOnce() {
    if (warming) return warming
    warming = (async () => {
        try {
            const { isCodexEnabled, hasCodexAuthSource, loadCodexCredentials } = await import("@/lib/codex-auth")
            if (!isCodexEnabled() || !hasCodexAuthSource()) return
            const credentials = await loadCodexCredentials()
            const now = Date.now()
            const pokes: Promise<unknown>[] = [
                codexFetch(`${AUTH_ORIGIN}/oauth/token`, { method: "HEAD", signal: AbortSignal.timeout(8_000) }).catch(() => null),
            ]
            if (credentials.accessToken) {
                pokes.push(codexFetch(`${CODEX_ORIGIN}/backend-api/codex/responses`, {
                    method: "HEAD",
                    headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    signal: AbortSignal.timeout(8_000),
                }).catch(() => null))
            }
            await Promise.allSettled(pokes)
            lastWarmAt = now
        } finally {
            warming = null
        }
    })()
    return warming
}

export function wakeCodexConnection() {
    if (process.env.INTROIFY_AI_DISABLED === "true") return Promise.resolve()
    if (Date.now() - lastWarmAt < 15_000 && !warming) return Promise.resolve()
    return warmOnce().catch(() => {})
}

export function startCodexKeepAlive() {
    if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return
    if (timer) return
    void wakeCodexConnection()
    timer = setInterval(() => { void wakeCodexConnection() }, WARM_INTERVAL_MS)
    timer.unref?.()
}

export function stopCodexKeepAlive() {
    if (timer) clearInterval(timer)
    timer = null
    lastWarmAt = 0
    warming = null
}

export const CODEX_KEEPALIVE = { WARM_INTERVAL_MS, WARM_RETRY_MS }
