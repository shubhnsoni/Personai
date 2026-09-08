import * as fs from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadCodexCredentials, refreshCodexCredentials } from "@/lib/codex-auth"

const directories: string[] = []
const seed = (access = "seed-access", refresh = "seed-refresh") => ({
    auth_mode: "chatgpt",
    tokens: { access_token: access, refresh_token: refresh, account_id: "test-account" },
})

async function authFile() {
    const directory = await fs.mkdtemp(join(tmpdir(), "introify-auth-test-"))
    directories.push(directory)
    vi.stubEnv("CODEX_HOME", directory)
    return join(directory, "auth.json")
}

beforeEach(() => {
    vi.stubEnv("CODEX_AUTH_JSON", "")
    vi.stubEnv("CODEX_AUTH_REVISION", "")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected provider call")))
})

afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    for (const directory of directories.splice(0)) {
        // Only remove directories this test created directly inside the OS temp directory.
        if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith("introify-auth-test-")) {
            throw new Error("Unexpected test cleanup directory")
        }
        await fs.rm(directory, { recursive: true, force: true })
    }
})

describe("Codex environment seed lifecycle", () => {
    it("seeds once and preserves rotated tokens on repeated loads", async () => {
        const path = await authFile()
        vi.stubEnv("CODEX_AUTH_JSON", JSON.stringify(seed()))
        const initial = await loadCodexCredentials(path)
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" }))
        await refreshCodexCredentials(initial, path)

        expect((await loadCodexCredentials(path)).accessToken).toBe("rotated-access")
        expect((await loadCodexCredentials(path)).refreshToken).toBe("rotated-refresh")
        expect(fetch).toHaveBeenCalledTimes(1)
        const saved = JSON.parse(await fs.readFile(path, "utf8"))
        expect(saved.auth_mode).toBe("chatgpt")
        expect(saved.last_refresh).toEqual(expect.any(String))
        expect(saved._introify_auth_source.fingerprint).toMatch(/^[a-f0-9]{64}$/)
        if (process.platform !== "win32") expect((await fs.stat(path)).mode & 0o777).toBe(0o600)
        expect(await fs.readdir(dirname(path))).toEqual(["auth.json"])
    })

    it("replaces saved tokens once when the environment seed changes", async () => {
        const path = await authFile()
        vi.stubEnv("CODEX_AUTH_JSON", JSON.stringify(seed()))
        await loadCodexCredentials(path)
        vi.stubEnv("CODEX_AUTH_JSON", Buffer.from(JSON.stringify(seed("new-access", "new-refresh"))).toString("base64"))
        const replaced = await loadCodexCredentials(path)
        expect(replaced.accessToken).toBe("new-access")

        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "newer-access", refresh_token: "newer-refresh" }))
        await refreshCodexCredentials(replaced, path)
        expect((await loadCodexCredentials(path)).accessToken).toBe("newer-access")
    })

    it("adopts legacy saved tokens without rolling them back to an old environment seed", async () => {
        const path = await authFile()
        await fs.writeFile(path, JSON.stringify(seed("legacy-rotated", "legacy-refresh")))
        vi.stubEnv("CODEX_AUTH_JSON", JSON.stringify(seed()))
        expect((await loadCodexCredentials(path)).accessToken).toBe("legacy-rotated")
        expect(JSON.parse(await fs.readFile(path, "utf8"))._introify_auth_source).toBeDefined()
    })

    it("allows an explicit revision to replace a legacy file without resetting it every load", async () => {
        const path = await authFile()
        await fs.writeFile(path, JSON.stringify(seed("legacy-access", "legacy-refresh")))
        vi.stubEnv("CODEX_AUTH_JSON", JSON.stringify(seed()))
        vi.stubEnv("CODEX_AUTH_REVISION", "replacement-1")
        const replaced = await loadCodexCredentials(path)
        expect(replaced.accessToken).toBe("seed-access")
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" }))
        await refreshCodexCredentials(replaced, path)
        expect((await loadCodexCredentials(path)).accessToken).toBe("rotated-access")
        vi.stubEnv("CODEX_AUTH_REVISION", "replacement-2")
        expect((await loadCodexCredentials(path)).accessToken).toBe("seed-access")
    })

    it("keeps ordinary local credentials file-based when no seed is configured", async () => {
        const path = await authFile()
        vi.stubEnv("NODE_ENV", "development")
        const payload = seed("local-access", "local-refresh")
        await fs.writeFile(path, JSON.stringify(payload))
        expect((await loadCodexCredentials(path)).accessToken).toBe("local-access")
        expect(JSON.parse(await fs.readFile(path, "utf8"))).toEqual(payload)
        expect(fetch).not.toHaveBeenCalled()
    })
})

describe("Codex refresh concurrency and persistence", () => {
    it.each(["request", "body"])("times out a stalled refresh %s and releases queued credential reads", async (phase) => {
        const path = await authFile()
        await fs.writeFile(path, JSON.stringify(seed()))
        const initial = await loadCodexCredentials(path)
        vi.useFakeTimers()
        vi.mocked(fetch).mockImplementationOnce((_url, init) => {
            const waitForAbort = () => new Promise<never>((_resolve, reject) => {
                init!.signal!.addEventListener("abort", () => reject(new Error("mock request aborted")), { once: true })
            })
            return phase === "request" ? waitForAbort() : Promise.resolve({ ok: true, json: waitForAbort } as unknown as Response)
        })
        const refresh = refreshCodexCredentials(initial, path)
        const timedOut = expect(refresh).rejects.toThrow("token refresh timed out")
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
        const queuedRead = loadCodexCredentials(path)
        await vi.advanceTimersByTimeAsync(30_000)
        await timedOut
        expect((await queuedRead).accessToken).toBe("seed-access")

        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "retry-access" }))
        expect((await refreshCodexCredentials(initial, path)).accessToken).toBe("retry-access")
        expect(vi.getTimerCount()).toBe(0)
    })

    it("shares a concurrent refresh and reuses its result for a late 401", async () => {
        const path = await authFile()
        await fs.writeFile(path, JSON.stringify(seed()))
        const initial = await loadCodexCredentials(path)
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" }))
        const results = await Promise.all(Array.from({ length: 12 }, () => refreshCodexCredentials(initial, path)))
        expect(results.every((result) => result.accessToken === "rotated-access")).toBe(true)
        expect((await refreshCodexCredentials(initial, path)).accessToken).toBe("rotated-access")
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).refresh_token).toBe("seed-refresh")
    })

    it("shares refresh failures and releases the lock for a later retry", async () => {
        const path = await authFile()
        await fs.writeFile(path, JSON.stringify(seed()))
        const initial = await loadCodexCredentials(path)
        vi.mocked(fetch).mockResolvedValueOnce(new Response("rejected", { status: 401 }))
        const results = await Promise.allSettled(Array.from({ length: 5 }, () => refreshCodexCredentials(initial, path)))
        expect(results.every((result) => result.status === "rejected")).toBe(true)
        expect(fetch).toHaveBeenCalledTimes(1)
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "retry-access" }))
        expect((await refreshCodexCredentials(initial, path)).accessToken).toBe("retry-access")
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("fails production refresh when atomic replacement fails, preserving the complete old file", async () => {
        const path = await authFile()
        await fs.writeFile(path, JSON.stringify(seed()))
        const initial = await loadCodexCredentials(path)
        const backup = join(dirname(path), "auth.before.json")
        vi.mocked(fetch).mockImplementationOnce(async () => {
            // Make replacement fail after loading the old credentials, on every OS.
            await fs.rename(path, backup)
            await fs.mkdir(path)
            return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" })
        })
        await expect(refreshCodexCredentials(initial, path)).rejects.toThrow("CODEX_HOME must be writable")
        expect(JSON.parse(await fs.readFile(backup, "utf8"))).toEqual(seed())
        expect((await fs.readdir(dirname(path))).sort()).toEqual(["auth.before.json", "auth.json"])
    })

    it("fails production seeding when credentials cannot be persisted", async () => {
        const path = await authFile()
        vi.stubEnv("CODEX_AUTH_JSON", JSON.stringify(seed()))
        await fs.mkdir(path)
        await expect(loadCodexCredentials(path)).rejects.toThrow("CODEX_HOME must be writable")
        expect(await fs.readdir(dirname(path))).toEqual(["auth.json"])
    })

    it("preserves optional token fields omitted by a refresh response", async () => {
        const path = await authFile()
        const payload = seed()
        await fs.writeFile(path, JSON.stringify({ ...payload, tokens: { ...payload.tokens, id_token: "original-id" } }))
        const initial = await loadCodexCredentials(path)
        vi.mocked(fetch).mockResolvedValueOnce(Response.json({ access_token: "rotated-access" }))
        const refreshed = await refreshCodexCredentials(initial, path)
        expect(refreshed).toEqual({ accessToken: "rotated-access", refreshToken: "seed-refresh", idToken: "original-id", accountId: "test-account" })
        expect(await loadCodexCredentials(path)).toEqual(refreshed)
    })
})
