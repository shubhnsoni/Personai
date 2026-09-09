// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn(), completion: vi.fn() }))
vi.mock("@/lib/ai-usage", async original => ({ ...await original<typeof import("@/lib/ai-usage")>(), prepareAiUsage: mocks.reserve, finishAiUsage: mocks.settle }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: vi.fn(), reserveUsage: vi.fn(), settleUsage: vi.fn() }))
vi.mock("@/lib/ai-runtime", async original => ({ ...await original<typeof import("@/lib/ai-runtime")>(), apiClient: () => ({ chat: { completions: { create: mocks.completion } } }) }))
import { extractWithModel } from "@/lib/import-llm"
const recipe = { mode: "fast", provider: "openai", model: "gpt-4o-mini", inputBudget: 2000, outputBudget: 500, inputUsdPerMillion: null, outputUsdPerMillion: null }
beforeEach(() => {
    vi.clearAllMocks()
    mocks.reserve.mockResolvedValue({ id: "one", recipe, autoMemory: false })
    mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: '{"items":[{"kind":"profile","title":"Studio","fields":{"displayName":"Studio"}}]}' } }], usage: { prompt_tokens: 200, completion_tokens: 40 } })
})
describe("metered owner imports", () => {
    it("cannot bypass an unavailable or duplicate allowance", async () => {
        mocks.reserve.mockRejectedValue(new Error("no credits"))
        await expect(extractWithModel("shop", "Studio")).rejects.toThrow()
        expect(mocks.completion).not.toHaveBeenCalled()
    })
    it("uses one bounded Fast request and records its usage", async () => {
        expect(await extractWithModel("shop", "Studio".repeat(10000))).toHaveLength(1)
        expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ profileId: "shop", storedModel: "fast" }))
        expect(mocks.completion).toHaveBeenCalledOnce()
        const input = mocks.completion.mock.calls[0][0]
        expect(Buffer.byteLength(JSON.stringify(input.messages))).toBeLessThan(2000)
        expect(input.max_completion_tokens).toBe(500)
        expect(mocks.settle).toHaveBeenCalledWith("one", "CONSUME", expect.objectContaining({ inputTokens: 200, outputTokens: 40, model: recipe.model }))
    })
    it("uses a stable content-scoped idempotency key", async () => {
        await extractWithModel("shop", "Studio")
        await extractWithModel("shop", "Studio")
        expect(mocks.reserve.mock.calls[0][0].operationKey).toBe(mocks.reserve.mock.calls[1][0].operationKey)
    })
    it("releases unusable structured output with a cost receipt", async () => {
        mocks.completion.mockResolvedValue({ model: recipe.model, choices: [{ message: { content: "invalid" } }], usage: { prompt_tokens: 200, completion_tokens: 40 } })
        expect(await extractWithModel("shop", "Studio")).toEqual([])
        expect(mocks.settle).toHaveBeenCalledWith("one", "RELEASE", expect.objectContaining({ reason: "invalid_structured_output", outputTokens: 40 }))
    })
    it("holds a provider timeout for reconciliation", async () => {
        mocks.completion.mockRejectedValue(new Error("timeout"))
        await expect(extractWithModel("shop", "Studio")).rejects.toThrow()
        expect(mocks.settle).not.toHaveBeenCalled()
    })
})
