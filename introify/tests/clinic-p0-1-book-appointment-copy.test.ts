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

const clinicServices = [
    { name: "Morning consultation", priceCents: 50_000, currency: "INR", isFree: false, durationMinutes: 20 },
    { name: "Evening consultation", priceCents: 50_000, currency: "INR", isFree: false, durationMinutes: 20 },
]

describe("clinic-p0-1 bookChip by roleTemplate flavor", () => {
    it("CLINIC uses appointment - never session/treatment", () => {
        expect(bookChip("CLINIC")).toBe("Book an appointment")
        expect(bookChip("CLINIC")).not.toMatch(/session/i)
        expect(bookChip("CLINIC")).not.toMatch(/treatment/i)
    })

    it("gym keeps session/class; salon keeps treatment (no cross-role regress)", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("YOGA")).toBe("Book a class")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("BARBER")).toBe("Book a treatment")
    })

    it("routes clinic TAKE_APPOINTMENTS home to /book", () => {
        expect(appointmentBookHref("jk-sharma-clinic-harmu", "CLINIC", "TAKE_APPOINTMENTS")).toBe(
            "/jk-sharma-clinic-harmu/book",
        )
    })

    it("wa prefill matches clinic appointment noun", () => {
        expect(waPrefill("CLINIC", "JK Sharma Clinic")).toMatch(/appointment/i)
        expect(waPrefill("CLINIC", "JK Sharma Clinic")).not.toMatch(/session/i)
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
    })
})

describe("clinic-p0-1 chat booking steers", () => {
    it("primary CTA cites appointment + /book", () => {
        const clinic = appointmentBookPrimaryCta({ slug: "jk-sharma-clinic-harmu", role: "CLINIC" })
        expect(clinic).toMatch(/Book an appointment/)
        expect(clinic).toMatch(/\/jk-sharma-clinic-harmu\/book/)
        expect(clinic).not.toMatch(/session/i)
        expect(clinic).not.toMatch(/treatment/i)

        const gym = appointmentBookPrimaryCta({ slug: "aura-fitness-ranchi", role: "GYM" })
        expect(gym).toMatch(/Book a session/)
        const salon = appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })
        expect(salon).toMatch(/Book a treatment/)
    })

    it("prompt guidance uses appointment/consult nouns", () => {
        expect(appointmentBookAskNoun("CLINIC")).toMatch(/appointment/i)
        expect(appointmentBookAskNoun("CLINIC")).not.toMatch(/session/i)
        expect(appointmentBookAskNoun("GYM")).toMatch(/session/i)
        expect(appointmentBookAskNoun("SALON_SPA")).toMatch(/treatment/i)

        const g = appointmentBookPromptGuidance({
            slug: "jk-sharma-clinic-harmu",
            role: "CLINIC",
            goal: "TAKE_APPOINTMENTS",
            hasServices: true,
            whatsapp: "919999999999",
        }).join(" ")
        expect(g).toMatch(/Book an appointment/)
        expect(g).toMatch(/\/jk-sharma-clinic-harmu\/book/)
        expect(g).not.toMatch(/session/i)
        expect(g.toLowerCase()).toMatch(/appointment|consultation/)
    })

    it("desk book/price reply for clinic cites appointment + INR + /book", () => {
        const reply = answerAppointmentBookOrPrice({
            query: "how do I book?",
            slug: "jk-sharma-clinic-harmu",
            shopName: "JK Sharma Clinic",
            roleTemplate: "CLINIC",
            primaryGoal: "TAKE_APPOINTMENTS",
            services: clinicServices,
            requestCurrency: "INR",
            whatsapp: "919876543210",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/Book an appointment/)
        expect(reply!).toMatch(/\/jk-sharma-clinic-harmu\/book/)
        expect(reply!).toMatch(new RegExp(`${INR}500`))
        expect(reply!).not.toMatch(/session/i)
        expect(reply!).not.toMatch(/treatment/i)
    })

    it("clone playbook for clinic uses appointments not sessions/treatments", () => {
        const clinic = cloneOperatingPrompt({
            displayName: "JK Sharma Clinic",
            roleTemplate: "CLINIC",
            primaryGoal: "TAKE_APPOINTMENTS",
            whatsapp: "919876543210",
        })
        expect(clinic).toMatch(/appointments/i)
        expect(clinic).not.toMatch(/book sessions/i)
        expect(clinic).not.toMatch(/book treatments/i)

        const gym = cloneOperatingPrompt({
            displayName: "Aura Fitness Ranchi",
            roleTemplate: "GYM",
            primaryGoal: "TAKE_APPOINTMENTS",
        })
        expect(gym).toMatch(/sessions/i)

        const salon = cloneOperatingPrompt({
            displayName: "H Square Salon",
            roleTemplate: "SALON_SPA",
            primaryGoal: "TAKE_APPOINTMENTS",
        })
        expect(salon).toMatch(/treatments/i)
    })
})
