// @vitest-environment node
import type { Prisma } from "@prisma/client"
import type OpenAI from "openai"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/members", () => ({ getMemberFromSession: vi.fn() }))
vi.mock("@/lib/request-currency", () => ({ getRequestCurrency: vi.fn() }))
vi.mock("@/lib/memory", () => ({ maybeSummarizeConversation: vi.fn(), visitorKeyFrom: (_email: unknown, id: string) => id ? `visitor:${id}` : null }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: vi.fn(), reserveUsage: vi.fn(), settleUsage: vi.fn() }))
vi.mock("@/lib/security", () => ({ createOwnershipFoundation: () => ({ requireOwnedResource: async () => ({ ok: false, refusal: { status: 403, code: "FORBIDDEN", message: "Access denied" } }) }), ownershipRefusalResponse: (value: { status: number }) => Response.json({ error: "Access denied" }, { status: value.status }) }))
import { createChatPostHandler, issueConversationCapability, conversationCapabilityCookieName } from "@/app/api/chat/handler"
import { AiAccessError } from "@/lib/ai-usage"

const recipe = { mode: "fast" as const, provider: "openai" as const, model: "gpt-4o-mini", inputBudget: 2000, outputBudget: 500, inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 }
const secret = "test-capability-secret-never-production"
const now = 1_780_000_000_000
const profile = { id: "shop", userId: "owner", displayName: "Studio", isPublic: true, aiModel: "fast", roleTemplate: "CONSULTANT", personalityConfig: "{}", autoMemoryEnabled: false, documents: [], workExperiences: [], projects: [], serviceOfferings: [], digitalProducts: [], courses: [], events: [], communities: [], leadMagnets: [] }
const db = {
    profile: { findUnique: vi.fn() }, conversation: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, message: { create: vi.fn() }, profileEvent: { create: vi.fn() }, profileDocument: { deleteMany: vi.fn() }, visitorLead: { create: vi.fn() },
}
const reserve = vi.fn(), settle = vi.fn(), retrieve = vi.fn(), complete = vi.fn(), summarize = vi.fn()
const chunk = (delta: unknown = { content: "A grounded answer" }, usage = false) => ({ id: "completion", object: "chat.completion.chunk", model: recipe.model, created: 1, choices: usage ? [] : [{ index: 0, delta, finish_reason: "stop", logprobs: null }], ...(usage ? { usage: { prompt_tokens: 300, completion_tokens: 20, total_tokens: 320 } } : {}) }) as OpenAI.Chat.Completions.ChatCompletionChunk
const stream = (...chunks: OpenAI.Chat.Completions.ChatCompletionChunk[]) => ({ async *[Symbol.asyncIterator]() { for (const item of chunks) yield item } })
function handler() { return createChatPostHandler({ db: db as unknown as Prisma.TransactionClient, resolveMember: async () => null, rateLimit: () => ({ allowed: true, remaining: 10 }), reserveAi: reserve, settleAi: settle, retrieve, buildPrompt: () => "Business facts", requestCurrency: async () => "USD", createCompletion: complete, summarizeConversation: summarize, providerConfigured: () => true, capabilitySecret: () => secret, now: () => now }) }
function request(data: Record<string, unknown> = {}, cookie = "", id: string | null = "one") { return new Request("https://example.test/api/chat", { method: "POST", headers: { "content-type": "application/json", ...(id ? { "Idempotency-Key": id } : {}), cookie }, body: JSON.stringify({ profileId: "shop", messages: [{ role: "user", content: "Hello" }], ...data }) }) }
function cookies() { const token = issueConversationCapability({ profileId: "shop", conversationId: "conversation", visitorId: "visitor", secret, nowMs: now }); return `pl_vid=visitor; ${conversationCapabilityCookieName("shop")}=${encodeURIComponent(token)}` }

beforeEach(() => {
    vi.clearAllMocks()
    db.profile.findUnique.mockResolvedValue(profile)
    db.conversation.create.mockResolvedValue({ id: "conversation" })
    db.conversation.findFirst.mockImplementation(async (args: { where?: { id?: string; profileId?: string; visitorId?: string | null } } = {}) => {
        const where = args.where || {}
        if (where.id && where.id !== "conversation") return null
        if (where.profileId && where.profileId !== "shop") return null
        if (where.visitorId && where.visitorId !== "visitor") return null
        return { id: "conversation", mode: "AI", visitorId: "visitor" }
    })
    db.conversation.updateMany.mockResolvedValue({ count: 1 })
    db.message.create.mockResolvedValue({ id: "saved-message" })
    db.profileEvent.create.mockResolvedValue({})
    reserve.mockResolvedValue({ id: "reservation", recipe, autoMemory: false, customInstructions: false })
    settle.mockResolvedValue(undefined)
    retrieve.mockResolvedValue([])
    complete.mockResolvedValue(stream(chunk(), chunk({}, true)))
})

describe("metered public chat", () => {
    it("cancels provider work on disconnect and does not execute a pending business tool", async () => {
        let release!: () => void
        const pending = new Promise<void>(resolve => { release = resolve })
        let finished!: () => void
        const done = new Promise<void>(resolve => { finished = resolve })
        complete.mockResolvedValue({ async *[Symbol.asyncIterator]() {
            try {
                yield chunk({ content: "Checking" })
                await pending
                yield chunk({ tool_calls: [{ index: 0, id: "tool", function: { name: "collectLead", arguments: '{"name":"Ada","email":"ada@example.test"}' } }] })
            } finally { finished() }
        } })
        const response = await handler()(request({ messages: [{ role: "user", content: "Ada ada@example.test" }] }))
        const reader = response.body!.getReader()
        await reader.read()
        await reader.cancel()
        expect(complete.mock.calls[0][2].aborted).toBe(true)
        release()
        await done
        expect(db.visitorLead.create).not.toHaveBeenCalled()
        expect(settle).not.toHaveBeenCalled()
        expect(db.message.create).toHaveBeenCalledTimes(1)
    })
    it("releases a credential failure that occurred before any provider dispatch", async () => {
        complete.mockRejectedValue(Object.assign(new Error("login unavailable"), { providerNotDispatched: true }))
        const response = await handler()(request())
        expect(response.status).toBe(200)
        await response.text().catch(() => "")
        expect(settle).toHaveBeenCalledWith("reservation", "RELEASE", { reason: "provider_rejected" })
    })
    it("continues a visitor conversation after the capability cookie expires", async () => {
        const response = await handler()(request({ conversationId: "conversation" }, "pl_vid=visitor"))
        expect(response.status).toBe(200)
        expect(await response.text()).toContain("A grounded answer")
        expect(reserve).toHaveBeenCalledOnce()
        expect(complete).toHaveBeenCalledOnce()
        expect(db.conversation.create).not.toHaveBeenCalled()
    })
    it("answers from business facts when the provider completes without text", async () => {
        complete.mockResolvedValue(stream(chunk({}, true)))
        const response = await handler()(request())
        const text = await response.text()
        expect(response.status).toBe(200)
        expect(text).toContain("Studio")
        expect(settle).toHaveBeenCalledWith("reservation", "RELEASE", expect.objectContaining({ reason: "empty_completed_response" }))
        expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "assistant" }) }))
    })
    it.each([402, 403, 409, 503])("fails closed at allowance refusal %s before retrieval or any write", async status => {
        reserve.mockRejectedValue(new AiAccessError(status, "ai_blocked", "Unavailable"))
        expect((await handler()(request())).status).toBe(status)
        for (const call of [retrieve, complete, db.conversation.create, db.message.create, db.visitorLead.create]) expect(call).not.toHaveBeenCalled()
    })
    it("requires a client id before any reservation", async () => {
        expect((await handler()(request({}, "", null))).status).toBe(400)
        expect(reserve).not.toHaveBeenCalled()
    })
    it("rejects foreign conversation capability before accessing billing", async () => {
        expect((await handler()(request({ conversationId: "foreign" }, cookies()))).status).toBe(403)
        expect(reserve).not.toHaveBeenCalled()
        expect(complete).not.toHaveBeenCalled()
    })
    it("scopes a valid conversation and consumes one operation with measured usage", async () => {
        const response = await handler()(request({ conversationId: "conversation" }, cookies()))
        expect(response.status).toBe(200)
        expect(await response.text()).toContain("A grounded answer")
        expect(db.conversation.findFirst).toHaveBeenCalledWith({ where: { id: "conversation", profileId: "shop", memberId: null, visitorId: "visitor" } })
        expect(reserve).toHaveBeenCalledOnce()
        expect(complete).toHaveBeenCalledOnce()
        expect(settle).toHaveBeenCalledWith("reservation", "CONSUME", expect.objectContaining({ model: recipe.model, inputTokens: 300, outputTokens: 20, responseMessageId: "saved-message", toolCalls: 0 }))
        expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(retrieve.mock.invocationCallOrder[0])
        expect(retrieve.mock.invocationCallOrder[0]).toBeLessThan(complete.mock.invocationCallOrder[0])
    })
    it("keeps entitled custom instructions inside the bounded provider context", async () => {
        db.profile.findUnique.mockResolvedValue({ ...profile, personalityConfig: '{"customInstructions":"Use plain language"}' })
        reserve.mockResolvedValue({ id: "reservation", recipe, autoMemory: false, customInstructions: true })
        await (await handler()(request())).text()
        expect(JSON.stringify(complete.mock.calls[0][0].messages)).toContain("Use plain language")
    })
    it("strips legacy paid instructions from Free provider context", async () => {
        db.profile.findUnique.mockResolvedValue({ ...profile, personalityConfig: '{"customInstructions":"PRIVATE_PAID_INSTRUCTION"}' })
        await (await handler()(request())).text()
        expect(JSON.stringify(complete.mock.calls[0][0].messages)).not.toContain("PRIVATE_PAID_INSTRUCTION")
    })
    it("uses a stable operation key for client retries", async () => {
        await (await handler()(request())).text()
        await (await handler()(request())).text()
        expect(reserve.mock.calls[0][0].operationKey).toBe(reserve.mock.calls[1][0].operationKey)
    })
    it("executes at most one offered local tool without a second paid completion", async () => {
        complete.mockResolvedValue(stream(chunk({ tool_calls: [{ index: 0, id: "tool", function: { name: "collectLead", arguments: '{"name":"Ada","email":"ada@example.test"}' } }, { index: 1, id: "extra", function: { name: "collectLead", arguments: '{"name":"Other","email":"other@example.test"}' } }] }), chunk({}, true)))
        const response = await handler()(request({ messages: [{ role: "user", content: "I am Ada, ada@example.test" }] }))
        expect(await response.text()).toContain("noted your details")
        expect(complete).toHaveBeenCalledOnce()
        expect(db.visitorLead.create).toHaveBeenCalledOnce()
        expect(settle).toHaveBeenCalledWith("reservation", "CONSUME", expect.objectContaining({ toolCalls: 1 }))
    })
    it("does not save a hallucinated email from a tool result", async () => {
        complete.mockResolvedValue(stream(chunk({ tool_calls: [{ index: 0, id: "tool", function: { name: "collectLead", arguments: '{"name":"Ada","email":"wrong@example.test"}' } }] })))
        const response = await handler()(request({ messages: [{ role: "user", content: "ada@example.test" }] }))
        expect(await response.text()).toContain("Please share")
        expect(db.visitorLead.create).not.toHaveBeenCalled()
    })
    it("releases when the provider explicitly rejects before generation", async () => {
        complete.mockRejectedValue({ status: 429 })
        const response = await handler()(request())
        expect(response.status).toBe(200)
        await response.text().catch(() => "")
        expect(settle).toHaveBeenCalledWith("reservation", "RELEASE", { reason: "provider_rejected" })
    })
    it("holds unknown dispatch outcomes for reconciliation", async () => {
        complete.mockRejectedValue(new Error("network timeout"))
        const response = await handler()(request())
        expect(response.status).toBe(200)
        await response.text().catch(() => "")
        expect(settle).not.toHaveBeenCalled()
    })
    it("holds a failed partial stream and prevents a blind credit release", async () => {
        complete.mockResolvedValue({ async *[Symbol.asyncIterator]() { yield chunk(); throw new Error("disconnected") } })
        const response = await handler()(request())
        await expect(response.text()).rejects.toThrow()
        expect(settle).not.toHaveBeenCalled()
    })
    it("releases on a local failure before provider dispatch", async () => {
        retrieve.mockRejectedValue(new Error("retrieval failed"))
        expect((await handler()(request())).status).toBe(503)
        expect(complete).not.toHaveBeenCalled()
        expect(settle).toHaveBeenCalledWith("reservation", "RELEASE", { reason: "failed_before_dispatch" })
    })
    it("human handoff does not spend AI credits or retrieve", async () => {
        db.conversation.findFirst.mockResolvedValue({ mode: "LIVE", visitorId: "visitor" })
        const response = await handler()(request({ conversationId: "conversation" }, cookies()))
        expect(await response.text()).toContain("moment to reply")
        expect(reserve).not.toHaveBeenCalled()
        expect(retrieve).not.toHaveBeenCalled()
        expect(complete).not.toHaveBeenCalled()
    })
})
