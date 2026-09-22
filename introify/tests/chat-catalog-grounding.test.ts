import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canonicalWhatsAppDigits } from "@/lib/whatsapp/phone"
import {
    answerCatalogPriceQuestion,
    chatWhatsAppDigits,
    compactCatalogFacts,
    findCatalogItemByQuery,
} from "@/lib/chat-catalog"

const menu = [
    { title: "Iced Latte", priceCents: 16900, currency: "INR", diet: "VEG", category: "Coffee & Beverages" },
    { title: "Cream Of Tomato", priceCents: 15900, currency: "INR", diet: "VEG", category: "Soup" },
]

describe("canonical WhatsApp digits (P1-9)", () => {
    it("keeps the full SkyDine wa.me body — never truncates to 919262268", () => {
        expect(canonicalWhatsAppDigits("919262268837")).toBe("919262268837")
        expect(canonicalWhatsAppDigits("+91 92622 68837")).toBe("919262268837")
        expect(chatWhatsAppDigits("919262268837")).toBe("919262268837")
        expect(chatWhatsAppDigits("919262268837")).not.toBe("919262268")
    })
})

describe("chat catalog grounding (P1-9)", () => {
    it("finds Iced Latte and answers the live INR price", () => {
        const hit = findCatalogItemByQuery(menu, "What is the price of Iced Latte?")
        expect(hit?.title).toBe("Iced Latte")
        const answer = answerCatalogPriceQuestion({
            query: "What is the price of Iced Latte?",
            items: menu,
            roleTemplate: "CAFE",
            requestCurrency: "USD",
            shopName: "SkyDine Cafe",
            whatsapp: "919262268837",
        })
        expect(answer).toMatch(/Iced Latte/)
        expect(answer).toMatch(/₹\s?169|₹169/)
        expect(answer).toMatch(/919262268837/)
        expect(answer).not.toMatch(/919262268(?!837)/)
    })

    it("puts compact catalog + full WhatsApp into chat facts/tools for CAFE kits", () => {
        const facts = compactCatalogFacts(menu, "CAFE", "USD")
        expect(facts[0]).toMatchObject({ title: "Iced Latte", price: expect.stringMatching(/₹/) })

        const handler = readFileSync(join(process.cwd(), "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/compactCatalogFacts/)
        expect(handler).toMatch(/foodKit/)
        expect(handler).toMatch(/answerCatalogPriceQuestion/)
        // P1-9 short-circuit: restaurant catalog price settles before LLM path
        expect(handler).toMatch(/restaurantCatalogPrice/)
        expect(handler).toMatch(/restaurant_catalog_price/)
        expect(handler).toMatch(/\|\|\s*Boolean\(restaurantCatalogPrice\)/)
        const priceGate = handler.indexOf("const restaurantCatalogPrice")
        const llmGate = handler.indexOf('if (!reservation) return Response.json({ error: "ai_allowance_unavailable" }')
        expect(priceGate).toBeGreaterThan(-1)
        expect(llmGate).toBeGreaterThan(priceGate)

        const rag = readFileSync(join(process.cwd(), "src/lib/rag.ts"), "utf8")
        expect(rag).toMatch(/kitRole === "RESTAURANT"/)
        expect(rag).toMatch(/chatWhatsAppDigits/)

        const runtime = readFileSync(join(process.cwd(), "src/lib/ai-runtime.ts"), "utf8")
        expect(runtime).toMatch(/wantsPrice && hasTool\("showMenu"\)/)
    })

    it("matches Iced Latte even with filler words / punctuation", () => {
        expect(findCatalogItemByQuery(menu, "price of iced latte???" )?.title).toBe("Iced Latte")
        expect(findCatalogItemByQuery(menu, "How much is an Iced Latte")?.title).toBe("Iced Latte")
        const answer = answerCatalogPriceQuestion({
            query: "What's the cost of Iced Latte?",
            items: menu,
            roleTemplate: "CAFE",
            requestCurrency: "USD",
            shopName: "SkyDine Cafe",
            whatsapp: "919262268837",
        })
        expect(answer).toMatch(/169/)
        expect(answer).toMatch(/₹/)
    })
})
