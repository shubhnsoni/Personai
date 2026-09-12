// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const billing = vi.hoisted(() => ({ get: vi.fn(), reserve: vi.fn(), settle: vi.fn() }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: billing.get, reserveUsage: billing.reserve, settleUsage: billing.settle }))
import { prepareAiUsage } from "@/lib/ai-usage"
import { boundedChatInput, resolveApiRecipe, usageMetadata } from "@/lib/ai-runtime"
import { getPlan } from "@/lib/billing/catalog"
import { validateAiSettings, permittedPersonality } from "@/lib/ai-settings"

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("INTROIFY_AI_PROVIDER", "openai")
    vi.stubEnv("OPENAI_API_KEY", "sk-unit-test-not-real-12345")
    vi.stubEnv("XAI_API_KEY", "")
    vi.stubEnv("CODEX_DISABLED", "1")
    vi.stubEnv("INTROIFY_AI_DISABLED", "false")
    vi.stubEnv("INTROIFY_AI_FAST_MODEL", "gpt-4o-mini")
    vi.stubEnv("INTROIFY_AI_SMART_MODEL", "gpt-4o")
    vi.stubEnv("INTROIFY_AI_REASONING_MODEL", "o3")
    billing.get.mockResolvedValue({ planId: "free", features: getPlan("free").features })
    billing.reserve.mockResolvedValue({ id: "reservation", state: "RESERVED", created: true })
})

describe("server AI entitlements", () => {
    it("uses catalog units and a single server reservation", async () => {
        await expect(prepareAiUsage({ profileId: "shop", storedModel: "gpt-4o-mini", operationKey: "one" })).resolves.toMatchObject({ id: "reservation", autoMemory: false, recipe: { mode: "fast" } })
        expect(billing.reserve).toHaveBeenCalledWith(expect.objectContaining({ profileId: "shop", amount: 1, unit: "AI", operationKey: "one" }))
    })
    it.each(["smart", "reasoning", "arbitrary-expensive-model"])("rejects unentitled or unapproved mode %s before reserving", async storedModel => {
        await expect(prepareAiUsage({ profileId: "shop", storedModel, operationKey: "one" })).rejects.toMatchObject({ status: 403 })
        expect(billing.reserve).not.toHaveBeenCalled()
    })
    it("allows approved premium mode only for paid entitlement", async () => {
        billing.get.mockResolvedValue({ planId: "pro", features: getPlan("pro").features })
        await expect(prepareAiUsage({ profileId: "shop", storedModel: "reasoning", operationKey: "one" })).resolves.toMatchObject({ autoMemory: true })
        expect(billing.reserve).toHaveBeenCalledWith(expect.objectContaining({ amount: 40 }))
    })
    it("reports exhausted credits as an honest handoff", async () => {
        billing.reserve.mockRejectedValue(new Error("Not enough AI credits. Manage your plan or add a pack in Billing."))
        await expect(prepareAiUsage({ profileId: "shop", operationKey: "one" })).rejects.toMatchObject({ status: 402, code: "ai_allowance_exhausted" })
    })
    it("fails closed when the ledger is unavailable", async () => {
        billing.get.mockRejectedValue(new Error("database offline"))
        await expect(prepareAiUsage({ profileId: "shop", operationKey: "one" })).rejects.toThrow()
        expect(billing.reserve).not.toHaveBeenCalled()
    })
    it.each(["RESERVED", "CONSUMED", "RELEASED"])("does not treat existing %s reservation as another permit", async state => {
        billing.reserve.mockResolvedValue({ id: "reservation", state, created: false })
        await expect(prepareAiUsage({ profileId: "shop", operationKey: "one" })).rejects.toMatchObject({ status: 409 })
    })
    it("does not use a Codex session or default model when API mapping is absent", async () => {
        vi.stubEnv("INTROIFY_AI_PROVIDER", "codex")
        vi.stubEnv("OPENAI_API_KEY", "")
        vi.stubEnv("XAI_API_KEY", "")
        expect(resolveApiRecipe("fast")).toBeNull()
        await expect(prepareAiUsage({ profileId: "shop", operationKey: "one" })).rejects.toMatchObject({ status: 503 })
        expect(billing.reserve).not.toHaveBeenCalled()
    })
    it("rejects a provider model outside its mode allowlist", () => {
        vi.stubEnv("INTROIFY_AI_FAST_MODEL", "o3")
        expect(resolveApiRecipe("fast")).toBeNull()
    })
    it.each(["fast", "smart", "reasoning"] as const)("bounds full serialized %s input including escaped text and tool schemas", mode => {
        const recipe = resolveApiRecipe(mode)!
        const input = boundedChatInput(recipe, "facts".repeat(10000), Array.from({length: 50}, () => ({role: "user", content: '\\"'.repeat(10000)})), [{ type: "function", function: { name: "collectLead", parameters: { description: "schema".repeat(10000) } } }])
        expect(Buffer.byteLength(JSON.stringify({ messages: input.messages, tools: input.tools || [] }))).toBeLessThanOrEqual(recipe.inputBudget - 256)
        expect(input.max_completion_tokens).toBe(recipe.outputBudget)
        expect(input.messages.length).toBeLessThanOrEqual(5)
        expect(input.tools?.length || 0).toBeLessThanOrEqual(1)
    })
    it("records measured tokens and explicit unknown cost without fabricating zero cost", () => {
        const recipe = resolveApiRecipe("fast")!
        expect(usageMetadata({ ...recipe, inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 }, 1000, 500)).toMatchObject({ estimatedCostMicros: 450, costKnown: true })
        expect(usageMetadata(recipe, null, null)).toMatchObject({ usageKnown: false, costKnown: false, estimatedCostMicros: null })
    })
    it("validates direct profile model and memory writes", () => {
        expect(() => validateAiSettings("free", { aiModel: "reasoning" })).toThrow()
        expect(() => validateAiSettings("starter", { autoMemoryEnabled: true })).toThrow()
        expect(validateAiSettings("pro", { aiModel: "gpt-5.6-sol", autoMemoryEnabled: true })).toMatchObject({ aiModel: "reasoning", autoMemoryEnabled: true })
        expect(validateAiSettings("free", {})).toMatchObject({ autoMemoryEnabled: undefined })
        expect(JSON.parse(permittedPersonality('{"customInstructions":"paid","extras":["menu"]}', false)!)).toEqual({ extras: ["menu"] })
    })
})
