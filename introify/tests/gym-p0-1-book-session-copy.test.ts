import { describe, expect, it } from "vitest"
import { appointmentBookHref, bookChip, waPrefill } from "@/lib/kit-copy"
import {
    appointmentBookAskNoun,
    appointmentBookPrimaryCta,
    appointmentBookPromptGuidance,
    answerAppointmentBookOrPrice,
} from "@/lib/appointment-chat"
import { cloneOperatingPrompt } from "@/lib/clone-identity"

const INR = "\u20b9"

const gymServices = [
    { name: "Intro session", priceCents: 49_900, currency: "INR", isFree: false, durationMinutes: 45 },
    { name: "Personal training", priceCents: 90_000, currency: "INR", isFree: false, durationMinutes: 60 },
]

const yogaServices = [
    { name: "Morning Hatha", priceCents: 25_000, currency: "INR", isFree: false, durationMinutes: 60 },
    { name: "Private hour", priceCents: 80_000, currency: "INR", isFree: false, durationMinutes: 60 },
]

describe("gym-p0-1 bookChip by roleTemplate flavor", () => {
    it("GYM/YOGA use session/class — never treatment", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("YOGA")).toBe("Book a class")
        expect(bookChip("GYM")).not.toMatch(/treatment/i)
        expect(bookChip("YOGA")).not.toMatch(/treatment/i)
    })

    it("salon/barber keep Book a treatment (no cross-role regress)", () => {
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("BARBER")).toBe("Book a treatment")
    })

    it("routes gym/yoga TAKE_APPOINTMENTS homes to /book", () => {
        expect(appointmentBookHref("aura-fitness-ranchi", "GYM", "TAKE_APPOINTMENTS")).toBe(
            "/aura-fitness-ranchi/book",
        )
        expect(appointmentBookHref("natraj-yoga-kutchery", "YOGA", "TAKE_APPOINTMENTS")).toBe(
            "/natraj-yoga-kutchery/book",
        )
        expect(appointmentBookHref("fit24-ranchi", "GYM", "TAKE_APPOINTMENTS")).toBe("/fit24-ranchi/book")
        expect(appointmentBookHref("fitness-addiction-doranda", "GYM", "TAKE_APPOINTMENTS")).toBe(
            "/fitness-addiction-doranda/book",
        )
    })

    it("wa prefill matches flavor nouns", () => {
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("YOGA", "Natraj")).toMatch(/class/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
        expect(waPrefill("BARBER", "Prince")).toMatch(/treatment/i)
    })
})

describe("gym-p0-1 chat booking steers", () => {
    it("primary CTA cites session/class + /book", () => {
        const gym = appointmentBookPrimaryCta({ slug: "aura-fitness-ranchi", role: "GYM" })
        expect(gym).toMatch(/Book a session/)
        expect(gym).toMatch(/\/aura-fitness-ranchi\/book/)
        expect(gym).not.toMatch(/treatment/i)

        const yoga = appointmentBookPrimaryCta({ slug: "natraj-yoga-kutchery", role: "YOGA" })
        expect(yoga).toMatch(/Book a class/)
        expect(yoga).toMatch(/\/natraj-yoga-kutchery\/book/)
        expect(yoga).not.toMatch(/treatment/i)

        const salon = appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })
        expect(salon).toMatch(/Book a treatment/)
    })

    it("prompt guidance uses flavor nouns", () => {
        expect(appointmentBookAskNoun("GYM")).toMatch(/session/i)
        expect(appointmentBookAskNoun("YOGA")).toMatch(/class/i)
        expect(appointmentBookAskNoun("SALON_SPA")).toMatch(/treatment/i)

        const g = appointmentBookPromptGuidance({
            slug: "aura-fitness-ranchi",
            role: "GYM",
            goal: "TAKE_APPOINTMENTS",
            hasServices: true,
            whatsapp: "919999999999",
        }).join(" ")
        expect(g).toMatch(/Book a session/)
        expect(g).toMatch(/\/aura-fitness-ranchi\/book/)
        expect(g).not.toMatch(/treatment\/haircut/)
        expect(g.toLowerCase()).toMatch(/session/)
    })

    it("desk book/price reply for gym cites session + INR + /book", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "how do I book?",
            slug: "aura-fitness-ranchi",
            shopName: "Aura Fitness Ranchi",
            roleTemplate: "GYM",
            primaryGoal: "TAKE_APPOINTMENTS",
            services: gymServices,
            requestCurrency: "INR",
            whatsapp: "917766005931",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/Book a session/)
        expect(reply!).toMatch(/\/aura-fitness-ranchi\/book/)
        expect(reply!).toMatch(new RegExp(`${INR}499|${INR}900`))
        expect(reply!).not.toMatch(/treatment/i)
    })

    it("desk book reply for yoga cites class + /book", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "how do I book a class?",
            slug: "natraj-yoga-kutchery",
            shopName: "Natraj Institute of Yoga",
            roleTemplate: "YOGA",
            primaryGoal: "TAKE_APPOINTMENTS",
            services: yogaServices,
            requestCurrency: "INR",
            whatsapp: "917808475779",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/Book a class/)
        expect(reply!).toMatch(/\/natraj-yoga-kutchery\/book/)
        expect(reply!).not.toMatch(/treatment/i)
    })

    it("clone playbook for gym/yoga avoids treatments wording", () => {
        const gym = cloneOperatingPrompt({
            displayName: "Aura Fitness Ranchi",
            roleTemplate: "GYM",
            primaryGoal: "TAKE_APPOINTMENTS",
            whatsapp: "917766005931",
        })
        expect(gym).toMatch(/sessions/i)
        expect(gym).not.toMatch(/book treatments/i)

        const yoga = cloneOperatingPrompt({
            displayName: "Natraj Institute of Yoga",
            roleTemplate: "YOGA",
            primaryGoal: "TAKE_APPOINTMENTS",
        })
        expect(yoga).toMatch(/classes/i)
        expect(yoga).not.toMatch(/book treatments/i)

        const salon = cloneOperatingPrompt({
            displayName: "H Square Salon",
            roleTemplate: "SALON_SPA",
            primaryGoal: "TAKE_APPOINTMENTS",
        })
        expect(salon).toMatch(/treatments/i)
    })
})
