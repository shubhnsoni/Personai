import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    answerAutoPartsCatalogOrFitment,
    autoPartsMenuPath,
    autoPartsMenuPrimaryCta,
    autoPartsMenuPromptGuidance,
    formatFitmentLine,
    prefersAutoPartsMenuPath,
} from "@/lib/autoparts-chat"
import { cloneOperatingPrompt } from "@/lib/clone-identity"
import { buildSystemPrompt } from "@/lib/rag"
import { generateSuggestions } from "@/lib/suggestions"
import { guestBookEmptyCopy } from "@/lib/kit-copy"
import { fitmentLine } from "@/lib/autoparts/fitment"

const root = process.cwd()

function fitment(make: string, model: string, yearFrom: number, yearTo: number) {
    return JSON.stringify({ fitment: { make, model, yearFrom, yearTo } })
}

const parasCatalog = [
    {
        title: "Front brake pad",
        priceCents: 145_000,
        currency: "INR",
        category: "Brakes",
        stock: 8,
        sku: "PA-BP-SWIFT",
        variantsJson: fitment("Maruti", "Swift", 2018, 2024),
        description: "Fits Maruti Swift 2018–2024.",
    },
    {
        title: "Oil filter",
        priceCents: 28_000,
        currency: "INR",
        category: "Filters",
        stock: 20,
        sku: "PA-OF-I20",
        variantsJson: fitment("Hyundai", "i20", 2015, 2023),
        description: "Fits Hyundai i20 2015–2023.",
    },
    {
        title: "Spark plug set (4)",
        priceCents: 64_000,
        currency: "INR",
        category: "Engine",
        stock: 10,
        sku: "PA-SP-SWIFT",
        variantsJson: fitment("Maruti", "Swift", 2018, 2024),
        description: "Fits Maruti Swift 2018–2024.",
    },
]

describe("auto-p1-1 chat grounds to /menu + fitment not WA-only", () => {
    it("flags AUTO_PARTS for menu path", () => {
        expect(prefersAutoPartsMenuPath("AUTO_PARTS", "SELL_PRODUCTS")).toBe(true)
        expect(prefersAutoPartsMenuPath("AUTO_PARTS", null)).toBe(true)
        expect(prefersAutoPartsMenuPath("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(prefersAutoPartsMenuPath("JEWELRY_RETAIL", "SELL_PRODUCTS")).toBe(false)
        expect(autoPartsMenuPath("paras-auto")).toBe("/paras-auto/menu")
    })

    it("primary CTA cites /menu + Parts fitment", () => {
        const cta = autoPartsMenuPrimaryCta({ slug: "paras-auto" })
        expect(cta).toMatch(/\/paras-auto\/menu/)
        expect(cta).toMatch(/Parts|fitment/i)
        expect(cta.toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)
    })

    it("formats published fitment line", () => {
        const line = formatFitmentLine(fitment("Maruti", "Swift", 2018, 2024))
        expect(line).toBe("Maruti Swift 2018–2024")
        expect(fitmentLine(fitment("Hyundai", "i20", 2015, 2023))).toBe("Hyundai i20 2015–2023")
    })

    it("answers Swift brake pad with catalog SKU + fitment + /menu (WA secondary)", () => {
        for (const query of [
            "do you have Swift brake pads?",
            "Swift brake pad?",
            "brake pads for Maruti Swift",
        ]) {
            const reply = answerAutoPartsCatalogOrFitment({
                query,
                slug: "paras-auto",
                shopName: "Paras Auto",
                roleTemplate: "AUTO_PARTS",
                primaryGoal: "SELL_PRODUCTS",
                items: parasCatalog,
                requestCurrency: "INR",
                whatsapp: "919939185887",
            })
            expect(reply, query).toBeTruthy()
            expect(reply!, query).toMatch(/Front brake pad/i)
            expect(reply!, query).toMatch(/Maruti Swift 2018–2024/)
            expect(reply!, query).toMatch(/\/paras-auto\/menu/)
            expect(reply!, query).toMatch(/WhatsApp/)
            expect(reply!.toLowerCase(), query).not.toMatch(/only (way|path).*whatsapp|whatsapp.*only way/)
            // Must not present i20 oil filter as a Swift fit
            expect(reply!, query).not.toMatch(/Oil filter[\s\S]*Swift|Swift[\s\S]*Oil filter/i)
            expect(reply!.toLowerCase(), query).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)
        }
    })

    it("does not present Hyundai i20 oil filter as a Swift fit without caveat", () => {
        const reply = answerAutoPartsCatalogOrFitment({
            query: "oil filter for Swift",
            slug: "paras-auto",
            shopName: "Paras Auto",
            roleTemplate: "AUTO_PARTS",
            primaryGoal: "SELL_PRODUCTS",
            items: parasCatalog,
            requestCurrency: "INR",
            whatsapp: "919939185887",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/\/paras-auto\/menu/)
        // Either no oil filter cited as Swift fit, or explicit caveat that it is not for Swift
        const claimsI20AsSwift =
            /Oil filter/i.test(reply!)
            && /Swift/i.test(reply!)
            && !/(not|different|published for|no published)/i.test(reply!)
        expect(claimsI20AsSwift).toBe(false)
        if (/Oil filter/i.test(reply!)) {
            expect(reply!).toMatch(/i20|not|different|published for|no published/i)
        }
    })

    it("prompt guidance + clone + rag prefer /menu + fitment; no hire working-with chip", () => {
        const g = autoPartsMenuPromptGuidance({
            slug: "paras-auto",
            role: "AUTO_PARTS",
            goal: "SELL_PRODUCTS",
            hasCatalog: true,
            whatsapp: "919939185887",
        }).join(" ")
        expect(g).toMatch(/\/paras-auto\/menu/)
        expect(g).toMatch(/fitment|brake|oil filter/i)

        const clone = cloneOperatingPrompt({
            displayName: "Paras Auto",
            roleTemplate: "AUTO_PARTS",
            primaryGoal: "SELL_PRODUCTS",
            whatsapp: "919939185887",
        })
        expect(clone).toMatch(/\/menu/)
        expect(clone).toMatch(/fitment/i)
        expect(clone.toLowerCase()).not.toMatch(/tell me more about working with/)

        const rag = buildSystemPrompt(
            {
                displayName: "Paras Auto",
                roleTemplate: "AUTO_PARTS",
                primaryGoal: "SELL_PRODUCTS",
                slug: "paras-auto",
                whatsapp: "919939185887",
                digitalProducts: parasCatalog.map((p) => ({
                    ...p,
                    id: p.sku,
                    type: "PHYSICAL",
                    fulfillment: "PHYSICAL",
                    isActive: true,
                })),
                serviceOfferings: [],
            } as never,
            [],
            "INR",
        )
        expect(rag).toMatch(/\/paras-auto\/menu/)
        expect(rag).toMatch(/Parts →|fitment/i)

        const chips = generateSuggestions("Here are parts.", "Paras Auto", "AUTO_PARTS")
        expect(chips.join(" ").toLowerCase()).not.toMatch(/working with/)
        expect(chips.some((c) => /brake|oil filter|swift|fit/i.test(c))).toBe(true)

        // Hire-desk default still exists for non-retail kits
        const hire = generateSuggestions("Thanks.", "Nita Recruiters", "RECRUITMENT_AGENCY")
        expect(hire.some((c) => /working with/i.test(c))).toBe(true)
    })

    it("guest /book empty + handler short-circuit wiring", () => {
        expect(guestBookEmptyCopy("AUTO_PARTS", "SELL_PRODUCTS")).toMatch(/Parts on the menu/i)

        const handler = readFileSync(join(root, "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/answerAutoPartsCatalogOrFitment/)
        expect(handler).toMatch(/autoPartsMenuReply/)
        expect(handler).toMatch(/auto_parts_menu_path/)
        expect(handler).toMatch(/autoPartsDesk/)
        expect(handler).toMatch(/generateSuggestions\(text, profile\.displayName, profile\.roleTemplate\)/)

        const suggestions = readFileSync(join(root, "src/lib/suggestions.ts"), "utf8")
        expect(suggestions).toMatch(/AUTO_PARTS/)
        expect(suggestions).toMatch(/working with/)
    })
})
