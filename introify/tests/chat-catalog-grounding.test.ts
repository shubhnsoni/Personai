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
import { resolveKitRole } from "@/lib/role-alias"

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

describe("P1-3 bakery/sweets catalog price + desk alias", () => {
    const bakeryMenu = [
        { title: "Butter croissant", priceCents: 7000, currency: "INR", diet: "VEG", category: "Pastry" },
        { title: "Chocolate brownie", priceCents: 9000, currency: "INR", diet: "VEG", category: "Cake" },
    ]
    const sweetsMenu = [
        { title: "Gulab jamun 500g", priceCents: 18000, currency: "INR", diet: "VEG", category: "Mithai" },
    ]

    it("aliases BAKERY and SWEETS to RESTAURANT desk (same short-circuit as cafe)", () => {
        expect(resolveKitRole("BAKERY")).toBe("RESTAURANT")
        expect(resolveKitRole("SWEETS")).toBe("RESTAURANT")
        expect(resolveKitRole("CAFE")).toBe("RESTAURANT")
        const handler = readFileSync(join(process.cwd(), "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/const restaurantDesk = resolveKitRole\(profile\.roleTemplate\) === "RESTAURANT"/)
        expect(handler).toMatch(/restaurantCatalogPrice/)
    })

    it("answers Butter croissant ₹70 for BAKERY role with full WhatsApp", () => {
        const answer = answerCatalogPriceQuestion({
            query: "What is the price of Butter croissant?",
            items: bakeryMenu,
            roleTemplate: "BAKERY",
            requestCurrency: "USD",
            shopName: "Baker's Fresh",
            whatsapp: "919934112233",
        })
        expect(answer).toMatch(/Butter croissant/)
        expect(answer).toMatch(/₹\s?70|₹70/)
        expect(answer).toMatch(/919934112233/)
        expect(answer).not.toMatch(/919934112(?!233)/)
    })

    it("answers Gulab jamun 500g ₹180 for SWEETS role with full WhatsApp", () => {
        const answer = answerCatalogPriceQuestion({
            query: "What is the price of Gulab jamun 500g?",
            items: sweetsMenu,
            roleTemplate: "SWEETS",
            requestCurrency: "USD",
            shopName: "Samriddhi Sweets",
            whatsapp: "+91 94311 88776",
        })
        expect(answer).toMatch(/Gulab jamun 500g/)
        expect(answer).toMatch(/₹\s?180|₹180/)
        expect(answer).toMatch(/919431188776/)
    })

    it("answers Chocolate brownie ₹90 on bakers-fresh style query", () => {
        const answer = answerCatalogPriceQuestion({
            query: "How much is a Chocolate brownie?",
            items: bakeryMenu,
            roleTemplate: "BAKERY",
            requestCurrency: "INR",
            shopName: "Baker's Fresh",
            whatsapp: "919934112233",
        })
        expect(answer).toMatch(/Chocolate brownie/)
        expect(answer).toMatch(/90/)
        expect(answer).toMatch(/₹/)
    })
})
