// @vitest-environment node
import type { ProfileDocument } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ conversation: vi.fn(), event: vi.fn(), findDoc: vi.fn(), create: vi.fn(), update: vi.fn(), conversationUpdate: vi.fn(), billing: vi.fn(), limit: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { conversation: { findUnique: mocks.conversation, update: mocks.conversationUpdate }, profileEvent: { findFirst: mocks.event }, profileDocument: { findFirst: mocks.findDoc } } }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: mocks.billing }))
vi.mock("@/lib/billing/resource-limits", () => ({ withKnowledgeLimit: mocks.limit }))
import { maybeSummarizeConversation, visitorKeyFrom } from "@/lib/memory"
import { redactVisitorText } from "@/lib/memory-privacy"
import { scopeDocuments, vectorRetrieval } from "@/lib/rag"
import { embedDocument, embedProfileDocuments, generateEmbedding } from "@/lib/embeddings"
const conversation = { id: "thread-a", profileId: "shop", visitorId: "visitor-a", memberId: null, visitorName: "Ada (Jones)", visitorEmail: "ada@example.test", profile: { autoMemoryEnabled: true }, messages: Array.from({ length: 6 }, (_, i) => ({ id: `message-${i}`, senderType: i % 2 === 0 ? "VISITOR" : "AI", text: "Ada (Jones) needs a booking, ada@example.test, +91 9876543210" })) }
const doc = (id: string, type = "TEXT", sourceType: string | null = null, conversationId: string | null = null, visitorKey: string | null = null) => ({ id, type, sourceType, conversationId, visitorKey, title: "booking", rawText: "booking" }) as ProfileDocument
beforeEach(() => {
    vi.clearAllMocks()
    mocks.conversation.mockResolvedValue(conversation)
    mocks.event.mockResolvedValue({ meta: '{"granted":true}' })
    mocks.billing.mockResolvedValue({ features: { autoMemory: true } })
    mocks.findDoc.mockResolvedValue(null)
    mocks.limit.mockImplementation(async (_p, _d, _t, callback) => callback({ profileDocument: { create: mocks.create, update: mocks.update } }))
})
describe("conversation memory privacy", () => {
    it("redacts known identities, email addresses and long phone numbers", () => {
        const value = redactVisitorText(conversation.messages[0].text, [conversation.visitorName, conversation.visitorEmail])
        expect(value).not.toContain("Ada")
        expect(value).not.toContain("ada@example.test")
        expect(value).not.toContain("9876543210")
        expect(visitorKeyFrom("ada@example.test")).toBeNull()
    })
    it("quarantines historical general chat summaries and restricts visitor memory to exact conversation", () => {
        const documents = [doc("public"), doc("old-shared", "CHAT", "CHAT_SUMMARY"), doc("profile-memory", "PROFILE_MEMORY"), doc("private-export", "PRIVATE_CHAT_NOTES"), doc("same-visitor-other-thread", "VISITOR_MEMORY", "CHAT_PRIVATE", "thread-b", "visitor:visitor-a"), doc("this-thread", "VISITOR_MEMORY", "CHAT_PRIVATE", "thread-a", "visitor:visitor-a")]
        expect(scopeDocuments(documents).map(d => d.id)).toEqual(["public"])
        expect(scopeDocuments(documents, "visitor:visitor-a", "thread-a").map(d => d.id)).toEqual(["public", "this-thread"])
        expect(scopeDocuments(documents, "visitor:visitor-a").map(d => d.id)).toEqual(["public"])
    })
    it.each([null, { meta: '{"granted":false}' }])("does not save memory without affirmative current consent", async consent => {
        mocks.event.mockResolvedValue(consent)
        await maybeSummarizeConversation("thread-a")
        expect(mocks.limit).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
    })
    it("does not save memory after a plan downgrade", async () => {
        mocks.billing.mockResolvedValue({ features: { autoMemory: false } })
        await maybeSummarizeConversation("thread-a")
        expect(mocks.limit).not.toHaveBeenCalled()
    })
    it("writes only private redacted notes through the atomic knowledge limit", async () => {
        await maybeSummarizeConversation("thread-a")
        expect(mocks.limit).toHaveBeenCalledWith("shop", null, expect.any(String), expect.any(Function))
        expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "VISITOR_MEMORY", sourceType: "CHAT_PRIVATE", visitorKey: "visitor:visitor-a", conversationId: "thread-a", embedding: [] }) })
        expect(mocks.create.mock.calls[0][0].data.rawText).not.toContain("ada@example.test")
        expect(mocks.create.mock.calls[0][0].data.rawText).not.toContain("Ada")
    })
    it("runs retrieval and indexing hooks without provider calls", async () => {
        const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
        await expect(vectorRetrieval("booking", [doc("public")])).resolves.toHaveLength(1)
        await embedDocument("public")
        await expect(embedProfileDocuments("shop")).resolves.toBe(0)
        await expect(generateEmbedding("booking")).resolves.toEqual([])
        expect(fetch).not.toHaveBeenCalled()
    })
})
