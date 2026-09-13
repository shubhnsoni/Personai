// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    jobFind: vi.fn(),
    jobUpdate: vi.fn(),
    jobUpdateMany: vi.fn(),
    accountFind: vi.fn(),
    profileFind: vi.fn(),
    profileFindFirst: vi.fn(),
    profileCreate: vi.fn(),
    workspaceFind: vi.fn(),
    assertLimit: vi.fn(),
    cookieSet: vi.fn(),
    tx: null as null | Record<string, { [m: string]: ReturnType<typeof vi.fn> }>,
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: mocks.cookieSet })) }))
vi.mock("@/lib/security", () => ({
    requireAuthenticatedUser: vi.fn(async () => ({ ok: true, value: { userId: "user-1", profiles: [] } })),
    unwrapOwnershipResult: (r: { ok: boolean; value?: unknown; refusal?: { message: string } }) => { if (!r.ok) throw new Error(r.refusal?.message); return r.value },
}))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        billingAccount: { findUnique: mocks.accountFind },
        profileImportJob: { findUnique: mocks.jobFind },
        profile: { findUnique: mocks.profileFind, findFirst: mocks.profileFindFirst },
        workspace: { findUnique: mocks.workspaceFind },
    },
}))
vi.mock("@/lib/billing/service", () => ({
    ensureDefaultBillingAccount: vi.fn(async () => ({ id: "acct-1", ownerUserId: "user-1" })),
    assertAccountLimit: mocks.assertLimit,
    withAccountLimit: async (_accountId: string, _kind: string, delta: number | ((tx: unknown) => Promise<number>), work: (tx: unknown) => Promise<unknown>) => {
        const tx = mocks.tx!
        await mocks.assertLimit({ kind: "businesses", delta: typeof delta === "function" ? await delta(tx) : delta })
        return work(tx)
    },
    lockBillingAccount: vi.fn(),
    getProfileBilling: vi.fn(),
    reserveUsage: vi.fn(),
    settleUsage: vi.fn(),
}))

import { createProfile } from "@/app/actions/onboarding"
import type { ProfileBlueprint } from "@/lib/profile-import-contract"

const blueprint: ProfileBlueprint = {
    version: 1,
    profile: { displayName: "Ada", headline: "Engineer", bio: "Imported bio.", welcome: "Hi", sourceIds: ["s1"] },
    needId: "time",
    addons: ["services"],
    socials: [],
    experiences: [{ company: "Acme", role: "Eng", startDate: "2020", endDate: null, description: "Did work.", sourceIds: ["s1"] }],
    projects: [],
    services: [{ title: "Call", description: "d", durationMinutes: 30, price: null, currency: "USD", basis: "suggested", sourceIds: ["s1"] }],
    products: [],
    knowledge: [{ title: "Notes", body: "body", visibility: "PUBLIC", basis: "sourced", sourceIds: ["s1"] }],
    introductions: [], frameworks: [], missingInformation: [],
}

function jobRow(over: Record<string, unknown> = {}) {
    return {
        id: "job-1", ownerUserId: "user-1", billingAccountId: "acct-1", targetProfileId: null,
        status: "READY", expiresAt: new Date(Date.now() + 86400_000),
        appliedProfileId: null, appliedSlug: null, ...over,
    }
}

function freshTx() {
    const tx = {
        profileImportJob: { updateMany: mocks.jobUpdateMany, findUniqueOrThrow: mocks.jobFind, findUnique: mocks.jobFind, update: mocks.jobUpdate },
        profile: { create: mocks.profileCreate, findUnique: vi.fn(async () => null), update: vi.fn() },
        workspace: { create: vi.fn(async () => ({ id: "ws-1" })) },
        membership: { create: vi.fn(async () => ({})) },
        serviceOffering: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(async () => []) },
        availabilitySchedule: { createMany: vi.fn() },
        workExperience: { findMany: vi.fn(async () => []), create: vi.fn() },
        project: { findMany: vi.fn(async () => []), create: vi.fn() },
        digitalProduct: { findMany: vi.fn(async () => []), create: vi.fn() },
        profileDocument: { findMany: vi.fn(async () => []), create: vi.fn() },
        profileFramework: { findMany: vi.fn(async () => []), create: vi.fn() },
        profileIntroduction: { findMany: vi.fn(async () => []), create: vi.fn() },
    }
    mocks.tx = tx as never
    return tx
}

const data = {
    displayName: "Ada",
    username: "ada",
    roleTemplate: "SHOP",
    primaryGoal: "wrong-goal",
    importDraft: { id: "job-1", draft: blueprint },
}

beforeEach(() => {
    vi.clearAllMocks()
    freshTx()
    mocks.accountFind.mockResolvedValue({ id: "acct-1", ownerUserId: "user-1" })
    mocks.jobFind.mockResolvedValue(jobRow())
    mocks.jobUpdateMany.mockResolvedValue({ count: 1 })
    mocks.profileCreate.mockImplementation(async ({ data: d }: { data: Record<string, unknown> }) => ({ id: "prof-9", slug: d.slug, displayName: d.displayName, billingAccountId: "acct-1", headline: d.headline, bio: d.bio, personalityConfig: d.personalityConfig, roleTemplate: d.roleTemplate }))
    mocks.profileFind.mockResolvedValue(null)
    mocks.profileFindFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => where.id === "prof-5" ? { id: "prof-5", slug: "ada-live" } : null)
    mocks.workspaceFind.mockResolvedValue(null)
})

describe("createProfile with an import draft", () => {
    it("rejects missing jobs, cross-actor, cross-account and dashboard-target jobs", async () => {
        mocks.jobFind.mockResolvedValue(null)
        await expect(createProfile(data)).rejects.toThrow(/not found/i)
        mocks.jobFind.mockResolvedValue(jobRow({ ownerUserId: "user-2" }))
        await expect(createProfile(data)).rejects.toThrow(/not found/i)
        mocks.jobFind.mockResolvedValue(jobRow({ billingAccountId: "acct-2" }))
        await expect(createProfile(data)).rejects.toThrow(/not found/i)
        mocks.jobFind.mockResolvedValue(jobRow({ targetProfileId: "prof-1" }))
        await expect(createProfile(data)).rejects.toThrow(/not found/i)
        mocks.jobFind.mockResolvedValue(jobRow({ expiresAt: new Date(Date.now() - 1000) }))
        await expect(createProfile(data)).rejects.toThrow(/expired/i)
        mocks.jobFind.mockResolvedValue(jobRow({ status: "FAILED" }))
        await expect(createProfile(data)).rejects.toThrow(/not ready/i)
        expect(mocks.profileCreate).not.toHaveBeenCalled()
    })

    it("derives role/goal from the blueprint need, not the caller's roleTemplate", async () => {
        const result = await createProfile(data)
        expect(result.slug).toBe("ada")
        const created = mocks.profileCreate.mock.calls[0][0].data as Record<string, unknown>
        expect(created.roleTemplate).toBe("CONSULTANT")
        expect(created.primaryGoal).toBe("TAKE_APPOINTMENTS")
        expect(created.headline).toBe("Engineer")
        expect(created.bio).toBe("Imported bio.")

        expect(mocks.tx!.serviceOffering.create).toHaveBeenCalledTimes(1)
        expect(mocks.tx!.serviceOffering.create.mock.calls[0][0].data).toMatchObject({ name: "Call", isActive: false, isFree: false, priceCents: 0 })
        expect(mocks.tx!.availabilitySchedule.createMany).not.toHaveBeenCalled()
        expect(mocks.tx!.workExperience.create).toHaveBeenCalledTimes(1)
    })

    it("rolls the whole creation back when the knowledge limit fails", async () => {
        mocks.assertLimit.mockImplementation((...args: unknown[]) => {
            if (args[2] === "knowledgeSources" || (args[0] as { kind?: string })?.kind === "knowledgeSources") throw new Error("plan allows 0 knowledge sources")
        })
        await expect(createProfile(data)).rejects.toThrow(/knowledge sources/)
    })

    it("replays an already-applied job inside the lock without charging a business", async () => {
        mocks.jobFind.mockResolvedValue(jobRow({ status: "APPLIED", appliedSlug: "ada-live", appliedProfileId: "prof-5" }))
        const result = await createProfile({ ...data, activate: true })
        expect(result).toMatchObject({ slug: "ada-live" })
        expect(mocks.profileCreate).not.toHaveBeenCalled()
        expect(mocks.cookieSet).toHaveBeenCalledWith(expect.any(String), "prof-5", expect.anything())
    })

    it("returns the cached result when a concurrent apply won the CAS", async () => {
        mocks.jobFind
            .mockResolvedValueOnce(jobRow()) // preflight read
            .mockResolvedValue(jobRow({ status: "APPLIED", appliedSlug: "ada-live", appliedProfileId: "prof-5" }))
        mocks.jobUpdateMany.mockResolvedValue({ count: 0 })
        const result = await createProfile(data)
        expect(result.slug).toBe("ada-live")
        expect(mocks.profileCreate).not.toHaveBeenCalled()
    })

    it("leaves the manual path exactly as before", async () => {
        await createProfile({ displayName: "Manual Shop", roleTemplate: "SHOP", primaryGoal: "g", needId: undefined })
        const created = mocks.profileCreate.mock.calls[0][0].data as Record<string, unknown>
        expect(created.roleTemplate).toBe("SHOP")
    })
})
