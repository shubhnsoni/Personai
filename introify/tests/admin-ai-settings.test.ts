import { describe, expect, it } from "vitest"
import { isAdminEmail } from "@/lib/admin/allowlist"
import { parsePlatformAiSettings, pickProviderOrder } from "@/lib/admin/ai-settings"
import { shopSetupChecks } from "@/lib/admin/setup-score"

describe("admin allowlist", () => {
    it("matches emails in ADMIN_EMAILS", () => {
        const prev = process.env.ADMIN_EMAILS
        process.env.ADMIN_EMAILS = "ops@example.com, You@Example.com"
        expect(isAdminEmail("you@example.com")).toBe(true)
        expect(isAdminEmail("other@example.com")).toBe(false)
        if (prev === undefined) delete process.env.ADMIN_EMAILS
        else process.env.ADMIN_EMAILS = prev
    })
})

describe("platform AI settings", () => {
    it("parses kill switches and fallbacks", () => {
        const settings = parsePlatformAiSettings(JSON.stringify({
            defaultProvider: "xai",
            fallback: ["openai"],
            kill: { codex: true },
            models: { xai: "grok-4.5" },
        }))
        expect(settings.defaultProvider).toBe("xai")
        expect(settings.kill.codex).toBe(true)
        expect(settings.models.xai).toBe("grok-4.5")
    })

    it("skips killed providers in the pick order", () => {
        const settings = parsePlatformAiSettings(JSON.stringify({
            defaultProvider: "codex",
            fallback: ["xai", "openai"],
            kill: { codex: true, xai: false, openai: false },
        }))
        const order = pickProviderOrder(settings, null)
        expect(order.includes("codex")).toBe(false)
    })
})

describe("shop setup score", () => {
    it("flags a public shop with no catalog as pending", () => {
        const result = shopSetupChecks({
            slug: "try-jewelry-retail",
            roleTemplate: "JEWELRY_RETAIL",
            isPublic: true,
            displayName: "Jewellery store",
            imageUrl: null,
            shopLogoUrl: null,
            whatsapp: null,
            upiId: null,
            _count: { digitalProducts: 0, conversations: 0 },
        })
        expect(result.pending.length).toBeGreaterThan(0)
        expect(result.score).toBeLessThan(100)
    })
})
