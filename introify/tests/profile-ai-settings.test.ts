// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ execute: vi.fn(), billing: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/security", () => ({ executeProfileResourceWrite: mocks.execute, requireProfileAccess: vi.fn(), unwrapOwnershipResult: (result: { ok: boolean; value: unknown }) => { if (!result.ok) throw new Error("denied"); return result.value } }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: mocks.billing }))
vi.mock("@/lib/prisma", () => ({ prisma: { profile: { updateMany: mocks.update } } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { updateProfile } from "@/app/actions/profile"
import { getPlan } from "@/lib/billing/catalog"
beforeEach(() => {
    vi.clearAllMocks()
    mocks.execute.mockImplementation(async input => ({ ok: true, value: await input.writeOwned({ resourceId: "shop", profile: { id: "shop", userId: "owner" } }) }))
    mocks.billing.mockResolvedValue({ planId: "free", features: getPlan("free").features })
    mocks.update.mockResolvedValue({ count: 1 })
})
describe("profile settings server boundary", () => {
    it("requires settings-write membership before consulting billing", async () => {
        mocks.execute.mockResolvedValue({ ok: false })
        await expect(updateProfile("shop", { aiModel: "fast" })).rejects.toThrow("denied")
        expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ permission: "settings.write", claimedProfileId: "shop" }))
        expect(mocks.billing).not.toHaveBeenCalled()
    })
    it("rejects direct premium selection before DB mutation", async () => {
        await expect(updateProfile("shop", { aiModel: "reasoning" })).rejects.toThrow("not included")
        expect(mocks.update).not.toHaveBeenCalled()
    })
    it("saves business identity free while ignoring paid theme writes", async () => {
        await updateProfile("shop", { displayName: "A real business", shopLogoUrl: "/uploads/logo.png", animationStyleId: "premium", personalityConfig: '{"hideIntroifyBrand":true}' })
        expect(mocks.update).toHaveBeenCalledWith({ where: { id: "shop", userId: "owner" }, data: expect.objectContaining({ displayName: "A real business", shopLogoUrl: "/uploads/logo.png", animationStyleId: undefined, personalityConfig: "{}" }) })
    })
    it("requires a photo when orbit is enabled through a direct settings write", async () => {
        await expect(updateProfile("shop", { imageUrl: "  ", personalityConfig: '{"orb":{"theme":"planet-azure","orbitProfile":true}}' })).rejects.toThrow("Set up your profile photo")
        expect(mocks.update).not.toHaveBeenCalled()
    })
    it("allows uploading a photo and enabling orbit together", async () => {
        await updateProfile("shop", { imageUrl: "/uploads/profile.webp", personalityConfig: '{"orb":{"theme":"planet-azure","orbitProfile":true}}' })
        const saved = mocks.update.mock.calls[0][0].data
        expect(saved.imageUrl).toBe("/uploads/profile.webp")
        // Planets are Premium: a Free write keeps the orbit but rests on the Classic bot.
        expect(JSON.parse(saved.personalityConfig).orb).toMatchObject({ theme: "classic", orbitProfile: true })
    })
    it("uses an existing photo for partial writes instead of clearing it", async () => {
        mocks.execute.mockImplementation(async input => ({ ok: true, value: await input.writeOwned({ resourceId: "shop", profile: { id: "shop", userId: "owner", imageUrl: "/uploads/profile.webp" } }) }))
        await updateProfile("shop", { personalityConfig: '{"orb":{"orbitProfile":true}}' })
        const saved = mocks.update.mock.calls[0][0].data
        expect(saved.imageUrl).toBeUndefined()
        expect(JSON.parse(saved.personalityConfig).orb.orbitProfile).toBe(true)
    })
    it("turns orbit off when a photo is removed without losing the selected bot", async () => {
        mocks.execute.mockImplementation(async input => ({ ok: true, value: await input.writeOwned({ resourceId: "shop", profile: { id: "shop", userId: "owner", imageUrl: "/uploads/profile.webp", personalityConfig: '{"orb":{"theme":"planet-sage","orbitProfile":true},"socials":{"website":"https://example.test"}}' } }) }))
        await updateProfile("shop", { imageUrl: "" })
        const saved = mocks.update.mock.calls[0][0].data
        expect(saved.imageUrl).toBeNull()
        expect(JSON.parse(saved.personalityConfig)).toEqual({ orb: { theme: "planet-sage", orbitProfile: false }, socials: { website: "https://example.test" } })
    })
})
