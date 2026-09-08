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
