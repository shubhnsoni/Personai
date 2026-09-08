import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const mocks = vi.hoisted(() => ({
    currentUser: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    profileFindUnique: vi.fn(),
    cookies: vi.fn(),
    isAdminEmail: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }))
vi.mock("next/headers", () => ({ cookies: mocks.cookies }))
vi.mock("@/lib/admin/allowlist", () => ({ isAdminEmail: mocks.isAdminEmail }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: mocks.findUnique,
            findFirst: mocks.findFirst,
            create: mocks.create,
            update: mocks.update,
        },
        profile: { findUnique: mocks.profileFindUnique },
    },
}))

import { syncUser } from "@/lib/auth-sync"

function clerkUser(email = "owner@example.com", status: string | null = "verified") {
    return {
        id: "clerk-current",
        primaryEmailAddressId: "primary-email",
        emailAddresses: [{
            id: "primary-email",
            emailAddress: email,
            verification: status === null ? null : { status },
        }],
        firstName: "Account",
        lastName: "Owner",
        username: null,
        imageUrl: "https://example.com/avatar.png",
    }
}

function localUser(clerkId = "clerk-current", email = "owner@example.com") {
    return {
        id: "local-owner",
        clerkId,
        email,
        name: "Account Owner",
        image: "https://example.com/avatar.png",
        role: "USER",
        profiles: [{ id: "owned-profile", slug: "owner", updatedAt: new Date("2026-01-01") }],
    }
}

function uniqueConflict() {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
    })
}

beforeEach(() => {
    vi.resetAllMocks()
    mocks.currentUser.mockResolvedValue(clerkUser())
    mocks.findUnique.mockResolvedValue(null)
    mocks.cookies.mockResolvedValue({ get: vi.fn() })
    mocks.isAdminEmail.mockImplementation((email) => email === "admin@example.com")
})

describe("verified Clerk email synchronization", () => {
    it("adopts an existing account only through the verified primary email", async () => {
        const clerk = clerkUser()
        clerk.emailAddresses.unshift({
            id: "secondary-email",
            emailAddress: "someone-else@example.com",
            verification: { status: "unverified" },
        })
        mocks.currentUser.mockResolvedValue(clerk)
        mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(localUser("clerk-old"))
        mocks.update.mockResolvedValue(localUser())

        const result = await syncUser()

        expect(result?.profiles.map((profile) => profile.id)).toEqual(["owned-profile"])
        expect(mocks.findUnique).toHaveBeenNthCalledWith(2, {
            where: { email: "owner@example.com" }, include: { profiles: true },
        })
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: "local-owner" },
            data: expect.objectContaining({ clerkId: "clerk-current", email: "owner@example.com" }),
            include: { profiles: true },
        })
    })

    it.each(["unverified", "failed", "expired", null])(
        "denies synchronization before account lookup for verification status %s",
        async (status) => {
            mocks.currentUser.mockResolvedValue(clerkUser("owner@example.com", status))
            mocks.findUnique.mockResolvedValue(localUser("clerk-other"))

            expect(await syncUser()).toBeNull()
            expect(mocks.findUnique).not.toHaveBeenCalled()
            expect(mocks.findFirst).not.toHaveBeenCalled()
            expect(mocks.create).not.toHaveBeenCalled()
            expect(mocks.update).not.toHaveBeenCalled()
            expect(mocks.cookies).not.toHaveBeenCalled()
        },
    )

    it("does not use a verified secondary email to trust an unverified primary email", async () => {
        const clerk = clerkUser("admin@example.com", "unverified")
        clerk.emailAddresses.unshift({
            id: "secondary-email",
            emailAddress: "owner@example.com",
            verification: { status: "verified" },
        })
        mocks.currentUser.mockResolvedValue(clerk)

        expect(await syncUser()).toBeNull()
        expect(mocks.findUnique).not.toHaveBeenCalled()
        expect(mocks.isAdminEmail).not.toHaveBeenCalled()
    })

    it("promotes a bound account when its allowlisted primary email is verified", async () => {
        const existing = localUser("clerk-current", "admin@example.com")
        mocks.currentUser.mockResolvedValue(clerkUser("admin@example.com"))
        mocks.findUnique.mockResolvedValue(existing)
        mocks.update.mockResolvedValue({ ...existing, role: "ADMIN" })

        expect((await syncUser())?.role).toBe("ADMIN")
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: existing.id },
            data: expect.objectContaining({ email: "admin@example.com", role: "ADMIN" }),
            include: { profiles: true },
        })
    })

    it("denies an unverified allowlisted email even for an already bound account", async () => {
        mocks.currentUser.mockResolvedValue(clerkUser("admin@example.com", "unverified"))
        mocks.findUnique.mockResolvedValue(localUser("clerk-current", "admin@example.com"))

        expect(await syncUser()).toBeNull()
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.isAdminEmail).not.toHaveBeenCalled()
        expect(mocks.profileFindUnique).not.toHaveBeenCalled()
    })

    it("creates verified users without granting an unlisted email admin access", async () => {
        mocks.create.mockResolvedValue(localUser())

        expect((await syncUser())?.role).toBe("USER")
        expect(mocks.create.mock.calls[0][0].data).toEqual({
            clerkId: "clerk-current",
            email: "owner@example.com",
            name: "Account Owner",
            image: "https://example.com/avatar.png",
        })
    })
})

describe("concurrent account creation isolation", () => {
    it("recovers the row created for the same authenticated Clerk ID", async () => {
        mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(localUser())
        mocks.create.mockRejectedValue(uniqueConflict())

        expect((await syncUser())?.clerkId).toBe("clerk-current")
        expect(mocks.findUnique).toHaveBeenLastCalledWith({
            where: { clerkId: "clerk-current" }, include: { profiles: true },
        })
        expect(mocks.findFirst).not.toHaveBeenCalled()
    })

    it("never returns another Clerk account through an email collision", async () => {
        const conflict = uniqueConflict()
        mocks.create.mockRejectedValue(conflict)
        mocks.findFirst.mockResolvedValue(localUser("clerk-other"))

        await expect(syncUser()).rejects.toBe(conflict)
        expect(mocks.findUnique).toHaveBeenLastCalledWith({
            where: { clerkId: "clerk-current" }, include: { profiles: true },
        })
        expect(mocks.findFirst).not.toHaveBeenCalled()
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.cookies).not.toHaveBeenCalled()
    })

    it("preserves unrelated database errors", async () => {
        const failure = new Error("Database unavailable")
        mocks.create.mockRejectedValue(failure)

        await expect(syncUser()).rejects.toBe(failure)
        expect(mocks.findUnique).toHaveBeenCalledTimes(2)
    })
})
