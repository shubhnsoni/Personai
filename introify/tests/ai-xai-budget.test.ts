// @vitest-environment node
import type OpenAI from "openai"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ responses: vi.fn(), chat: vi.fn() }))
vi.mock("openai", () => ({ default: class OpenAI { responses = { create: mocks.responses }; chat = { completions: { create: mocks.chat } } } }))
import { boundedChatInput, boundedXaiChatStream, resolveApiRecipe } from "@/lib/ai-runtime"
beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("INTROIFY_AI_PROVIDER", "xai")
    vi.stubEnv("XAI_API_KEY", "xai-test-only-key-never-real")
    vi.stubEnv("OPENAI_API_KEY", "")
    vi.stubEnv("CODEX_DISABLED", "1")
    vi.stubEnv("INTROIFY_AI_DISABLED", "false")
    vi.stubEnv("INTROIFY_AI_FAST_MODEL", "grok-4.3")
    mocks.responses.mockResolvedValue({ id: "reply", model: "grok-4.3", created_at: 1, output: [{ type: "message", content: [{ type: "output_text", text: "Hello" }] }], usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180, output_tokens_details: { reasoning_tokens: 60 } } })
})
describe("xAI total generation budget", () => {
    it("uses Responses output budget including reasoning rather than the visible-text-only chat budget", async () => {
        const recipe = resolveApiRecipe("fast")!
        const stream = await boundedXaiChatStream(boundedChatInput(recipe, "Facts", [{ role: "user", content: "Hello" }], []), recipe)
        const chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] = []
        for await (const chunk of stream) chunks.push(chunk)
        expect(mocks.chat).not.toHaveBeenCalled()
        expect(mocks.responses).toHaveBeenCalledOnce()
        expect(mocks.responses).toHaveBeenCalledWith(expect.objectContaining({ max_output_tokens: 500, store: false, stream: false, parallel_tool_calls: false, tools: [] }))
        expect(chunks[1].usage).toMatchObject({ prompt_tokens: 100, completion_tokens: 80, completion_tokens_details: { reasoning_tokens: 60 } })
    })
    it("forwards only local function definitions and never provider-hosted search tools", async () => {
        const recipe = resolveApiRecipe("fast")!
        const bounded = boundedChatInput(recipe, "Facts", [{ role: "user", content: "show menu" }], [{ type: "function", function: { name: "showMenu", parameters: { type: "object", properties: {} } } }])
        await boundedXaiChatStream(bounded, recipe)
        expect(mocks.responses.mock.calls[0][0].tools).toEqual([{ type: "function", name: "showMenu", description: undefined, parameters: { type: "object", properties: {} }, strict: false }])
    })
    it("treats a placeholder key as unavailable", () => {
        vi.stubEnv("XAI_API_KEY", "replace_this_with_your_key")
        expect(resolveApiRecipe("fast")).toBeNull()
    })
    it("maps retired grok-3 names onto live Grok models", () => {
        vi.stubEnv("INTROIFY_AI_FAST_MODEL", "grok-3-mini")
        expect(resolveApiRecipe("fast")).toMatchObject({ provider: "xai", model: "grok-4.3" })
        vi.stubEnv("INTROIFY_AI_FAST_MODEL", "")
        expect(resolveApiRecipe("fast")).toMatchObject({ provider: "xai", model: "grok-4.6" })
    })
})
