// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    fetch: vi.fn(),
    load: vi.fn(),
    hasSource: vi.fn(),
    enabled: vi.fn(),
}))

vi.mock("@/lib/codex-auth", () => ({
    isCodexEnabled: mocks.enabled,
    hasCodexAuthSource: mocks.hasSource,
    loadCodexCredentials: mocks.load,
}))

const { wakeCodexConnection, startCodexKeepAlive, stopCodexKeepAlive } = await import("@/lib/codex-transport")

beforeEach(() => {
    vi.clearAllMocks()
    stopCodexKeepAlive()
    mocks.enabled.mockReturnValue(true)
    mocks.hasSource.mockReturnValue(true)
    mocks.load.mockResolvedValue({ accessToken: "tok", refreshToken: "r", accountId: "acct", idToken: "" })
    mocks.fetch.mockResolvedValue(new Response(null, { status: 405 }))
    vi.stubGlobal("fetch", mocks.fetch)
    vi.stubEnv("INTROIFY_AI_DISABLED", "false")
})

afterEach(() => {
    stopCodexKeepAlive()
})

describe("Codex keep-alive", () => {
    it("preloads credentials and pokes Codex without sending a chat", async () => {
        await wakeCodexConnection()
        expect(mocks.load).toHaveBeenCalledTimes(1)
        expect(mocks.fetch).toHaveBeenCalled()
        const urls = mocks.fetch.mock.calls.map(call => String(call[0]))
        expect(urls.some(url => url.includes("auth.openai.com"))).toBe(true)
        expect(urls.some(url => url.includes("chatgpt.com/backend-api/codex/responses"))).toBe(true)
        expect(mocks.fetch.mock.calls.every(call => call[1]?.method === "HEAD")).toBe(true)
    })

    it("does not start a second warm while one is in flight", async () => {
        let resolveLoad!: (value: { accessToken: string; refreshToken: string; accountId: string; idToken: string }) => void
        let loadStarted!: () => void
        const started = new Promise<void>(resolve => { loadStarted = resolve })
        mocks.load.mockImplementation(() => {
            loadStarted()
            return new Promise(resolve => { resolveLoad = resolve })
        })
        const first = wakeCodexConnection()
        await started
        const second = wakeCodexConnection()
        resolveLoad({ accessToken: "tok", refreshToken: "r", accountId: "acct", idToken: "" })
        await Promise.all([first, second])
        expect(mocks.load).toHaveBeenCalledTimes(1)
    })

    it("skips warming when commercial AI is disabled", async () => {
        vi.stubEnv("INTROIFY_AI_DISABLED", "true")
        await wakeCodexConnection()
        expect(mocks.load).not.toHaveBeenCalled()
        expect(mocks.fetch).not.toHaveBeenCalled()
    })

    it("can be started more than once without throwing", () => {
        expect(() => {
            startCodexKeepAlive()
            startCodexKeepAlive()
            stopCodexKeepAlive()
        }).not.toThrow()
    })
})
