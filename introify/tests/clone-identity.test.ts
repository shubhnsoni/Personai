import { describe, expect, it } from "vitest"
import { cloneClosingReminder, cloneOperatingPrompt } from "@/lib/clone-identity"
import { writeGoldBoard } from "@/lib/metal/board"
import { buildSystemPrompt } from "@/lib/rag"

const jewellery = {
    displayName: "Mehta Jewellers",
    headline: "Gold by weight",
    bio: "Family showroom.",
    roleTemplate: "JEWELRY_RETAIL",
    primaryGoal: "SELL_PRODUCTS",
    language: "en",
    welcomeMessageOverride: null,
    personalityConfig: writeGoldBoard("{}", {
        city: "Mumbai",
        citySlug: "mumbai",
        asOf: "2026-09-08T10:00:00.000Z",
        source: "city-feed",
        k22PaisePer10g: 14_240_000,
        k24PaisePer10g: 15_500_000,
        k18PaisePer10g: 11_650_000,
    }),
    whatsapp: "919800011122",
    upiId: "mehta@upi",
    liveChatEnabled: true,
    workExperiences: [],
    projects: [],
    serviceOfferings: [],
    digitalProducts: [{ title: "22K chain", description: "22K", type: "PHYSICAL", priceCents: 0, fulfillment: "PHYSICAL", stock: 3 }],
}

describe("clone identity", () => {
    it("tells every model it is the shop, not Grok or Codex", () => {
        const prompt = cloneOperatingPrompt(jewellery)
        expect(prompt).toMatch(/Mehta Jewellers's AI/)
        expect(prompt).toMatch(/not Grok, ChatGPT/)
        expect(prompt).toMatch(/jewellery showroom/)
        expect(prompt).toMatch(/Never invent a rate/)
        expect(prompt).toMatch(/live chat/)
        expect(prompt).not.toMatch(/book a call to discuss/)
    })

    it("is baked into the system prompt regardless of catalog size", () => {
        const system = buildSystemPrompt(jewellery, [], "INR")
        expect(system.startsWith("# Who you are")).toBe(true)
        expect(system).toContain("Stay in character as Mehta Jewellers's assistant")
        expect(system).toContain("Today's Mumbai gold board")
        expect(system).toContain(cloneClosingReminder("Mehta Jewellers"))
    })

    it("uses a practice voice for consultants", () => {
        const prompt = cloneOperatingPrompt({
            displayName: "Ada",
            roleTemplate: "CONSULTANT",
            primaryGoal: "BOOK_CALL",
            language: "en",
        })
        expect(prompt).toMatch(/speak as Ada/)
        expect(prompt).toMatch(/book a call/)
    })
})
