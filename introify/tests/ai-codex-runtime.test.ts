// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), stream: vi.fn(), billing: vi.fn(), reserve: vi.fn() }))
vi.mock("@/lib/codex-auth", () => ({ hasCodexAuthSource: mocks.auth }))
vi.mock("@/lib/codex-chat", () => ({ streamCodexChat: mocks.stream }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: mocks.billing, reserveUsage: mocks.reserve, settleUsage: vi.fn() }))
import { boundedChatInput, boundedCodexChatStream, getAiAvailability, resolveApiRecipe, usageMetadata } from "@/lib/ai-runtime"
import { prepareAiUsage } from "@/lib/ai-usage"
import { getPlan } from "@/lib/billing/catalog"

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("INTROIFY_AI_PROVIDER", "codex")
    vi.stubEnv("INTROIFY_AI_DISABLED", "false")
    vi.stubEnv("CODEX_HOME", "/app-private/codex")
    vi.stubEnv("INTROIFY_AI_FAST_MODEL", "gpt-5.6-luna")
    vi.stubEnv("INTROIFY_AI_SMART_MODEL", "gpt-5.6-terra")
    vi.stubEnv("INTROIFY_AI_REASONING_MODEL", "gpt-5.6-sol")
    mocks.auth.mockReturnValue(true)
    mocks.billing.mockResolvedValue({ planId: "free", features: getPlan("free").features })
    mocks.reserve.mockResolvedValue({ created: true, state: "RESERVED", id: "credit" })
    mocks.stream.mockResolvedValue({ async *[Symbol.asyncIterator]() { yield { choices: [{ delta: { content: "Business facts" } }] } } })
})

describe("explicit Codex production provider", () => {
    it("connects each approved mode and reserves Free credits before dispatch", async () => {
        expect(getAiAvailability()).toEqual({ fast: true, smart: true, reasoning: true })
        const reservation = await prepareAiUsage({ profileId: "shop", storedModel: "fast", operationKey: "one" })
        expect(reservation.recipe).toMatchObject({ provider: "codex", model: "gpt-5.6-luna" })
        expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ amount: 1, profileId: "shop", metadata: expect.objectContaining({ provider: "codex" }) }))
        await boundedCodexChatStream(boundedChatInput(reservation.recipe, "Facts", [{ role: "user", content: "Hello" }], []), reservation.recipe)
        expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5.6-luna", max_completion_tokens: 500, parallel_tool_calls: false }), expect.any(Object))
    })
    it("keeps premium models gated on Free", async () => {
        await expect(prepareAiUsage({ profileId: "shop", storedModel: "reasoning", operationKey: "one" })).rejects.toMatchObject({ status: 403 })
        expect(mocks.reserve).not.toHaveBeenCalled()
        expect(mocks.stream).not.toHaveBeenCalled()
    })
    it.each(["disabled", "missing-auth", "missing-home", "unmapped", "wrong-tier"])("fails closed when %s", reason => {
        if (reason === "disabled") vi.stubEnv("INTROIFY_AI_DISABLED", "true")
        if (reason === "missing-auth") mocks.auth.mockReturnValue(false)
        if (reason === "missing-home") vi.stubEnv("CODEX_HOME", "")
        if (reason === "unmapped") vi.stubEnv("INTROIFY_AI_FAST_MODEL", "")
        if (reason === "wrong-tier") vi.stubEnv("INTROIFY_AI_FAST_MODEL", "gpt-5.6-sol")
        expect(resolveApiRecipe("fast")).toBeNull()
    })
    it("rejects stale or caller-substituted models", async () => {
        const recipe = resolveApiRecipe("fast")!
        const input = boundedChatInput(recipe, "Facts", [{ role: "user", content: "Hello" }], [])
        await expect(boundedCodexChatStream({ ...input, model: "gpt-5.6-sol" }, recipe)).rejects.toThrow("ai_not_configured")
        vi.stubEnv("INTROIFY_AI_DISABLED", "true")
        await expect(boundedCodexChatStream(input, recipe)).rejects.toThrow("ai_not_configured")
        expect(mocks.stream).not.toHaveBeenCalled()
    })
    it("records actual token usage without assigning API token prices to subscription access", () => {
        vi.stubEnv("INTROIFY_AI_FAST_INPUT_USD_PER_MTOK", "2")
        vi.stubEnv("INTROIFY_AI_FAST_OUTPUT_USD_PER_MTOK", "8")
        expect(usageMetadata(resolveApiRecipe("fast")!, 120, 30)).toMatchObject({ provider: "codex", usageKnown: true, costKnown: false, estimatedCostMicros: null })
    })
})
