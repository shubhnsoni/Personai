import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { streamCodexChat } from "@/lib/codex-chat"

let directory: string

beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "introify-stream-test-"))
    vi.stubEnv("CODEX_HOME", directory)
    vi.stubEnv("CODEX_AUTH_JSON", "")
    await writeFile(join(directory, "auth.json"), JSON.stringify({ tokens: { access_token: "mock-access" } }))
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected provider call")))
})

afterEach(async () => {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith("introify-stream-test-")) {
        throw new Error("Unexpected test cleanup directory")
    }
    await rm(directory, { recursive: true, force: true })
})

function mockEvents(events: unknown[]) {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        { headers: { "Content-Type": "text/event-stream" } },
    ))
}

async function readReply() {
    const response = await streamCodexChat({
        model: "test-model", stream: true, messages: [{ role: "user", content: "ping" }],
    })
    let text = ""
    for await (const chunk of response) text += chunk.choices[0]?.delta?.content || ""
    return text
}

describe("Codex stream completion status", () => {
    it("aborts a provider that never responds within the request deadline", async () => {
        vi.useFakeTimers()
        try {
            vi.mocked(fetch).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
                options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
            }))
            const result = readReply()
            const assertion = expect(result).rejects.toThrow("aborted")
            // Credentials are loaded from the isolated file before dispatch.
            await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
            await vi.advanceTimersByTimeAsync(45_000)
            await assertion
            expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
        } finally { vi.useRealTimers() }
    })
    it("recognizes credential errors before dispatch as unspent", async () => {
        await writeFile(join(directory, "auth.json"), "{}")
        await expect(readReply()).rejects.toMatchObject({ providerNotDispatched: true })
        expect(fetch).not.toHaveBeenCalled()
    })

    it("releases an explicit401 when the login cannot be refreshed", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
        await expect(readReply()).rejects.toMatchObject({ status: 401, message: "Codex login needs renewal." })
        expect(fetch).toHaveBeenCalledTimes(1)
    })
    it("rejects a truncated stream even after receiving text", async () => {
        mockEvents([{ type: "response.output_text.delta", delta: "partial" }])
        await expect(readReply()).rejects.toThrow("ended before completing")
    })

    it("emits measured usage from the final event, including an unterminated final line", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('data: {"type":"response.completed","response":{"model":"actual-model","usage":{"input_tokens":120,"output_tokens":30,"total_tokens":150,"output_tokens_details":{"reasoning_tokens":10}}}}'))
        const response = await streamCodexChat({ model: "test-model", stream: true, messages: [{ role: "user", content: "ping" }] })
        const chunks: unknown[] = []
        for await (const chunk of response) chunks.push(chunk)
        expect(chunks).toEqual([expect.objectContaining({ model: "actual-model", choices: [], usage: expect.objectContaining({ prompt_tokens: 120, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 10 } }) })])
    })

    it("cancels an oversized reply", async () => {
        mockEvents([{ type: "response.output_text.delta", delta: "x".repeat(20_000) }, { type: "response.completed" }])
        await expect(readReply()).rejects.toThrow("response limit")
        expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
    })

    it("preserves an explicit rejection status without echoing upstream secrets", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response("private upstream account details", { status: 429 }))
        await expect(readReply()).rejects.toMatchObject({ status: 429, message: "Codex chat failed (HTTP 429)." })
    })

    it("aborts upstream when the reader disconnects", async () => {
        mockEvents([{ type: "response.output_text.delta", delta: "hello" }, { type: "response.completed" }])
        for await (const _chunk of await streamCodexChat({ model: "test-model", stream: true, messages: [{ role: "user", content: "ping" }] })) break
        expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
    })
    it.each(["error", "response.failed", "response.incomplete"])("rejects upstream %s events without exposing upstream details", async (type) => {
        mockEvents([{ type, error: { message: "private upstream account details" } }])
        await expect(readReply()).rejects.toThrow(type === "response.incomplete"
            ? "Codex chat ended before completing a response."
            : "Codex chat could not complete the response.")
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("does not count partial text followed by a failed event as a complete response", async () => {
        mockEvents([
            { type: "response.output_text.delta", delta: "partial reply" },
            { type: "response.failed", response: { error: { message: "private upstream details" } } },
        ])
        await expect(readReply()).rejects.toThrow("Codex chat could not complete the response.")
    })

    it("continues to yield completed text normally", async () => {
        mockEvents([
            { type: "response.output_text.delta", delta: "po" },
            { type: "response.output_text.delta", delta: "ng" },
            { type: "response.completed" },
        ])
        await expect(readReply()).resolves.toBe("pong")
    })
})
