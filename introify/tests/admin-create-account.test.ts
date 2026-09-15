// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    clerkUsersList: vi.fn(),
    clerkCreateUser: vi.fn(),
    clerkInvite: vi.fn(),
    userFindUnique: vi.fn(),
    userCreate: vi.fn(),
    userUpdate: vi.fn(),
    profileFindMany: vi.fn(),
    profileFindUnique: vi.fn(),
    workspaceFindUnique: vi.fn(),
    auditCreate: vi.fn(),
    ensureBilling: vi.fn(),
    withAccountLimit: vi.fn(),
    runImport: vi.fn(),
    applyImport: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@clerk/nextjs/server", () => ({
    clerkClient: async () => ({
        users: { getUserList: mocks.clerkUsersList, createUser: mocks.clerkCreateUser },
        invitations: { createInvitation: mocks.clerkInvite },
    }),
}))
vi.mock("@/lib/admin/require-admin", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: { findUnique: mocks.userFindUnique, create: mocks.userCreate, update: mocks.userUpdate },
        profile: { findMany: mocks.profileFindMany, findUnique: mocks.profileFindUnique, create: vi.fn(), update: vi.fn() },
        workspace: { findUnique: mocks.workspaceFindUnique, create: vi.fn() },
        membership: { create: vi.fn() },
        auditEvent: { create: mocks.auditCreate },
    },
}))
vi.mock("@/lib/billing/service", () => ({
    ensureDefaultBillingAccount: mocks.ensureBilling,
    withAccountLimit: mocks.withAccountLimit,
    billingTransaction: async (work: (tx: unknown) => Promise<unknown>) => work({}),
    lockBillingAccount: vi.fn(),
    ensureMonthlyGrants: vi.fn(),
}))
vi.mock("@/lib/profile-import-run", () => ({
    runProfileImportGeneration: mocks.runImport,
    applyOwnedProfileImport: mocks.applyImport,
}))

import { createAdminAccount } from "@/app/actions/admin"
import { provisionAdminAccount } from "@/lib/admin/create-account"

const admin = { id: "admin-1", email: "ops@introify.com", role: "ADMIN" }
const createdProfile = { id: "prof-new", slug: "ada-labs", displayName: "Ada Labs", userId: "user-new" }

function txThatCreatesProfile() {
    return {
        profile: {
            findUnique: vi.fn(async () => null),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...createdProfile, ...data })),
            update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...createdProfile, ...data })),
        },
        workspace: { create: vi.fn(async () => ({ id: "ws-1" })) },
        membership: { create: vi.fn(async () => ({ id: "mem-1" })) },
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue(admin)
    mocks.clerkUsersList.mockResolvedValue({ data: [] })
    mocks.clerkCreateUser.mockResolvedValue({ id: "clerk-new" })
    mocks.clerkInvite.mockResolvedValue({ id: "inv-1" })
    mocks.userFindUnique.mockResolvedValue(null)
    mocks.userCreate.mockResolvedValue({ id: "user-new", email: "ada@example.com", clerkId: "clerk-new", name: "Ada Lovelace" })
    mocks.userUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "user-new", email: "ada@example.com", clerkId: "clerk-new", ...data }))
    mocks.profileFindMany.mockResolvedValue([])
    mocks.profileFindUnique.mockResolvedValue(null)
    mocks.workspaceFindUnique.mockResolvedValue(null)
    mocks.ensureBilling.mockResolvedValue({ id: "acct-1", ownerUserId: "user-new" })
    mocks.withAccountLimit.mockImplementation(async (_id: string, _kind: string, _delta: number, work: (tx: unknown) => Promise<unknown>) => work(txThatCreatesProfile()))
    mocks.auditCreate.mockResolvedValue({})
    mocks.runImport.mockResolvedValue({
        id: "job-1",
        status: "READY",
        draft: { version: 1, profile: { displayName: "Ada Labs", headline: "Engineer", bio: "From sources.", welcome: "Hi", sourceIds: ["s1"] } },
        sources: [],
        warnings: [],
        appliedProfileId: null,
        slug: null,
    })
    mocks.applyImport.mockResolvedValue({ profileId: "prof-new", slug: "ada-labs" })
})

describe("provisionAdminAccount", () => {
    it("creates Clerk + local user + profile for a new email", async () => {
        const result = await provisionAdminAccount({
            email: "ada@example.com",
            name: "Ada Lovelace",
            displayName: "Ada Labs",
            bio: "Builds computing machines.",
            phone: "+15551212",
            needId: "time",
        })
        expect(mocks.clerkCreateUser).toHaveBeenCalledWith(expect.objectContaining({
            emailAddress: ["ada@example.com"],
            skipPasswordRequirement: true,
        }))
        expect(mocks.userCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ email: "ada@example.com", clerkId: "clerk-new" }),
        }))
        expect(result).toMatchObject({
            createdUser: true,
            createdProfile: true,
            userId: "user-new",
            profileId: "prof-new",
            slug: "ada-labs",
            email: "ada@example.com",
        })
        expect(mocks.clerkInvite).toHaveBeenCalled()
    })

    it("attaches an existing email without creating a second Clerk user", async () => {
        mocks.clerkUsersList.mockResolvedValue({ data: [{ id: "clerk-existing", firstName: "Ada", lastName: "Lovelace" }] })
        mocks.userFindUnique.mockResolvedValue({
            id: "user-existing",
            email: "ada@example.com",
            clerkId: "clerk-existing",
            name: "Ada Lovelace",
            profiles: [{ id: "prof-old", slug: "ada-old", displayName: "Old", billingAccountId: "acct-1" }],
        })
        mocks.profileFindMany.mockResolvedValue([{ id: "prof-old", slug: "ada-old", displayName: "Old", billingAccountId: "acct-1" }])
        mocks.ensureBilling.mockResolvedValue({ id: "acct-1", ownerUserId: "user-existing" })
        mocks.withAccountLimit.mockImplementation(async (_id, _kind, delta: number, work: (tx: { profile: { update: ReturnType<typeof vi.fn> } }) => Promise<unknown>) => {
            expect(delta).toBe(0)
            const tx = {
                profile: {
                    findUnique: vi.fn(async () => ({ id: "prof-old", slug: "ada-old", billingAccountId: "acct-1" })),
                    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "prof-old", slug: "ada-old", displayName: data.displayName, userId: "user-existing" })),
                    create: vi.fn(),
                },
                workspace: { create: vi.fn() },
                membership: { create: vi.fn() },
            }
            return work(tx)
        })

        const result = await provisionAdminAccount({
            email: "ada@example.com",
            displayName: "Ada Labs",
            bio: "Updated bio",
        })
        expect(mocks.clerkCreateUser).not.toHaveBeenCalled()
        expect(mocks.userCreate).not.toHaveBeenCalled()
        expect(result).toMatchObject({
            createdUser: false,
            createdProfile: false,
            userId: "user-existing",
            profileId: "prof-old",
            slug: "ada-old",
        })
    })

    it("rejects when Clerk and local rows disagree in a way that needs a merge decision", async () => {
        mocks.clerkUsersList.mockResolvedValue({
            data: [
                { id: "clerk-a", firstName: "Ada" },
                { id: "clerk-b", firstName: "Other" },
            ],
        })
        await expect(provisionAdminAccount({ email: "ada@example.com" })).rejects.toThrow(/merge/i)
        expect(mocks.userCreate).not.toHaveBeenCalled()
    })

    it("runs the import pipeline for pasted text after the profile exists", async () => {
        const result = await provisionAdminAccount({
            email: "ada@example.com",
            displayName: "Ada Labs",
            runImport: true,
            importText: "Ada builds computing machines in London.",
            importLinks: ["https://ada.dev"],
        })
        expect(mocks.runImport).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-new", accountId: "acct-1", targetProfileId: "prof-new" }),
            expect.objectContaining({ text: "Ada builds computing machines in London.", links: ["https://ada.dev"] }),
        )
        expect(mocks.applyImport).toHaveBeenCalled()
        expect(result.import).toMatchObject({ status: "APPLIED" })
    })
})

describe("createAdminAccount action", () => {
    it("requires admin, audits, and never leaks Prisma codes", async () => {
        const result = await createAdminAccount({
            email: "ada@example.com",
            name: "Ada Lovelace",
            displayName: "Ada Labs",
        })
        expect(result).toMatchObject({ ok: true, userId: "user-new", slug: "ada-labs" })
        expect(mocks.requireAdmin).toHaveBeenCalled()
        expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: "create_account", actorUserId: "admin-1" }),
        }))
    })

    it("returns a user-facing error instead of SQL text", async () => {
        mocks.clerkCreateUser.mockRejectedValue(new Error("Unique constraint failed on the fields: (`email`) prisma P2002"))
        mocks.clerkUsersList.mockResolvedValue({ data: [] })
        const result = await createAdminAccount({ email: "ada@example.com" })
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error("expected failure")
        expect(result.error).not.toMatch(/prisma|p2002|sql/i)
        expect(result.error.length).toBeGreaterThan(0)
    })
})
