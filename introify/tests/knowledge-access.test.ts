// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"

const mocks = vi.hoisted(() => ({
    access: vi.fn(),
    docFindFirst: vi.fn(),
    docUpdate: vi.fn(),
    upsertMember: vi.fn(),
    grantUpsert: vi.fn(),
    ruleUpsert: vi.fn(),
    ruleDelete: vi.fn(),
    productFindFirst: vi.fn(),
    serviceFindFirst: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
    prisma: {
        profileDocument: { findFirst: mocks.docFindFirst, update: mocks.docUpdate },
        knowledgeAccessGrant: { upsert: mocks.grantUpsert },
        knowledgePurchaseRule: { upsert: mocks.ruleUpsert, deleteMany: mocks.ruleDelete },
        digitalProduct: { findFirst: mocks.productFindFirst },
        serviceOffering: { findFirst: mocks.serviceFindFirst },
    },
}))
vi.mock("@/lib/security", () => ({
    requireProfileAccess: mocks.access,
    unwrapOwnershipResult: (r: { ok: boolean; value?: unknown; refusal?: { message: string } }) => { if (!r.ok) throw new Error(r.refusal?.message); return r.value },
}))
vi.mock("@/lib/members", () => ({ upsertMember: mocks.upsertMember, normalizeEmail: (e: string) => e.trim().toLowerCase() }))

import { resolveClientDocumentIds } from "@/lib/knowledge-access"
import { setKnowledgeVisibility, setKnowledgeMemberAccess, setKnowledgePurchaseRule } from "@/app/actions/knowledge-access"

const profile = { id: "prof-1" }
const member = { id: "member-1", email: "Buyer@Example.com" }

function fakeDb(seed: {
    documents?: Array<Record<string, unknown>>
    grants?: Array<Record<string, unknown>>
    rules?: Array<Record<string, unknown>>
    proofs?: Array<Record<string, unknown>>
    blocks?: Array<Record<string, unknown>>
}) {
    return {
        profileDocument: {
            findMany: vi.fn(async ({ where }: { where: { visibility: string } }) =>
                (seed.documents || []).filter(d => d.visibility === where.visibility)),
        },
        knowledgeAccessGrant: {
            findMany: vi.fn(async ({ where }: { where: { memberId: string } }) =>
                (seed.grants || []).filter(g => g.memberId === where.memberId)),
        },
        knowledgePurchaseRule: {
            findMany: vi.fn(async () => seed.rules || []),
        },
        knowledgePaymentProof: {
            findMany: vi.fn(async ({ where }: { where: { profileId: string; buyerEmail: string } }) =>
                (seed.proofs || []).filter(p => p.profileId === where.profileId && p.buyerEmail === where.buyerEmail)),
        },
        knowledgePaymentBlock: {
            findMany: vi.fn(async () => seed.blocks || []),
        },
    } as unknown as Prisma.TransactionClient
}

const clientDoc = { id: "doc-1", type: "TEXT", sourceType: "PROFILE_IMPORT", visibility: "CLIENT", publicationState: "PUBLISHED" }

describe("resolveClientDocumentIds", () => {
    it("returns nothing for anonymous visitors and never touches the database", async () => {
        const db = fakeDb({ documents: [clientDoc] })
        expect([...(await resolveClientDocumentIds(db, "prof-1", null))]).toHaveLength(0)
        expect(db.profileDocument.findMany).not.toHaveBeenCalled()
    })

    it("denies client documents without a grant or verified purchase", async () => {
        const db = fakeDb({ documents: [clientDoc] })
        expect([...(await resolveClientDocumentIds(db, "prof-1", member))]).toHaveLength(0)
    })

    it("allows a signed-in member with a valid ALLOWED grant, honours expiry and BLOCK overrides", async () => {
        const granted = fakeDb({
            documents: [clientDoc],
            grants: [{ documentId: "doc-1", memberId: "member-1", state: "ALLOWED", expiresAt: null }],
        })
        expect([...(await resolveClientDocumentIds(granted, "prof-1", member))]).toEqual(["doc-1"])

        const expired = fakeDb({
            documents: [clientDoc],
            grants: [{ documentId: "doc-1", memberId: "member-1", state: "ALLOWED", expiresAt: new Date(Date.now() - 1000) }],
        })
        expect([...(await resolveClientDocumentIds(expired, "prof-1", member))]).toHaveLength(0)

        const blocked = fakeDb({
            documents: [clientDoc],
            grants: [{ documentId: "doc-1", memberId: "member-1", state: "BLOCKED", expiresAt: null }],
            rules: [{ documentId: "doc-1", productId: "prod-1", serviceOfferingId: null }],
            proofs: [{ profileId: "prof-1", buyerEmail: "buyer@example.com", itemType: "PRODUCT", itemId: "prod-1", stripeAccountId: "platform", paymentIntentId: "pi_1" }],
        })
        expect([...(await resolveClientDocumentIds(blocked, "prof-1", member))]).toHaveLength(0)
    })

    it("allows a purchase proof matching member email, product and profile", async () => {
        const db = fakeDb({
            documents: [clientDoc],
            rules: [{ documentId: "doc-1", productId: "prod-1", serviceOfferingId: null }],
            proofs: [{ profileId: "prof-1", buyerEmail: "buyer@example.com", itemType: "PRODUCT", itemId: "prod-1", stripeAccountId: "platform", paymentIntentId: "pi_1" }],
        })
        expect([...(await resolveClientDocumentIds(db, "prof-1", member))]).toEqual(["doc-1"])
        expect((db.knowledgePaymentProof.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where.buyerEmail).toBe("buyer@example.com")
    })

    it("denies a proof once a refund or dispute block exists, and denies cross-profile proofs", async () => {
        const refunded = fakeDb({
            documents: [clientDoc],
            rules: [{ documentId: "doc-1", productId: "prod-1", serviceOfferingId: null }],
            proofs: [{ profileId: "prof-1", buyerEmail: "buyer@example.com", itemType: "PRODUCT", itemId: "prod-1", stripeAccountId: "platform", paymentIntentId: "pi_1" }],
            blocks: [{ stripeAccountId: "platform", paymentIntentId: "pi_1" }],
        })
        expect([...(await resolveClientDocumentIds(refunded, "prof-1", member))]).toHaveLength(0)

        const otherProfile = fakeDb({
            documents: [clientDoc],
            rules: [{ documentId: "doc-1", productId: "prod-1", serviceOfferingId: null }],
            proofs: [{ profileId: "prof-2", buyerEmail: "buyer@example.com", itemType: "PRODUCT", itemId: "prod-1", stripeAccountId: "platform", paymentIntentId: "pi_2" }],
        })
        expect([...(await resolveClientDocumentIds(otherProfile, "prof-1", member))]).toHaveLength(0)
    })

    it("excludes draft and private-type documents even when a grant exists", async () => {
        const db = fakeDb({
            documents: [
                { ...clientDoc, publicationState: "DRAFT" },
                { ...clientDoc, id: "doc-2", type: "PRIVATE_CHAT_NOTES" },
            ],
            grants: [
                { documentId: "doc-1", memberId: "member-1", state: "ALLOWED", expiresAt: null },
                { documentId: "doc-2", memberId: "member-1", state: "ALLOWED", expiresAt: null },
            ],
        })
        expect([...(await resolveClientDocumentIds(db, "prof-1", member))]).toHaveLength(0)
    })
})

describe("knowledge access actions", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.access.mockResolvedValue({ ok: true, value: { actor: { userId: "user-1" }, profile } })
        mocks.docFindFirst.mockResolvedValue(clientDoc)
        mocks.upsertMember.mockResolvedValue({ id: "member-2" })
        mocks.productFindFirst.mockResolvedValue({ id: "prod-1" })
        mocks.serviceFindFirst.mockResolvedValue({ id: "svc-1" })
    })

    it("blocks documents owned by another profile", async () => {
        mocks.docFindFirst.mockResolvedValue(null)
        await expect(setKnowledgeVisibility("prof-1", "doc-x", { visibility: "PUBLIC", publicationState: "PUBLISHED" })).rejects.toThrow(/not found/i)
        await expect(setKnowledgeMemberAccess("prof-1", "doc-x", { email: "a@b.co", allow: true, expiresAt: null })).rejects.toThrow(/not found/i)
    })

    it("refuses to publish private chat or memory documents", async () => {
        mocks.docFindFirst.mockResolvedValue({ ...clientDoc, type: "PRIVATE_CHAT_NOTES" })
        await expect(setKnowledgeVisibility("prof-1", "doc-1", { visibility: "PUBLIC", publicationState: "PUBLISHED" })).rejects.toThrow(/cannot be published/i)
        mocks.docFindFirst.mockResolvedValue({ ...clientDoc, sourceType: "CHAT_PRIVATE" })
        await expect(setKnowledgeVisibility("prof-1", "doc-1", { visibility: "PUBLIC", publicationState: "PUBLISHED" })).rejects.toThrow(/cannot be published/i)
        mocks.docFindFirst.mockResolvedValue({ ...clientDoc, type: "PRIVATE_CHAT_NOTES" })
        await setKnowledgeVisibility("prof-1", "doc-1", { visibility: "PRIVATE", publicationState: "DRAFT" })
        expect(mocks.docUpdate).toHaveBeenCalled()
    })

    it("validates member access input and upserts ALLOWED or BLOCKED states", async () => {
        await setKnowledgeMemberAccess("prof-1", "doc-1", { email: "Buyer@Example.com", allow: true, expiresAt: null })
        expect(mocks.upsertMember).toHaveBeenCalledWith("buyer@example.com")
        expect(mocks.grantUpsert.mock.calls[0][0].create).toMatchObject({ state: "ALLOWED", memberId: "member-2" })
        await setKnowledgeMemberAccess("prof-1", "doc-1", { email: "Buyer@Example.com", allow: false, expiresAt: null })
        expect(mocks.grantUpsert.mock.calls[1][0].create.state).toBe("BLOCKED")
        await expect(setKnowledgeMemberAccess("prof-1", "doc-1", { email: "bad", allow: true, expiresAt: null })).rejects.toThrow(/email/i)
        await expect(setKnowledgeMemberAccess("prof-1", "doc-1", { email: "a@b.co", allow: true, expiresAt: "2000-01-01" })).rejects.toThrow(/future/i)

        mocks.docFindFirst.mockResolvedValue({ ...clientDoc, visibility: "PRIVATE" })
        await expect(setKnowledgeMemberAccess("prof-1", "doc-1", { email: "a@b.co", allow: true, expiresAt: null })).rejects.toThrow(/client-only/i)
    })

    it("links purchase rules only to same-profile products or services", async () => {
        await setKnowledgePurchaseRule("prof-1", "doc-1", { kind: "PRODUCT", itemId: "prod-1", enabled: true })
        expect(mocks.ruleUpsert.mock.calls[0][0].create).toMatchObject({ documentId: "doc-1", productId: "prod-1" })
        await setKnowledgePurchaseRule("prof-1", "doc-1", { kind: "PRODUCT", itemId: "prod-1", enabled: false })
        expect(mocks.ruleDelete).toHaveBeenCalledWith({ where: { documentId: "doc-1", productId: "prod-1" } })
        mocks.productFindFirst.mockResolvedValue(null)
        await expect(setKnowledgePurchaseRule("prof-1", "doc-1", { kind: "PRODUCT", itemId: "prod-9", enabled: true })).rejects.toThrow(/not found/i)
        await setKnowledgePurchaseRule("prof-1", "doc-1", { kind: "SERVICE", itemId: "svc-1", enabled: true })
        expect(mocks.ruleUpsert.mock.calls[1][0].create).toMatchObject({ documentId: "doc-1", serviceOfferingId: "svc-1" })
    })
})
