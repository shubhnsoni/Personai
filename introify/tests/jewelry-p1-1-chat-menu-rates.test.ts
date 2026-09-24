import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    answerJewelryCatalogOrRate,
    formatJewelryCityRates,
    jewelryMenuPath,
    jewelryMenuPrimaryCta,
    jewelryMenuPromptGuidance,
    jewelryNoBookSteer,
    prefersJewelryMenuPath,
} from "@/lib/jewelry-chat"
import { cloneOperatingPrompt } from "@/lib/clone-identity"
import { buildSystemPrompt } from "@/lib/rag"
import { generateSuggestions } from "@/lib/suggestions"
import { guestBookEmptyCopy } from "@/lib/kit-copy"

const root = process.cwd()

const mkCatalog = [
    {
        title: "22K mangalsutra",
        priceCents: 17_100_000,
        currency: "INR",
        category: "Mangalsutra",
        stock: 3,
    },
    {
        title: "22K light bangle",
        priceCents: 15_600_000,
        currency: "INR",
        category: "Bangles",
        stock: 4,
    },
    {
        title: "22K rope chain",
        priceCents: 29_200_000,
        currency: "INR",
        category: "Chains",
        stock: 2,
    },
]

const ranchiBoard = {
    city: "Ranchi",
    k22PaisePer10g: 14_130_000,
    k24PaisePer10g: 15_415_000,
    k18PaisePer10g: 11_561_000,
}

describe("jewelry-p1-1 chat grounds to /menu + city rates not phone-only", () => {
    it("flags JEWELRY_RETAIL for menu path (not appointment book path)", () => {
        expect(prefersJewelryMenuPath("JEWELRY_RETAIL", "SELL_PRODUCTS")).toBe(true)
        expect(prefersJewelryMenuPath("JEWELRY_RETAIL", null)).toBe(true)
        expect(prefersJewelryMenuPath("JEWELRY_WHOLESALE", "COLLECT_LEADS")).toBe(true)
        expect(prefersJewelryMenuPath("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(prefersJewelryMenuPath("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(false)
        expect(jewelryMenuPath("mk-jewellers")).toBe("/mk-jewellers/menu")
    })

    it("primary CTA cites /menu + City Rates (no session/treatment/appointment/visit invent)", () => {
        const cta = jewelryMenuPrimaryCta({ slug: "mk-jewellers", role: "JEWELRY_RETAIL" })
        expect(cta).toMatch(/\/mk-jewellers\/menu/)
        expect(cta).toMatch(/City Rates|Jewellery/i)
        expect(cta).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        expect(cta.toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)
    })

    it("formats City Rates board 22K/24K ₹/g", () => {
        const line = formatJewelryCityRates(ranchiBoard)
        expect(line).toMatch(/City Rates/)
        expect(line).toMatch(/Ranchi/)
        expect(line).toMatch(/22K/)
        expect(line).toMatch(/24K/)
        expect(line).toMatch(/₹/)
        expect(line).toMatch(/\/g/)
    })

    it("answers mangalsutra / bridal with catalog SKU + /menu deep-link (WA secondary)", () => {
        for (const query of [
            "do you have a mangalsutra?",
            "bridal jewellery?",
            "show bridal sets",
        ]) {
            const reply = answerJewelryCatalogOrRate({
                query,
                slug: "mk-jewellers",
                shopName: "MK Jewellers",
                roleTemplate: "JEWELRY_RETAIL",
                primaryGoal: "SELL_PRODUCTS",
                items: mkCatalog,
                requestCurrency: "INR",
                whatsapp: "919905292254",
                board: ranchiBoard,
                hasBookableServices: false,
            })
            expect(reply, query).toBeTruthy()
            expect(reply!, query).toMatch(/\/mk-jewellers\/menu/)
            expect(reply!, query).toMatch(/mangalsutra|bangle|chain|Jewellery/i)
            expect(reply!, query).toMatch(/WhatsApp/)
            expect(reply!, query).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
            expect(reply!.toLowerCase(), query).not.toMatch(/only (way|path).*whatsapp|whatsapp.*only way/)
            expect(reply!.toLowerCase(), query).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)
        }
    })

    it("answers gold rate / City Rates with board + /menu (not phone-only)", () => {
        const reply = answerJewelryCatalogOrRate({
            query: "what is today's gold rate?",
            slug: "mk-jewellers",
            shopName: "MK Jewellers",
            roleTemplate: "JEWELRY_RETAIL",
            primaryGoal: "SELL_PRODUCTS",
            items: mkCatalog,
            requestCurrency: "INR",
            whatsapp: "919905292254",
            board: ranchiBoard,
            hasBookableServices: false,
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/City Rates/)
        expect(reply!).toMatch(/22K/)
        expect(reply!).toMatch(/24K/)
        expect(reply!).toMatch(/\/mk-jewellers\/menu/)
        expect(reply!).toMatch(/WhatsApp/)
        expect(reply!.toLowerCase()).not.toMatch(/confirm off.?platform|call to confirm the rate only/)
    })

    it("when /book empty, visit-book asks steer to menu / WhatsApp / walk-in (no invent fields)", () => {
        const reply = answerJewelryCatalogOrRate({
            query: "how do I book a visit?",
            slug: "mk-jewellers",
            shopName: "MK Jewellers",
            roleTemplate: "JEWELRY_RETAIL",
            primaryGoal: "SELL_PRODUCTS",
            items: mkCatalog,
            requestCurrency: "INR",
            whatsapp: "919905292254",
            board: ranchiBoard,
            hasBookableServices: false,
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/does not take bookable visits|walk in|WhatsApp/i)
        expect(reply!).toMatch(/\/mk-jewellers\/menu/)
        expect(reply!).not.toMatch(/party size|attendees|pick a slot|durationMinutes|Book a session/i)

        const steer = jewelryNoBookSteer({
            slug: "mk-jewellers",
            shopName: "MK Jewellers",
            role: "JEWELRY_RETAIL",
            whatsapp: "919905292254",
        })
        expect(steer).toMatch(/\/mk-jewellers\/menu/)
        expect(steer).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
    })

    it("prompt guidance + clone + rag prefer /menu + City Rates; no hire working-with chip", () => {
        const g = jewelryMenuPromptGuidance({
            slug: "mk-jewellers",
            role: "JEWELRY_RETAIL",
            goal: "SELL_PRODUCTS",
            hasCatalog: true,
            hasBoard: true,
            hasBookableServices: false,
            whatsapp: "919905292254",
        }).join(" ")
        expect(g).toMatch(/\/mk-jewellers\/menu/)
        expect(g).toMatch(/City Rates|bridal|mangalsutra/i)
        expect(g).toMatch(/visit-booking|walk-in/i)

        const clone = cloneOperatingPrompt({
            displayName: "MK Jewellers",
            roleTemplate: "JEWELRY_RETAIL",
            primaryGoal: "SELL_PRODUCTS",
            whatsapp: "919905292254",
        })
        expect(clone).toMatch(/\/menu/)
        expect(clone).toMatch(/City Rates/)
        expect(clone).toMatch(/visit-booking|walk-in/i)
        expect(clone.toLowerCase()).not.toMatch(/tell me more about working with/)

        const rag = buildSystemPrompt(
            {
                displayName: "MK Jewellers",
                roleTemplate: "JEWELRY_RETAIL",
                primaryGoal: "SELL_PRODUCTS",
                slug: "mk-jewellers",
                whatsapp: "919905292254",
                personalityConfig: JSON.stringify({ goldBoard: { ...ranchiBoard, citySlug: "ranchi", asOf: "2026-09-24T10:00:00.000Z", source: "manual" } }),
                digitalProducts: mkCatalog.map((p) => ({
                    ...p,
                    id: p.title,
                    type: "PHYSICAL",
                    fulfillment: "PHYSICAL",
                    isActive: true,
                })),
                serviceOfferings: [],
            } as never,
            [],
            "INR",
        )
        expect(rag).toMatch(/\/mk-jewellers\/menu/)
        expect(rag).toMatch(/City Rates|Jewellery →/i)

        const chips = generateSuggestions("Here is jewellery.", "MK Jewellers", "JEWELRY_RETAIL")
        expect(chips.join(" ").toLowerCase()).not.toMatch(/working with/)
        expect(chips.some((c) => /gold rate|mangalsutra|bridal/i.test(c))).toBe(true)

        // Hire-desk default still exists for non-jewellery kits
        const hire = generateSuggestions("Thanks.", "Nita Recruiters", "RECRUITMENT_AGENCY")
        expect(hire.some((c) => /working with/i.test(c))).toBe(true)
    })

    it("guest /book empty + handler short-circuit wiring", () => {
        expect(guestBookEmptyCopy("JEWELRY_RETAIL", "SELL_PRODUCTS")).toMatch(/Jewellery on the menu/i)
        expect(guestBookEmptyCopy("JEWELRY_RETAIL", "SELL_PRODUCTS")).not.toMatch(/\bsessions?\b/i)

        const handler = readFileSync(join(root, "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/answerJewelryCatalogOrRate/)
        expect(handler).toMatch(/jewelryMenuReply/)
        expect(handler).toMatch(/jewelry_menu_path/)
        expect(handler).toMatch(/jewelryDesk/)
        expect(handler).toMatch(/generateSuggestions\(text, profile\.displayName, profile\.roleTemplate\)/)

        const suggestions = readFileSync(join(root, "src/lib/suggestions.ts"), "utf8")
        expect(suggestions).toMatch(/JEWELRY_RETAIL/)
        expect(suggestions).toMatch(/working with/)
    })
})
