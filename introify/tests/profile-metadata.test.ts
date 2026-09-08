import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { findUnique: db.findUnique } } }))
vi.mock("@/components/profile/profile-view", () => ({ ProfileView: () => null }))
import { generateMetadata } from "@/app/[slug]/page"

describe("profile metadata privacy", () => {
    beforeEach(() => {
        db.findUnique.mockReset()
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test")
    })

    it("does not expose any private profile fields through page metadata", async () => {
        db.findUnique.mockResolvedValue({ slug: "private-person", displayName: "Private name", headline: "Private headline", bio: "Private biography", isPublic: false })
        const metadata = await generateMetadata({ params: Promise.resolve({ slug: "private-person" }) })
        expect(metadata).toEqual({ title: "Profile Not Found", robots: { index: false, follow: false } })
        expect(JSON.stringify(metadata)).not.toMatch(/Private name|Private headline|Private biography|private-person/)
        expect(db.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ isPublic: true }) }))
    })

    it("marks missing profiles as noindex", async () => {
        db.findUnique.mockResolvedValue(null)
        expect((await generateMetadata({ params: Promise.resolve({ slug: "missing" }) })).robots).toEqual({ index: false, follow: false })
    })

    it("indexes published profiles with their own canonical while keeping demos out of search", async () => {
        db.findUnique.mockResolvedValue({ slug: "ada-lovelace", displayName: "Ada", headline: "Consultant", bio: "", isPublic: true })
        const metadata = await generateMetadata({ params: Promise.resolve({ slug: "ada-lovelace" }) })
        expect(metadata.alternates?.canonical).toBe("https://example.test/ada-lovelace")
        expect(metadata.robots).toEqual({ index: true, follow: true })
        db.findUnique.mockResolvedValue({ slug: "try-consultant", displayName: "Demo", headline: "Example profile", bio: "", isPublic: true })
        expect((await generateMetadata({ params: Promise.resolve({ slug: "try-consultant" }) })).robots).toEqual({ index: false, follow: true })
    })
})
