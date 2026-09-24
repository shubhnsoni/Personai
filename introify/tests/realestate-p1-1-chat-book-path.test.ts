import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    answerAppointmentBookOrPrice,
    appointmentBookPath,
    appointmentBookPrimaryCta,
    appointmentBookPromptGuidance,
    formatShowServicesReply,
    prefersAppointmentBookPath,
} from "@/lib/appointment-chat"
import { cloneOperatingPrompt } from "@/lib/clone-identity"
import { buildSystemPrompt } from "@/lib/rag"

const root = process.cwd()

const shaktiServices = [
    {
        name: "Property consultation",
        description: "Free property consult",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 30,
    },
    {
        name: "Site viewing",
        description: "On-site viewing",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 45,
    },
    {
        name: "Mandate review",
        description: "Mandate paperwork review",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 30,
    },
]

describe("realestate-p1-1 chat enquire/viewing grounds to /book not WA-only", () => {
    it("flags REAL_ESTATE_BROKERAGE (COLLECT_LEADS) for Book path", () => {
        expect(prefersAppointmentBookPath("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("REAL_ESTATE_BROKERAGE", null)).toBe(true)
        expect(prefersAppointmentBookPath("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("SALON_SPA", "TAKE_APPOINTMENTS")).toBe(true)
        expect(prefersAppointmentBookPath("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(appointmentBookPath("shakti-property-lalpur")).toBe("/shakti-property-lalpur/book")
    })

    it("primary CTA cites Book a call + /book without session/treatment/appointment", () => {
        const shakti = appointmentBookPrimaryCta({
            slug: "shakti-property-lalpur",
            role: "REAL_ESTATE_BROKERAGE",
        })
        expect(shakti).toMatch(/Book a call/)
        expect(shakti).toMatch(/\/shakti-property-lalpur\/book/)
        expect(shakti).toMatch(/Property consultation|Site viewing|Mandate review/i)
        expect(shakti).not.toMatch(/session|treatment|appointment/i)
        expect(shakti.toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)

        // No gym/salon/clinic/events regress on chip noun
        expect(appointmentBookPrimaryCta({ slug: "aura-fitness-ranchi", role: "GYM" })).toMatch(/Book a session/)
        expect(appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })).toMatch(
            /Book a treatment/,
        )
        expect(appointmentBookPrimaryCta({ slug: "jk-sharma-clinic-harmu", role: "CLINIC" })).toMatch(
            /Book an appointment/,
        )
        expect(appointmentBookPrimaryCta({ slug: "next-level-events-kanke", role: "EVENTS_STUDIO" })).toMatch(
            /Book a call/,
        )
    })

    it("prompt guidance fires on COLLECT_LEADS and cites /book (WA secondary)", () => {
        const g = appointmentBookPromptGuidance({
            slug: "shakti-property-lalpur",
            role: "REAL_ESTATE_BROKERAGE",
            goal: "COLLECT_LEADS",
            hasServices: true,
            whatsapp: "919294900041",
        }).join(" ")
        expect(g.length).toBeGreaterThan(0)
        expect(g).toMatch(/\/shakti-property-lalpur\/book|Book a call/)
        expect(g).toMatch(/enquire|viewing|consultation|mandate/i)
        expect(g).toMatch(/WhatsApp/)
        expect(g.toLowerCase()).toMatch(/secondary|not the only/)
        expect(g).toMatch(/Never say session, treatment, or appointment/)
    })

    it("answers how do I enquire with /book cite on Shakti (WA secondary)", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "how do I enquire?",
            slug: "shakti-property-lalpur",
            shopName: "Shakti Property",
            roleTemplate: "REAL_ESTATE_BROKERAGE",
            primaryGoal: "COLLECT_LEADS",
            services: shaktiServices,
            requestCurrency: "INR",
            whatsapp: "919294900041",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/\/shakti-property-lalpur\/book/)
        expect(reply!).toMatch(/Book a call/)
        expect(reply!).toMatch(/Property consultation|Site viewing|Mandate review/)
        expect(reply!).toMatch(/WhatsApp/)
        expect(reply!.toLowerCase()).toMatch(/optional|secondary|not the only/)
        expect(reply!).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        expect(reply!.toLowerCase()).not.toMatch(/only (way|path).*whatsapp|whatsapp.*only way/)
        expect(reply!.toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)
    })

    it("answers viewing / consultation / mandate intents with /book on Shakti", () => {
        for (const query of [
            "how do I book a viewing?",
            "I want a property consultation",
            "mandate review please",
            "site viewing availability?",
        ]) {
            const reply = answerAppointmentBookOrPrice({
                query,
                slug: "shakti-property-lalpur",
                shopName: "Shakti Property",
                roleTemplate: "REAL_ESTATE_BROKERAGE",
                primaryGoal: "COLLECT_LEADS",
                services: shaktiServices,
                requestCurrency: "INR",
                whatsapp: "919294900041",
            })
            expect(reply, query).toBeTruthy()
            expect(reply!, query).toMatch(/\/shakti-property-lalpur\/book/)
            expect(reply!, query).toMatch(/Book a call/)
            expect(reply!, query).toMatch(/Property consultation|Site viewing|Mandate review/)
            expect(reply!, query).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        }
    })

    it("showServices reply prefers Book path for real-estate kit", () => {
        const text = formatShowServicesReply({
            shopName: "Shakti Property",
            slug: "shakti-property-lalpur",
            role: "REAL_ESTATE_BROKERAGE",
            goal: "COLLECT_LEADS",
            services: shaktiServices,
            requestCurrency: "INR",
            whatsapp: "919294900041",
        })
        expect(text).toMatch(/consultations & viewings|consultation|viewing/i)
        expect(text).toMatch(/\/shakti-property-lalpur\/book/)
        expect(text).toMatch(/Would you like to book/)
        expect(text).toMatch(/WhatsApp/)
        expect(text).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
    })

    it("clone + rag prompts steer /book over WA-only for REAL_ESTATE COLLECT_LEADS", () => {
        const prompt = cloneOperatingPrompt({
            displayName: "Shakti Property",
            roleTemplate: "REAL_ESTATE_BROKERAGE",
            primaryGoal: "COLLECT_LEADS",
            language: "en",
            whatsapp: "919294900041",
        })
        expect(prompt).toMatch(/Book chip|\/book|in-app Book/i)
        expect(prompt).toMatch(/enquire|viewing|consultation|mandate/i)
        expect(prompt).toMatch(/secondary|never the only/i)
        expect(prompt).toMatch(/Never say session, treatment, or appointment/)

        const system = buildSystemPrompt(
            {
                displayName: "Shakti Property",
                slug: "shakti-property-lalpur",
                headline: "Property in Lalpur",
                bio: "Brokerage and viewings.",
                roleTemplate: "REAL_ESTATE_BROKERAGE",
                primaryGoal: "COLLECT_LEADS",
                language: "en",
                welcomeMessageOverride: null,
                personalityConfig: null,
                whatsapp: "919294900041",
                workExperiences: [],
                projects: [],
                serviceOfferings: shaktiServices.map((s) => ({
                    name: s.name,
                    description: s.description || null,
                    priceCents: s.priceCents,
                    currency: s.currency,
                    isFree: s.isFree,
                    durationMinutes: s.durationMinutes || 30,
                })),
            } as never,
            [],
            "INR",
        )
        expect(system).toMatch(/Property consultation & viewings/)
        expect(system).not.toMatch(/## Services & appointments/)
        expect(system).toMatch(/\/shakti-property-lalpur\/book/)
        expect(system).toMatch(/enquire|viewing|consultation|mandate|Book a call/i)
        expect(system).toMatch(/Never say session, treatment, or appointment/)
        expect(system).toMatch(/showServices: Use when asked about rates, enquire, viewing, consultation, or mandate/)
        expect(system).not.toMatch(/showServices: Use when asked about rates, booking, or sessions/)
    })

    it("handler already wires appointment_book_path short-circuit", () => {
        const handler = readFileSync(join(root, "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/answerAppointmentBookOrPrice/)
        expect(handler).toMatch(/appointment_book_path/)
    })
})
