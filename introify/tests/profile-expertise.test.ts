// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProfileBlueprint } from "@/lib/profile-import-contract"

const mocks = vi.hoisted(() => ({
    access: vi.fn(),
    frameworkUpdate: vi.fn(),
    introductionUpdate: vi.fn(),
    frameworkFind: vi.fn(),
    introFind: vi.fn(),
    docFind: vi.fn(),
    grantFind: vi.fn(),
    ruleFind: vi.fn(),
    productFind: vi.fn(),
    serviceFind: vi.fn(),
    billing: vi.fn(),
    assertFeature: vi.fn(),
    profileUpdate: vi.fn(),
    gapFind: vi.fn(),
    gapUpdate: vi.fn(),
    assertLimit: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        profileFramework: { findMany: mocks.frameworkFind, updateMany: mocks.frameworkUpdate },
        profileIntroduction: { findMany: mocks.introFind, updateMany: mocks.introductionUpdate },
        profileDocument: { findMany: mocks.docFind },
        knowledgeAccessGrant: { findMany: mocks.grantFind },
        knowledgePurchaseRule: { findMany: mocks.ruleFind },
        digitalProduct: { findMany: mocks.productFind },
        serviceOffering: { findMany: mocks.serviceFind },
        knowledgeGapSignal: { findMany: mocks.gapFind, updateMany: mocks.gapUpdate },
        profile: { update: mocks.profileUpdate },
    },
}))
vi.mock("@/lib/security", () => ({
    requireProfileAccess: mocks.access,
    unwrapOwnershipResult: (r: { ok: boolean; value?: unknown; refusal?: { message: string } }) => { if (!r.ok) throw new Error(r.refusal?.message); return r.value },
}))
vi.mock("@/lib/billing/service", () => ({
    getProfileBilling: mocks.billing,
    assertBillingFeature: mocks.assertFeature,
    assertAccountLimit: mocks.assertLimit,
}))

import { evaluateFramework, groupKnowledgeGaps, shouldRecordKnowledgeGap, isPublishedKnowledge } from "@/lib/profile-expertise-policy"
import { getProfileExpertise, saveProfileFramework, saveProfileIntroduction, setKnowledgeGapTracking, getKnowledgeGaps, resolveKnowledgeGaps } from "@/app/actions/profile-expertise"
import { applyProfileBlueprintTx } from "@/lib/profile-import-apply"

const profile = { id: "prof-1", billingAccountId: "acct-1", displayName: "Ada", headline: null, bio: null, personalityConfig: null, roleTemplate: "CONSULTANT", knowledgeGapTracking: false }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.access.mockResolvedValue({ ok: true, value: { actor: { userId: "user-1" }, profile } })
    mocks.billing.mockResolvedValue({ features: { advancedAnalytics: true } })
    mocks.assertFeature.mockResolvedValue(undefined)
    mocks.frameworkUpdate.mockResolvedValue({ count: 1 })
    mocks.introductionUpdate.mockResolvedValue({ count: 1 })
})

const framework = {
    title: "Fit check", description: "Check fit.", sourceIds: ["s1"],
    questions: [
        { id: "q1", label: "Do you ship?", guidance: "" },
        { id: "q2", label: "Do you iterate?", guidance: "Weekly" },
    ],
}

describe("evaluateFramework (lead policy)", () => {
    it("scores yes/no as 50 and yes/partly as 75", () => {
        expect(evaluateFramework(framework, { q1: "yes", q2: "no" }).score).toBe(50)
        expect(evaluateFramework(framework, { q1: "yes", q2: "partly" }).score).toBe(75)
        expect(evaluateFramework(framework, { q1: "yes", q2: "yes" }).score).toBe(100)
    })
    it("returns null score when any answer is unsure or missing", () => {
        expect(evaluateFramework(framework, { q1: "yes", q2: "unsure" }).score).toBeNull()
        expect(evaluateFramework(framework, { q1: "yes" }).score).toBeNull()
    })
    it("throws on duplicate question ids", () => {
        expect(() => evaluateFramework({ ...framework, questions: [framework.questions[0], framework.questions[0]] }, {})).toThrow(/unique/i)
    })
    it("flags non-yes answers for review", () => {
        expect(evaluateFramework(framework, { q1: "yes", q2: "partly" }).reviewIds).toEqual(["q2"])
    })
})

describe("groupKnowledgeGaps (lead policy)", () => {
    const at = new Date("2026-01-01T00:00:00Z")
    it("groups the same question ignoring case and whitespace", () => {
        const groups = groupKnowledgeGaps([
            { id: "g1", question: "Do you travel?", createdAt: at, status: "OPEN" },
            { id: "g2", question: "  do YOU   travel? ", createdAt: new Date(at.getTime() + 1000), status: "OPEN" },
            { id: "g3", question: "Other", createdAt: at, status: "OPEN" },
            { id: "g4", question: "Resolved", createdAt: at, status: "ANSWERED" },
        ])
        const travel = groups.find(g => g.question === "Do you travel?")
        expect(travel?.occurrences).toBe(2)
        expect(travel?.signalIds).toEqual(["g1", "g2"])
        expect(groups.find(g => g.question === "Resolved")).toBeUndefined()
    })
    it("gates recording to a real retrieval no-match", () => {
        expect(shouldRecordKnowledgeGap("pricing?", 0, true)).toBe(true)
        expect(shouldRecordKnowledgeGap("pricing?", 1, true)).toBe(false)
        expect(shouldRecordKnowledgeGap("pricing?", 0, false)).toBe(false)
        expect(shouldRecordKnowledgeGap("hello", 0, true)).toBe(false)
    })
})

describe("imported framework/introduction persistence", () => {
    it("applies frameworks and intros as drafts with scoring off", async () => {
        const created: Record<string, unknown[]> = { profileFramework: [], profileIntroduction: [] }
        const tx = {
            profile: { update: vi.fn() },
            workExperience: { findMany: vi.fn(async () => []), create: vi.fn() },
            project: { findMany: vi.fn(async () => []), create: vi.fn() },
            serviceOffering: { findMany: vi.fn(async () => []), create: vi.fn() },
            digitalProduct: { findMany: vi.fn(async () => []), create: vi.fn() },
            profileDocument: { findMany: vi.fn(async () => []), create: vi.fn() },
            profileFramework: { findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: unknown }) => { created.profileFramework.push(data) }) },
            profileIntroduction: { findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: unknown }) => { created.profileIntroduction.push(data) }) },
        }
        const draft: ProfileBlueprint = {
            version: 1,
            profile: { displayName: "Ada", headline: "Eng", bio: "Bio.", welcome: "Hi", sourceIds: ["s1"] },
            needId: "time", addons: [], socials: [], experiences: [], projects: [], services: [], products: [], knowledge: [],
            introductions: [{ intent: "Hire", text: "Intro text.", sourceIds: ["s1"] }],
            frameworks: [framework],
            missingInformation: [],
        }
        await applyProfileBlueprintTx(tx as never, profile, draft, { overwriteProfile: false, applyFeatures: true })
        expect(created.profileFramework[0]).toMatchObject({ title: "Fit check", status: "DRAFT", scoringApproved: false })
        expect(created.profileIntroduction[0]).toMatchObject({ intent: "Hire", text: "Intro text.", status: "DRAFT" })
    })
})

describe("profile expertise actions", () => {
    it("scopes framework saves to the claimed profile and enforces scoring approval", async () => {
        await saveProfileFramework("prof-1", "fw-1", { definition: framework, publish: false, scoringApproved: false })
        expect(mocks.frameworkUpdate.mock.calls[0][0].where).toEqual({ id: "fw-1", profileId: "prof-1" })
        expect(mocks.frameworkUpdate.mock.calls[0][0].data.status).toBe("DRAFT")
        await expect(saveProfileFramework("prof-1", "fw-1", { definition: framework, publish: true, scoringApproved: false })).rejects.toThrow(/scoring/i)
        await saveProfileFramework("prof-1", "fw-1", { definition: framework, publish: true, scoringApproved: true })
        expect(mocks.frameworkUpdate.mock.calls[1][0].data.status).toBe("PUBLISHED")
        await expect(saveProfileFramework("prof-1", "fw-1", { definition: { ...framework, questions: [framework.questions[0], framework.questions[0]] }, publish: false, scoringApproved: true })).rejects.toThrow(/unique/i)
        mocks.frameworkUpdate.mockResolvedValue({ count: 0 })
        await expect(saveProfileFramework("prof-1", "fw-2", { definition: framework, publish: false, scoringApproved: false })).rejects.toThrow(/not found/i)
    })

    it("saves and publishes introductions scoped to the profile", async () => {
        await saveProfileIntroduction("prof-1", "intro-1", { intent: "Hire", text: "Hello", publish: true })
        expect(mocks.introductionUpdate.mock.calls[0][0]).toMatchObject({ where: { id: "intro-1", profileId: "prof-1" }, data: { status: "PUBLISHED" } })
        await expect(saveProfileIntroduction("prof-1", "intro-1", { intent: "", text: "Hello", publish: false })).rejects.toThrow(/required/i)
    })

    it("returns owner-scoped expertise and publishable flags", async () => {
        mocks.frameworkFind.mockResolvedValue([{ id: "fw-1" }])
        mocks.introFind.mockResolvedValue([])
        mocks.docFind.mockResolvedValue([
            { id: "d1", title: "Note", type: "TEXT", sourceType: null, visibility: "PUBLIC", publicationState: "PUBLISHED" },
            { id: "d2", title: "Private", type: "VISITOR_MEMORY", sourceType: "CHAT_PRIVATE", visibility: "PRIVATE", publicationState: "PUBLISHED" },
        ])
        mocks.grantFind.mockResolvedValue([])
        mocks.ruleFind.mockResolvedValue([])
        mocks.productFind.mockResolvedValue([])
        mocks.serviceFind.mockResolvedValue([])
        const result = await getProfileExpertise("prof-1")
        expect(result.documents.map(d => [d.id, d.publishable])).toEqual([["d1", true], ["d2", false]])
        expect(result.settings.knowledgeGapTracking).toBe(false)
        expect(mocks.docFind.mock.calls[0][0].where.profileId).toBe("prof-1")
    })

    it("enforces advanced analytics for gap tracking and queries the exact window", async () => {
        mocks.assertFeature.mockRejectedValue(new Error("needs a higher plan"))
        await expect(setKnowledgeGapTracking("prof-1", true)).rejects.toThrow(/higher plan/)
        mocks.assertFeature.mockResolvedValue(undefined)
        await setKnowledgeGapTracking("prof-1", true)
        expect(mocks.profileUpdate).toHaveBeenCalledWith({ where: { id: "prof-1" }, data: { knowledgeGapTracking: true } })

        mocks.gapFind.mockResolvedValue([{ id: "g1", question: "Q?", createdAt: new Date(), status: "OPEN" }])
        const gaps = await getKnowledgeGaps("prof-1")
        expect(mocks.gapFind.mock.calls[0][0]).toMatchObject({ where: { profileId: "prof-1", status: "OPEN" }, take: 201 })
        expect(gaps.groups[0].occurrences).toBe(1)
        await resolveKnowledgeGaps("prof-1", ["g1"], "ANSWERED")
        expect(mocks.gapUpdate).toHaveBeenCalledWith({ where: { profileId: "prof-1", id: { in: ["g1"] } }, data: { status: "ANSWERED" } })
        await expect(resolveKnowledgeGaps("prof-1", ["g1"], "OPEN" as never)).rejects.toThrow(/invalid/i)
    })
})

describe("isPublishedKnowledge (lead policy)", () => {
    it("excludes private chat and memory types regardless of state", () => {
        expect(isPublishedKnowledge({ id: "d", type: "TEXT" })).toBe(true)
        expect(isPublishedKnowledge({ id: "d", type: "PRIVATE_CHAT_NOTES" })).toBe(false)
        expect(isPublishedKnowledge({ id: "d", type: "TEXT", sourceType: "CHAT_PRIVATE" })).toBe(false)
        expect(isPublishedKnowledge({ id: "d", type: "TEXT", publicationState: "DRAFT" })).toBe(false)
    })
})
