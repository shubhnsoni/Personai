// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ billing: vi.fn(), count: vi.fn(), events: vi.fn(), conversations: vi.fn(), leads: vi.fn(), payments: vi.fn() }))
vi.mock("@/lib/billing/service", () => ({ getProfileBilling: mocks.billing }))
vi.mock("@/lib/prisma", () => ({ prisma: {
    profileEvent: { count: mocks.count, findMany: mocks.events }, conversation: { count: mocks.count, findMany: mocks.conversations }, visitorLead: { count: mocks.count, findMany: mocks.leads }, booking: { count: mocks.count }, payment: { aggregate: async () => ({ _sum: { amountCents: 1000 } }), findMany: mocks.payments }, productPurchase: { count: mocks.count }, courseEnrollment: { count: mocks.count },
} }))
import { buildHomeStats } from "@/lib/analytics"
import { publicAnimationConfig, INTROIFY_PUBLIC_STYLE, canHideIntroifyBrand } from "@/lib/profile-branding"
import { validateAiSettings } from "@/lib/ai-settings"
beforeEach(() => {
    vi.clearAllMocks()
    mocks.billing.mockResolvedValue({ features: { advancedAnalytics: false, customBranding: false } })
    mocks.count.mockResolvedValue(10)
    mocks.events.mockResolvedValue([])
    mocks.conversations.mockResolvedValue([])
    mocks.leads.mockResolvedValue([])
    mocks.payments.mockResolvedValue([])
})
describe("paid presentation features", () => {
    it("keeps basic counts but never queries advanced report rows on Free", async () => {
        const stats = await buildHomeStats({ id: "shop", roleTemplate: "CONSULTANT" })
        expect(stats).toMatchObject({ visits: 10, chats: 10, advancedAnalytics: false, series: [], sources: [], funnel: { visits: 0, chats: 0, leads: 0, buys: 0 } })
        expect(mocks.events).not.toHaveBeenCalled()
        expect(mocks.leads).not.toHaveBeenCalled()
        expect(mocks.payments).not.toHaveBeenCalled()
        // The remaining conversation read is the operational unanswered-message count.
        expect(mocks.conversations).toHaveBeenCalledOnce()
        expect(mocks.conversations.mock.calls[0][0].select).toHaveProperty("messages")
    })
    it("unlocks source and trend reports only with the server entitlement", async () => {
        mocks.billing.mockResolvedValue({ features: { advancedAnalytics: true } })
        const stats = await buildHomeStats({ id: "shop", roleTemplate: "CONSULTANT" })
        expect(stats.advancedAnalytics).toBe(true)
        expect(stats.series).toHaveLength(30)
        expect(mocks.events).toHaveBeenCalledTimes(2)
    })
    it("fails closed for advanced data when billing is unavailable", async () => {
        mocks.billing.mockRejectedValue(new Error("offline"))
        expect((await buildHomeStats({ id: "shop", roleTemplate: "CONSULTANT" })).advancedAnalytics).toBe(false)
        expect(mocks.events).not.toHaveBeenCalled()
    })
    it("ignores legacy custom public themes after downgrade", async () => {
        expect(await publicAnimationConfig("shop", { colors: ["#ff0000"], variant: "ember" })).toEqual(INTROIFY_PUBLIC_STYLE)
        expect(canHideIntroifyBrand(false, '{"hideIntroifyBrand":true}')).toBe(false)
    })
    it("requires both paid branding and an explicit choice to remove the platform footer", async () => {
        mocks.billing.mockResolvedValue({ features: { customBranding: true } })
        expect(await publicAnimationConfig("shop", { variant: "ember" })).toEqual({ variant: "ember" })
        expect(canHideIntroifyBrand(true, '{"hideIntroifyBrand":true}')).toBe(true)
        expect(canHideIntroifyBrand(true, '{"hideIntroifyBrand":"true"}')).toBe(false)
        expect(canHideIntroifyBrand(true)).toBe(false)
    })
    it("strips paid theme and footer-removal fields on direct Free settings writes", () => {
        const saved = validateAiSettings("free", { personalityConfig: '{"orb":{"color":"rouge"},"hideIntroifyBrand":true,"socials":{"website":"https://example.test"}}' })
        expect(JSON.parse(saved.personalityConfig!)).toEqual({ socials: { website: "https://example.test" } })
    })
})
