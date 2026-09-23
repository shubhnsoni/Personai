import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    answerAppointmentBookOrPrice,
    appointmentBookPath,
    appointmentBookPrimaryCta,
    appointmentBookPromptGuidance,
    formatAppointmentServicePrice,
    formatShowServicesReply,
    prefersAppointmentBookPath,
} from "@/lib/appointment-chat"
import { cloneOperatingPrompt } from "@/lib/clone-identity"
import { buildSystemPrompt } from "@/lib/rag"

const INR = "\u20b9"
const root = process.cwd()

const hSquareServices = [
    { name: "Haircut", description: "Classic cut", priceCents: 30_000, currency: "INR", isFree: false, durationMinutes: 30 },
    { name: "Spa therapy", description: "Relax", priceCents: 45_000, currency: "INR", isFree: false, durationMinutes: 45 },
    { name: "Keratin", description: "Smooth", priceCents: 99_900, currency: "INR", isFree: false, durationMinutes: 90 },
]

const princeServices = [
    { name: "Gentleman cut", description: "Includes wash", priceCents: 30_000, currency: "INR", isFree: false, durationMinutes: 30 },
    { name: "Beard trim", priceCents: 15_000, currency: "INR", isFree: false, durationMinutes: 15 },
]

describe("salon-p1-3 appointment book path preference", () => {
    it("flags TAKE_APPOINTMENTS and salon/barber kits", () => {
        expect(prefersAppointmentBookPath("SALON_SPA", "TAKE_APPOINTMENTS")).toBe(true)
        expect(prefersAppointmentBookPath("BARBER", "TAKE_APPOINTMENTS")).toBe(true)
        expect(prefersAppointmentBookPath("BARBER", null)).toBe(true)
        expect(prefersAppointmentBookPath("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(appointmentBookPath("h-square-salon-harmu")).toBe("/h-square-salon-harmu/book")
        expect(appointmentBookPath("prince-barber-lalpur")).toBe("/prince-barber-lalpur/book")
    })

    it("formats honest INR service prices without USD FX", () => {
        expect(formatAppointmentServicePrice(hSquareServices[0], "SALON_SPA", "INR")).toBe(`${INR}300`)
        expect(formatAppointmentServicePrice(hSquareServices[1], "SALON_SPA", "USD")).toBe(`${INR}450`)
        expect(formatAppointmentServicePrice(hSquareServices[2], "SALON_SPA", "INR")).toBe(`${INR}999`)
        expect(formatAppointmentServicePrice(hSquareServices[0], "SALON_SPA", "INR")).not.toMatch(/26,?100/)
        expect(formatAppointmentServicePrice(princeServices[0], "BARBER", "INR")).toBe(`${INR}300`)
    })

    it("cites Book / /book as primary and WA as secondary", () => {
        const cta = appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })
        expect(cta).toMatch(/Book a treatment/)
        expect(cta).toMatch(/\/h-square-salon-harmu\/book/)
        const guidance = appointmentBookPromptGuidance({
            slug: "h-square-salon-harmu",
            role: "SALON_SPA",
            goal: "TAKE_APPOINTMENTS",
            hasServices: true,
            whatsapp: "919876543210",
        })
        expect(guidance.join(" ")).toMatch(/\/book/)
        expect(guidance.join(" ")).toMatch(/secondary|not the only/i)
        expect(guidance.join(" ")).toMatch(/WhatsApp/)
    })

    it("answers haircut price with honest INR + Book path (WA secondary)", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "haircut price?",
            slug: "h-square-salon-harmu",
            shopName: "H Square Salon",
            roleTemplate: "SALON_SPA",
            primaryGoal: "TAKE_APPOINTMENTS",
            services: hSquareServices,
            requestCurrency: "INR",
            whatsapp: "919876543210",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/Haircut/)
        expect(reply!).toMatch(new RegExp(`${INR}300`))
        expect(reply!).not.toMatch(/26,?100/)
        expect(reply!).toMatch(/\/h-square-salon-harmu\/book|Book a treatment/)
        expect(reply!).toMatch(/WhatsApp/)
        expect(reply!.toLowerCase()).toMatch(/secondary|optional|not the only/)
    })

    it("answers how do I book with /book cite on prince", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "how do I book?",
            slug: "prince-barber-lalpur",
            shopName: "Prince Barber",
            roleTemplate: "BARBER",
            primaryGoal: "TAKE_APPOINTMENTS",
            services: princeServices,
            requestCurrency: "INR",
            whatsapp: "919111122233",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/\/prince-barber-lalpur\/book/)
        expect(reply!).toMatch(/Book a treatment/)
        expect(reply!).toMatch(/Gentleman cut|Beard trim/)
        expect(reply!).toMatch(/WhatsApp/)
        // WA must not be framed as the sole path
        expect(reply!.toLowerCase()).not.toMatch(/only (way|path).*whatsapp|whatsapp.*only way/)
    })

    it("showServices reply prefers Book path for salon kits", () => {
        const text = formatShowServicesReply({
            shopName: "H Square Salon",
            slug: "h-square-salon-harmu",
            role: "SALON_SPA",
            goal: "TAKE_APPOINTMENTS",
            services: hSquareServices,
            requestCurrency: "INR",
            whatsapp: "919876543210",
        })
        expect(text).toMatch(/services/)
        expect(text).toMatch(new RegExp(`${INR}300`))
        expect(text).toMatch(/\/h-square-salon-harmu\/book/)
        expect(text).toMatch(/Would you like to book/)
        expect(text).toMatch(/WhatsApp/)
        expect(text.toLowerCase()).toMatch(/optional|secondary|not the only/)
    })

    it("clone + rag prompts steer Book over WA-only for salon", () => {
        const prompt = cloneOperatingPrompt({
            displayName: "H Square Salon",
            roleTemplate: "SALON_SPA",
            primaryGoal: "TAKE_APPOINTMENTS",
            language: "en",
            whatsapp: "919876543210",
        })
        expect(prompt).toMatch(/Book chip|\/book|in-app Book/i)
        expect(prompt).toMatch(/secondary|never the only/i)

        const system = buildSystemPrompt(
            {
                displayName: "H Square Salon",
                slug: "h-square-salon-harmu",
                headline: "Harmu salon",
                bio: "Treatments and retail.",
                roleTemplate: "SALON_SPA",
                primaryGoal: "TAKE_APPOINTMENTS",
                language: "en",
                welcomeMessageOverride: null,
                personalityConfig: null,
                whatsapp: "919876543210",
                workExperiences: [],
                projects: [],
                serviceOfferings: hSquareServices.map((s) => ({
                    name: s.name,
                    description: s.description || null,
                    priceCents: s.priceCents,
                    currency: s.currency,
                    isFree: false,
                    durationMinutes: s.durationMinutes || 30,
                })),
            } as never,
            [],
            "INR",
        )
        expect(system).toMatch(/Services & appointments/)
        expect(system).toMatch(/\/h-square-salon-harmu\/book/)
        expect(system).toMatch(new RegExp(`${INR}300`))
        expect(system).not.toMatch(/26,?100/)
    })

    it("wires handler short-circuit + showServices helper (no WA-only tool copy)", () => {
        const handler = readFileSync(join(root, "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/answerAppointmentBookOrPrice/)
        expect(handler).toMatch(/formatShowServicesReply/)
        expect(handler).toMatch(/appointment_book_path/)
        // Old FX path on showServices removed
        expect(handler).not.toMatch(/consultation services:\\n\$\{serviceList\}/)
    })
})
