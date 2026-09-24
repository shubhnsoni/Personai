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

const nitaServices = [
    {
        name: "Hiring brief call",
        description: "Role, salary band, joining date",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 30,
    },
    {
        name: "Candidate intro",
        description: "Walk in with a CV",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 20,
    },
    {
        name: "Interview slot",
        description: "Half-hour first conversation",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 30,
    },
]

describe("recruit-p1-4 chat schedule/hire grounds to /book not phone-only", () => {
    it("flags RECRUITMENT_AGENCY (COLLECT_LEADS) for Book path", () => {
        expect(prefersAppointmentBookPath("RECRUITMENT_AGENCY", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("RECRUITMENT_AGENCY", null)).toBe(true)
        expect(prefersAppointmentBookPath("REAL_ESTATE_BROKERAGE", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("SALON_SPA", "TAKE_APPOINTMENTS")).toBe(true)
        expect(prefersAppointmentBookPath("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(appointmentBookPath("nita-recruiters-ashok-nagar")).toBe("/nita-recruiters-ashok-nagar/book")
    })

    it("primary CTA cites Book a call + /book with hiring offerings (no session/treatment/appointment)", () => {
        const nita = appointmentBookPrimaryCta({
            slug: "nita-recruiters-ashok-nagar",
            role: "RECRUITMENT_AGENCY",
        })
        expect(nita).toMatch(/Book a call/)
        expect(nita).toMatch(/\/nita-recruiters-ashok-nagar\/book/)
        expect(nita).toMatch(/Hiring brief call|Interview slot|Candidate intro/i)
        expect(nita).not.toMatch(/session|treatment|appointment/i)
        expect(nita.toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)

        // No gym/salon/clinic/events/RE regress on chip noun
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
        expect(appointmentBookPrimaryCta({ slug: "shakti-property-lalpur", role: "REAL_ESTATE_BROKERAGE" })).toMatch(
            /Book a call/,
        )
    })

    it("prompt guidance fires on COLLECT_LEADS and cites /book (WA secondary)", () => {
        const g = appointmentBookPromptGuidance({
            slug: "nita-recruiters-ashok-nagar",
            role: "RECRUITMENT_AGENCY",
            goal: "COLLECT_LEADS",
            hasServices: true,
            whatsapp: "919708816511",
        }).join(" ")
        expect(g.length).toBeGreaterThan(0)
        expect(g).toMatch(/\/nita-recruiters-ashok-nagar\/book|Book a call/)
        expect(g).toMatch(/enquire|interview|hiring|hire/i)
        expect(g).toMatch(/WhatsApp/)
        expect(g.toLowerCase()).toMatch(/secondary|not the only/)
        expect(g).toMatch(/Never say session, treatment, or appointment/)
    })

    it("answers schedule interview with /book cite on Nita (WA secondary)", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "schedule interview",
            slug: "nita-recruiters-ashok-nagar",
            shopName: "Nita Recruiters",
            roleTemplate: "RECRUITMENT_AGENCY",
            primaryGoal: "COLLECT_LEADS",
            services: nitaServices,
            requestCurrency: "INR",
            whatsapp: "919708816511",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/\/nita-recruiters-ashok-nagar\/book/)
        expect(reply!).toMatch(/Book a call/)
        expect(reply!).toMatch(/Hiring brief call|Interview slot|Candidate intro/)
        expect(reply!).toMatch(/WhatsApp/)
        expect(reply!.toLowerCase()).toMatch(/optional|secondary|not the only/)
        expect(reply!).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        expect(reply!.toLowerCase()).not.toMatch(/only (way|path).*whatsapp|whatsapp.*only way/)
        expect(reply!.toLowerCase()).not.toMatch(/\bgym\b|\bsalon\b|\bclinic\b|\bhotel\b/)
    })

    it("answers hire / enquire about roles intents with /book on Nita", () => {
        for (const query of [
            "hiring accountant",
            "enquire about roles",
            "how do I schedule an interview?",
            "I want a hiring brief call",
            "candidate intro please",
        ]) {
            const reply = answerAppointmentBookOrPrice({
                query,
                slug: "nita-recruiters-ashok-nagar",
                shopName: "Nita Recruiters",
                roleTemplate: "RECRUITMENT_AGENCY",
                primaryGoal: "COLLECT_LEADS",
                services: nitaServices,
                requestCurrency: "INR",
                whatsapp: "919708816511",
            })
            expect(reply, query).toBeTruthy()
            expect(reply!, query).toMatch(/\/nita-recruiters-ashok-nagar\/book/)
            expect(reply!, query).toMatch(/Book a call/)
            expect(reply!, query).toMatch(/Hiring brief call|Interview slot|Candidate intro/)
            expect(reply!, query).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        }
    })

    it("showServices reply prefers Book path for recruitment kit", () => {
        const text = formatShowServicesReply({
            shopName: "Nita Recruiters",
            slug: "nita-recruiters-ashok-nagar",
            role: "RECRUITMENT_AGENCY",
            goal: "COLLECT_LEADS",
            services: nitaServices,
            requestCurrency: "INR",
            whatsapp: "919708816511",
        })
        expect(text).toMatch(/hiring calls & interview slots|hiring|interview/i)
        expect(text).toMatch(/\/nita-recruiters-ashok-nagar\/book/)
        expect(text).toMatch(/Would you like to book/)
        expect(text).toMatch(/WhatsApp/)
        expect(text).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
    })

    it("clone + rag prompts steer /book over phone/WA-only for RECRUIT COLLECT_LEADS", () => {
        const prompt = cloneOperatingPrompt({
            displayName: "Nita Recruiters",
            roleTemplate: "RECRUITMENT_AGENCY",
            primaryGoal: "COLLECT_LEADS",
            language: "en",
            whatsapp: "919708816511",
        })
        expect(prompt).toMatch(/Book chip|\/book|in-app Book/i)
        expect(prompt).toMatch(/enquire|interview|hiring|hire/i)
        expect(prompt).toMatch(/secondary|never the only/i)
        expect(prompt).toMatch(/Never say session, treatment, or appointment/)

        const system = buildSystemPrompt(
            {
                displayName: "Nita Recruiters",
                slug: "nita-recruiters-ashok-nagar",
                headline: "Ashok Nagar hiring desk",
                bio: "Domestic placement.",
                roleTemplate: "RECRUITMENT_AGENCY",
                primaryGoal: "COLLECT_LEADS",
                language: "en",
                welcomeMessageOverride: null,
                personalityConfig: null,
                whatsapp: "919708816511",
                workExperiences: [],
                projects: [],
                serviceOfferings: nitaServices.map((s) => ({
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
        expect(system).toMatch(/Hiring calls & interview slots/)
        expect(system).not.toMatch(/## Services & appointments/)
        expect(system).toMatch(/\/nita-recruiters-ashok-nagar\/book/)
        expect(system).toMatch(/enquire|interview|hiring|hire|Book a call/i)
        expect(system).toMatch(/Never say session, treatment, or appointment/)
        expect(system).toMatch(
            /showServices: Use when asked about rates, enquire about roles, schedule interview, hire, or hiring brief/,
        )
        expect(system).not.toMatch(/showServices: Use when asked about rates, booking, or sessions/)
    })

    it("handler already wires appointment_book_path short-circuit", () => {
        const handler = readFileSync(join(root, "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/answerAppointmentBookOrPrice/)
        expect(handler).toMatch(/appointment_book_path/)
    })
})
