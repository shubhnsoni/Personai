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

const INR = "\u20b9"
const root = process.cwd()

const nleServices = [
    {
        name: "Event planning call",
        description: "Free planning call",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 30,
    },
    {
        name: "Venue walk",
        description: "On-site walkthrough",
        priceCents: 250_000,
        currency: "INR",
        isFree: false,
        durationMinutes: 60,
    },
]

const lcServices = [
    {
        name: "Brief call",
        description: "Free shoot brief",
        priceCents: 0,
        currency: "INR",
        isFree: true,
        durationMinutes: 20,
    },
    {
        name: "Wedding day coverage",
        description: "Full day",
        priceCents: 2_800_000,
        currency: "INR",
        isFree: false,
        durationMinutes: 480,
    },
]

describe("events-p1-1 chat enquire grounds to /book not WA-only", () => {
    it("flags EVENTS_STUDIO + PHOTOGRAPHER (COLLECT_LEADS) for Book path", () => {
        expect(prefersAppointmentBookPath("EVENTS_STUDIO", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("PHOTOGRAPHER", "COLLECT_LEADS")).toBe(true)
        expect(prefersAppointmentBookPath("EVENTS_STUDIO", null)).toBe(true)
        expect(prefersAppointmentBookPath("PHOTOGRAPHER", null)).toBe(true)
        expect(prefersAppointmentBookPath("SALON_SPA", "TAKE_APPOINTMENTS")).toBe(true)
        expect(prefersAppointmentBookPath("SHOP", "SELL_PRODUCTS")).toBe(false)
        expect(appointmentBookPath("next-level-events-kanke")).toBe("/next-level-events-kanke/book")
        expect(appointmentBookPath("lets-click-ratu-road")).toBe("/lets-click-ratu-road/book")
    })

    it("primary CTA cites Book a call + /book without session/treatment/appointment", () => {
        const nle = appointmentBookPrimaryCta({ slug: "next-level-events-kanke", role: "EVENTS_STUDIO" })
        expect(nle).toMatch(/Book a call/)
        expect(nle).toMatch(/\/next-level-events-kanke\/book/)
        expect(nle).toMatch(/planning\/brief call|package/i)
        expect(nle).not.toMatch(/session|treatment|appointment/i)

        const lc = appointmentBookPrimaryCta({ slug: "lets-click-ratu-road", role: "PHOTOGRAPHER" })
        expect(lc).toMatch(/Book a call/)
        expect(lc).toMatch(/\/lets-click-ratu-road\/book/)
        expect(lc).not.toMatch(/session|treatment|appointment/i)

        // No gym/salon/clinic regress on chip noun
        expect(appointmentBookPrimaryCta({ slug: "aura-fitness-ranchi", role: "GYM" })).toMatch(/Book a session/)
        expect(appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })).toMatch(
            /Book a treatment/,
        )
    })

    it("prompt guidance fires on COLLECT_LEADS and cites /book (WA secondary)", () => {
        const g = appointmentBookPromptGuidance({
            slug: "next-level-events-kanke",
            role: "EVENTS_STUDIO",
            goal: "COLLECT_LEADS",
            hasServices: true,
            whatsapp: "917903133317",
        }).join(" ")
        expect(g.length).toBeGreaterThan(0)
        expect(g).toMatch(/\/next-level-events-kanke\/book|Book a call/)
        expect(g).toMatch(/enquire|quote|shoot/i)
        expect(g).toMatch(/WhatsApp/)
        expect(g.toLowerCase()).toMatch(/secondary|not the only/)
        expect(g).toMatch(/Never say session, treatment, or appointment/)

        const gLc = appointmentBookPromptGuidance({
            slug: "lets-click-ratu-road",
            role: "PHOTOGRAPHER",
            goal: "COLLECT_LEADS",
            hasServices: true,
            whatsapp: "919111122233",
        }).join(" ")
        expect(gLc).toMatch(/\/lets-click-ratu-road\/book|Book a call/)
        expect(gLc).toMatch(/Never say session, treatment, or appointment/)
    })

    it("answers how do I enquire with /book cite on NLE (WA secondary)", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "how do I enquire?",
            slug: "next-level-events-kanke",
            shopName: "Next Level Events",
            roleTemplate: "EVENTS_STUDIO",
            primaryGoal: "COLLECT_LEADS",
            services: nleServices,
            requestCurrency: "INR",
            whatsapp: "917903133317",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/\/next-level-events-kanke\/book/)
        expect(reply!).toMatch(/Book a call/)
        expect(reply!).toMatch(/Event planning call|Venue walk/)
        expect(reply!).toMatch(/WhatsApp/)
        expect(reply!.toLowerCase()).toMatch(/optional|secondary|not the only/)
        expect(reply!).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        expect(reply!.toLowerCase()).not.toMatch(/only (way|path).*whatsapp|whatsapp.*only way/)
    })

    it("answers get a quote / book a shoot with /book on Let's Click", () => {
        for (const query of ["get a quote for wedding coverage", "how do I book a shoot?"]) {
            const reply = answerAppointmentBookOrPrice({
                query,
                slug: "lets-click-ratu-road",
                shopName: "Let's Click",
                roleTemplate: "PHOTOGRAPHER",
                primaryGoal: "COLLECT_LEADS",
                services: lcServices,
                requestCurrency: "INR",
                whatsapp: "919111122233",
            })
            expect(reply, query).toBeTruthy()
            expect(reply!, query).toMatch(/\/lets-click-ratu-road\/book/)
            expect(reply!, query).toMatch(/Book a call/)
            expect(reply!, query).toMatch(/Brief call|Wedding day coverage/)
            expect(reply!, query).toMatch(new RegExp(`${INR}28,?000`))
            expect(reply!, query).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
        }
    })

    it("showServices reply prefers Book path for events kits", () => {
        const text = formatShowServicesReply({
            shopName: "Next Level Events",
            slug: "next-level-events-kanke",
            role: "EVENTS_STUDIO",
            goal: "COLLECT_LEADS",
            services: nleServices,
            requestCurrency: "INR",
            whatsapp: "917903133317",
        })
        expect(text).toMatch(/packages & planning calls|planning/)
        expect(text).toMatch(/\/next-level-events-kanke\/book/)
        expect(text).toMatch(/Would you like to book/)
        expect(text).toMatch(/WhatsApp/)
        expect(text).not.toMatch(/\bsession\b|\btreatment\b|\bappointment\b/i)
    })

    it("clone + rag prompts steer /book over WA-only for events/photo COLLECT_LEADS", () => {
        const prompt = cloneOperatingPrompt({
            displayName: "Next Level Events",
            roleTemplate: "EVENTS_STUDIO",
            primaryGoal: "COLLECT_LEADS",
            language: "en",
            whatsapp: "917903133317",
        })
        expect(prompt).toMatch(/Book chip|\/book|in-app Book/i)
        expect(prompt).toMatch(/enquire|quote|shoot/i)
        expect(prompt).toMatch(/secondary|never the only/i)
        expect(prompt).toMatch(/Never say session, treatment, or appointment/)

        const photoPrompt = cloneOperatingPrompt({
            displayName: "Let's Click",
            roleTemplate: "PHOTOGRAPHER",
            primaryGoal: "COLLECT_LEADS",
            language: "en",
            whatsapp: "919111122233",
        })
        expect(photoPrompt).toMatch(/Book chip|\/book|in-app Book/i)
        expect(photoPrompt).toMatch(/Never say session, treatment, or appointment/)

        const system = buildSystemPrompt(
            {
                displayName: "Next Level Events",
                slug: "next-level-events-kanke",
                headline: "Events in Kanke",
                bio: "Planning and venues.",
                roleTemplate: "EVENTS_STUDIO",
                primaryGoal: "COLLECT_LEADS",
                language: "en",
                welcomeMessageOverride: null,
                personalityConfig: null,
                whatsapp: "917903133317",
                workExperiences: [],
                projects: [],
                serviceOfferings: nleServices.map((s) => ({
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
        expect(system).toMatch(/Planning calls & packages/)
        expect(system).not.toMatch(/## Services & appointments/)
        expect(system).toMatch(/\/next-level-events-kanke\/book/)
        expect(system).toMatch(/enquire|quote|book-shoot|Book a call/i)
        expect(system).toMatch(/Never say session, treatment, or appointment/)
        expect(system).toMatch(/planning\/brief calls|enquire, quote/)
        // Tool line must not push gym "sessions" for events kits
        expect(system).toMatch(/showServices: Use when asked about rates, enquire, quote/)
        expect(system).not.toMatch(/showServices: Use when asked about rates, booking, or sessions/)
    })

    it("handler already wires appointment_book_path short-circuit", () => {
        const handler = readFileSync(join(root, "src/app/api/chat/handler.ts"), "utf8")
        expect(handler).toMatch(/answerAppointmentBookOrPrice/)
        expect(handler).toMatch(/appointment_book_path/)
    })
})
