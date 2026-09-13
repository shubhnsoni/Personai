// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    assertLimit: vi.fn(),
    jobFind: vi.fn(),
    jobUpdate: vi.fn(),
    jobUpdateMany: vi.fn(),
    profileFind: vi.fn(),
    profileFindFirst: vi.fn(),
    profileUpdate: vi.fn(),
    access: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        profileImportJob: { findUnique: mocks.jobFind, update: mocks.jobUpdate, updateMany: mocks.jobUpdateMany },
        profile: { findUniqueOrThrow: mocks.profileFind, findFirst: mocks.profileFindFirst },
    },
}))
vi.mock("@/lib/security", () => ({
    requireProfileAccess: mocks.access,
    requireAuthenticatedUser: vi.fn(),
    unwrapOwnershipResult: (r: { ok: boolean; value?: unknown; refusal?: { message: string } }) => { if (!r.ok) throw new Error(r.refusal?.message); return r.value },
}))
vi.mock("@/lib/billing/service", () => ({
    assertAccountLimit: mocks.assertLimit,
    billingTransaction: async (work: (tx: unknown) => Promise<unknown>) => work(txFor()),
    lockBillingAccount: vi.fn(),
    getProfileBilling: vi.fn(async () => ({ accountId: "acct-1" })),
    reserveUsage: vi.fn(),
    settleUsage: vi.fn(),
}))

import { applyProfileBlueprintTx, partitionSocials, unsupportedSocialWarnings } from "@/lib/profile-import-apply"
import { applyProfileImport } from "@/app/actions/profile-import"
import { scopeDocuments } from "@/lib/rag"
import type { ProfileBlueprint } from "@/lib/profile-import-contract"
import type { ProfileDocument } from "@prisma/client"

function txFor(seed: {
    experiences?: unknown[]; projects?: unknown[]; services?: unknown[]; products?: unknown[]; documents?: unknown[]
} = {}) {
    const created: Record<string, unknown[]> = { workExperience: [], project: [], serviceOffering: [], digitalProduct: [], profileDocument: [], profileFramework: [], profileIntroduction: [] }
    const tx = {
        created,
        profile: { update: mocks.profileUpdate, findUniqueOrThrow: mocks.profileFind, findUnique: vi.fn(async () => ({ billingAccountId: "acct-1" })) },
        profileImportJob: { update: mocks.jobUpdate, updateMany: mocks.jobUpdateMany, findUniqueOrThrow: mocks.jobFind },
        workExperience: { findMany: vi.fn(async () => seed.experiences || []), create: vi.fn(async ({ data }: { data: unknown }) => { created.workExperience.push(data) }) },
        project: { findMany: vi.fn(async () => seed.projects || []), create: vi.fn(async ({ data }: { data: unknown }) => { created.project.push(data) }) },
        serviceOffering: { findMany: vi.fn(async () => seed.services || []), create: vi.fn(async ({ data }: { data: unknown }) => { created.serviceOffering.push(data) }) },
        digitalProduct: { findMany: vi.fn(async () => seed.products || []), create: vi.fn(async ({ data }: { data: unknown }) => { created.digitalProduct.push(data) }) },
        profileDocument: { findMany: vi.fn(async () => seed.documents || []), create: vi.fn(async ({ data }: { data: unknown }) => { created.profileDocument.push(data) }) },
        profileFramework: { findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: unknown }) => { created.profileFramework.push(data) }) },
        profileIntroduction: { findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: unknown }) => { created.profileIntroduction.push(data) }) },
    }
    return tx
}

const draft: ProfileBlueprint = {
    version: 1,
    profile: { displayName: "Ada New", headline: "New headline", bio: "Imported bio.", welcome: "Welcome!", sourceIds: ["s1"] },
    needId: "time",
    addons: ["services"],
    socials: [
        { label: "LinkedIn", url: "https://www.linkedin.com/in/ada", sourceIds: ["s1"] },
        { label: "Niche", url: "https://unsupported.example/ada", sourceIds: ["s1"] },
    ],
    experiences: [
        { company: "Acme", role: "Engineer", startDate: "2020", endDate: null, description: "Built.", sourceIds: ["s1"] },
        { company: "Acme", role: "Engineer", startDate: "2020", endDate: null, description: "Dup.", sourceIds: ["s1"] },
    ],
    projects: [{ title: "Site", description: "Made it.", client: null, year: "2023", sourceIds: ["s1"] }],
    services: [{ title: "Advisory", description: "Advice.", durationMinutes: 45, price: null, currency: "USD", basis: "suggested", sourceIds: ["s1"] }],
    products: [{ title: "Playbook", description: "Guide.", price: 25, currency: "USD", basis: "suggested", sourceIds: ["s1"] }],
    knowledge: [
        { title: "Sourced note", body: "Real content.", visibility: "PUBLIC", basis: "sourced", sourceIds: ["s1"] },
        { title: "Outline", body: "Proposed outline.", visibility: "PUBLIC", basis: "suggested", sourceIds: [] },
    ],
    introductions: [{ intent: "Hire", text: "Intro text.", sourceIds: ["s1"] }],
    frameworks: [],
    missingInformation: [],
}

const profile = {
    id: "prof-1", billingAccountId: "acct-1", displayName: "Ada Old", headline: "Keep me",
    bio: null, welcomeMessageOverride: null, roleTemplate: "CONSULTANT",
    personalityConfig: JSON.stringify({ socials: { linkedin: "https://www.linkedin.com/in/old" } }),
    slug: "ada",
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.access.mockResolvedValue({ ok: true, value: { actor: { userId: "user-1" }, profile } })
    mocks.profileFindFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id === "prof-1" ? { id: "prof-1" } : null)
})

describe("applyProfileBlueprintTx", () => {
    it("fills blanks and preserves existing content by default", async () => {
        const tx = txFor()
        await applyProfileBlueprintTx(tx as never, profile, draft, { overwriteProfile: false, applyFeatures: true })
        const data = mocks.profileUpdate.mock.calls[0][0].data
        expect(data.displayName).toBeUndefined()
        expect(data.headline).toBeUndefined()
        expect(data.bio).toBe("Imported bio.")
        expect(data.welcomeMessageOverride).toBe("Welcome!")
        const cfg = JSON.parse(data.personalityConfig)
        expect(cfg.socials.linkedin).toBe("https://www.linkedin.com/in/old")
        expect(cfg.socials.unsupported).toBeUndefined()
    })

    it("only replaces name/headline/bio/welcome on explicit overwrite", async () => {
        const tx = txFor()
        await applyProfileBlueprintTx(tx as never, { ...profile, bio: "Old bio" }, draft, { overwriteProfile: true, applyFeatures: true })
        const data = mocks.profileUpdate.mock.calls[0][0].data
        expect(data.displayName).toBe("Ada New")
        expect(data.headline).toBe("New headline")
        expect(data.bio).toBe("Imported bio.")
        expect(data.roleTemplate).toBeUndefined()
    })

    it("creates offers inactive, never free-on-unknown-price, and dedupes", async () => {
        const tx = txFor({ experiences: [{ company: "Acme", role: "Engineer", startDate: "2020", endDate: null }] })
        await applyProfileBlueprintTx(tx as never, profile, draft, { overwriteProfile: false, applyFeatures: true })
        expect(tx.created.workExperience).toHaveLength(0)
        expect(tx.created.serviceOffering).toHaveLength(1)
        expect(tx.created.serviceOffering[0]).toMatchObject({ isActive: false, isFree: false, priceCents: 0 })
        expect(tx.created.digitalProduct[0]).toMatchObject({ isActive: false, type: "OTHER", fulfillment: "DIGITAL", fileUrl: null, priceCents: 2500 })
    })

    it("stores suggested knowledge as private drafts, sourced knowledge published", async () => {
        const tx = txFor()
        await applyProfileBlueprintTx(tx as never, profile, draft, { overwriteProfile: false, applyFeatures: true })
        expect(tx.created.profileDocument[0]).toMatchObject({ title: "Sourced note", visibility: "PUBLIC", publicationState: "PUBLISHED", sourceType: "PROFILE_IMPORT" })
        expect(tx.created.profileDocument[1]).toMatchObject({ title: "Outline", visibility: "PRIVATE", publicationState: "DRAFT" })

        const docs = tx.created.profileDocument.map((d, i) => ({ id: `d${i}`, type: "TEXT", sourceType: "PROFILE_IMPORT", visitorKey: null, conversationId: null, ...(d as object) }) as ProfileDocument)
        expect(scopeDocuments(docs).map(d => d.title)).toEqual(["Sourced note"])
    })

    it("keeps existing socials even under explicit text overwrite", async () => {
        const tx = txFor()
        await applyProfileBlueprintTx(tx as never, { ...profile, bio: "Old bio" }, draft, { overwriteProfile: true, applyFeatures: true })
        const cfg = JSON.parse((mocks.profileUpdate.mock.calls[0][0].data as { personalityConfig: string }).personalityConfig)
        expect(cfg.socials.linkedin).toBe("https://www.linkedin.com/in/old")
    })

    it("keeps unsupported and unsafe socials as review warnings instead of claiming them", async () => {
        expect(unsupportedSocialWarnings(draft).join(" ")).toContain("unsupported.example")
        const unsafe = { ...draft, socials: [{ label: "X", url: "javascript:alert(1)", sourceIds: ["s1"] }, { label: "C", url: "https://user:pw@x.com/a", sourceIds: ["s1"] }] }
        const { supported, unsupported } = partitionSocials(unsafe)
        expect(Object.keys(supported)).toHaveLength(0)
        expect(unsupported).toHaveLength(2)
        const tx = txFor()
        await applyProfileBlueprintTx(tx as never, { ...profile, personalityConfig: null }, unsafe, { overwriteProfile: false, applyFeatures: true })
        const cfg = JSON.parse((mocks.profileUpdate.mock.calls[0][0].data as { personalityConfig: string }).personalityConfig)
        expect(Object.keys(cfg.socials || {})).toHaveLength(0)
    })

    it("preflights knowledge limits so over-limit rolls everything back", async () => {
        const tx = txFor()
        mocks.assertLimit.mockRejectedValueOnce(new Error("plan allows 5 knowledge sources"))
        await expect(applyProfileBlueprintTx(tx as never, profile, draft, { overwriteProfile: false, applyFeatures: true })).rejects.toThrow(/knowledge sources/)
        expect(tx.created.profileDocument).toHaveLength(0)
        expect(tx.created.serviceOffering).toHaveLength(0)
        expect(mocks.profileUpdate).not.toHaveBeenCalled()
    })
})

describe("applyProfileImport action", () => {
    const readyJob = {
        id: "job-1", ownerUserId: "user-1", billingAccountId: "acct-1", targetProfileId: "prof-1",
        status: "READY", draft, sources: [], warnings: [], expiresAt: new Date(Date.now() + 86400_000),
        appliedProfileId: null, appliedSlug: null,
    }

    it("blocks cross-owner, cross-account and cross-target applies", async () => {
        mocks.jobFind.mockResolvedValue({ ...readyJob, ownerUserId: "other-user" })
        await expect(applyProfileImport("prof-1", "job-1", draft, { overwriteProfile: false, applyFeatures: true })).rejects.toThrow(/not found/i)
        mocks.jobFind.mockResolvedValue({ ...readyJob, billingAccountId: "acct-2" })
        await expect(applyProfileImport("prof-1", "job-1", draft, { overwriteProfile: false, applyFeatures: true })).rejects.toThrow(/not found/i)
        mocks.jobFind.mockResolvedValue({ ...readyJob, targetProfileId: "prof-2" })
        await expect(applyProfileImport("prof-1", "job-1", draft, { overwriteProfile: false, applyFeatures: true })).rejects.toThrow(/not found/i)
    })

    it("applies once and replays APPLIED with the saved slug", async () => {
        mocks.jobFind.mockResolvedValue(readyJob)
        mocks.jobUpdateMany.mockResolvedValue({ count: 1 })
        mocks.profileFind.mockResolvedValue(profile)
        const first = await applyProfileImport("prof-1", "job-1", draft, { overwriteProfile: false, applyFeatures: true })
        expect(first).toEqual({ profileId: "prof-1", slug: "ada" })

        mocks.jobFind.mockResolvedValue({ ...readyJob, status: "APPLIED", appliedProfileId: "prof-1", appliedSlug: "ada" })
        const second = await applyProfileImport("prof-1", "job-1", draft, { overwriteProfile: false, applyFeatures: true })
        expect(second).toEqual({ profileId: "prof-1", slug: "ada" })
        expect(mocks.jobUpdateMany).toHaveBeenCalledTimes(1)
    })

    it("returns the saved result when a concurrent apply already finished", async () => {
        mocks.jobUpdateMany.mockResolvedValue({ count: 0 })
        mocks.jobFind.mockResolvedValueOnce(readyJob)
        mocks.jobFind.mockResolvedValue({ ...readyJob, status: "APPLIED", appliedProfileId: "prof-1", appliedSlug: "ada" })
        const result = await applyProfileImport("prof-1", "job-1", draft, { overwriteProfile: false, applyFeatures: true })
        expect(result.slug).toBe("ada")
        expect(mocks.profileFind).not.toHaveBeenCalled()
    })
})
