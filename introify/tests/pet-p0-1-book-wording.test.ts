import { describe, expect, it } from "vitest"
import { bookChip, guestBookEmptyCopy, reserveSessionCopy, sessionSheetProps, waPrefill } from "@/lib/kit-copy"
import {
    answerAppointmentBookOrPrice,
    appointmentBookAskNoun,
    appointmentBookPrimaryCta,
    appointmentBookPromptGuidance,
} from "@/lib/appointment-chat"

const PLUTO = "pluto-grooming-hinoo"
const PLUTO_SERVICES = [
    { name: "Bath and blow-dry", priceCents: 80000, currency: "INR", durationMinutes: 45 },
    { name: "Full groom — small", priceCents: 120000, currency: "INR", durationMinutes: 75 },
    { name: "Full groom — large", priceCents: 180000, currency: "INR", durationMinutes: 90 },
    { name: "Nails and ears", priceCents: 30000, currency: "INR", durationMinutes: 20 },
]
const NOT_SESSION_OR_TREATMENT = /session|treatment/i

describe("pet-p0-1 PET_GROOMING book wording", () => {
    it("home chip / sticky header / About footer use Book a groom", () => {
        expect(bookChip("PET_GROOMING")).toBe("Book a groom")
        expect(bookChip("pet_grooming")).toBe("Book a groom")
        expect(bookChip("PET_GROOMING")).not.toMatch(NOT_SESSION_OR_TREATMENT)
    })

    it("/book modal (book-list + profile-view) title + button: Book a groom / Book this groom", () => {
        for (const s of PLUTO_SERVICES) {
            const sheet = sessionSheetProps("PET_GROOMING", s.durationMinutes)
            expect(sheet.confirmLabel).toBe("Book this groom")
            expect(sheet.hideParty).toBe(true)
            expect(sheet.partyLabel).toBeUndefined()
            const copy = reserveSessionCopy(sheet.confirmLabel)
            expect(copy.title).toBe("Book a groom")
            expect(copy.title).not.toMatch(NOT_SESSION_OR_TREATMENT)
            expect(sheet.confirmLabel).not.toMatch(NOT_SESSION_OR_TREATMENT)
            expect(copy.success).not.toMatch(NOT_SESSION_OR_TREATMENT)
            expect(copy.toast).not.toMatch(NOT_SESSION_OR_TREATMENT)
        }
    })

    it("chat tap line cites Book a groom + /book", () => {
        const cta = appointmentBookPrimaryCta({ slug: PLUTO, role: "PET_GROOMING" })
        expect(cta).toBe(`Tap **Book a groom** or open /${PLUTO}/book to pick a service and slot.`)
        expect(cta).not.toMatch(NOT_SESSION_OR_TREATMENT)

        const reply = answerAppointmentBookOrPrice({
            query: "how do i book a bath for my dog",
            slug: PLUTO,
            shopName: "Pluto Pet Grooming",
            roleTemplate: "PET_GROOMING",
            primaryGoal: "TAKE_APPOINTMENTS",
            services: PLUTO_SERVICES,
            requestCurrency: "INR",
        })
        expect(reply).toBeTruthy()
        expect(reply!).toMatch(/Tap \*\*Book a groom\*\*/)
        expect(reply!).not.toMatch(NOT_SESSION_OR_TREATMENT)
    })

    it("prompt guidance / ask noun / wa / empty copy stay pet-honest", () => {
        expect(appointmentBookAskNoun("PET_GROOMING")).toBe("groom, bath, or nails")
        const lines = appointmentBookPromptGuidance({
            slug: PLUTO,
            role: "PET_GROOMING",
            goal: "TAKE_APPOINTMENTS",
            hasServices: true,
        })
        expect(lines.join("\n")).toMatch(/\*\*Book a groom\*\*/)
        expect(lines.join("\n")).toMatch(/never session or treatment/)
        expect(waPrefill("PET_GROOMING", "Pluto")).toBe("A groom at Pluto")
        expect(guestBookEmptyCopy("PET_GROOMING")).toBe("No grooming slots to book.")
    })
})

describe("pet-p0-1 no cross-role regression", () => {
    it("bookChip nouns unchanged for gym / salon / barber / clinic / field / RE / recruit", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("BARBER")).toBe("Book a treatment")
        expect(bookChip("CLINIC")).toBe("Book an appointment")
        expect(bookChip("FIELD_SERVICE")).toBe("Request a visit")
        expect(bookChip("PLUMBER")).toBe("Request a visit")
        expect(bookChip("REAL_ESTATE_BROKERAGE")).toBe("Book a call")
        expect(bookChip("RECRUITMENT_AGENCY")).toBe("Book a call")
    })

    it("modal title + button unchanged for other roles", () => {
        const modal = (role: string) => {
            const s = sessionSheetProps(role, 45)
            return { title: reserveSessionCopy(s.confirmLabel).title, button: s.confirmLabel, s }
        }
        expect(modal("GYM")).toMatchObject({ title: "Book a session", button: "Book session" })
        expect(modal("GYM").s.partyLabel).toBe("Attendees")
        expect(modal("SALON_SPA")).toMatchObject({ title: "Book a treatment", button: "Book treatment" })
        expect(modal("SALON_SPA").s.partyLabel).toBe("45 min")
        expect(modal("CLINIC")).toMatchObject({ title: "Book an appointment", button: "Book appointment" })
        expect(modal("FIELD_SERVICE")).toMatchObject({ title: "Book a visit", button: "Book visit" })
        expect(modal("PLUMBER")).toMatchObject({ title: "Book a visit", button: "Book visit" })
        expect(modal("REAL_ESTATE_BROKERAGE")).toMatchObject({ title: "Book a call", button: "Book call" })
        expect(modal("RECRUITMENT_AGENCY")).toMatchObject({ title: "Book a call", button: "Book call" })
        expect(modal("CA")).toMatchObject({ title: "Book a consult", button: "Book consult" })
    })

    it("chat tap lines unchanged for other roles", () => {
        expect(appointmentBookPrimaryCta({ slug: "aura-fitness-ranchi", role: "GYM" })).toMatch(/Book a session/)
        expect(appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })).toMatch(/Book a treatment/)
        expect(appointmentBookPrimaryCta({ slug: "jk-sharma-clinic-harmu", role: "CLINIC" })).toMatch(/Book an appointment/)
        expect(appointmentBookPrimaryCta({ slug: "goodwill-plumbing", role: "PLUMBER" })).toMatch(/Request a visit/)
        expect(appointmentBookPrimaryCta({ slug: "shakti-property-lalpur", role: "REAL_ESTATE_BROKERAGE" })).toMatch(/Book a call/)
        expect(appointmentBookPrimaryCta({ slug: "nita-recruiters-ashok-nagar", role: "RECRUITMENT_AGENCY" })).toMatch(/Book a call/)
        const salonLines = appointmentBookPromptGuidance({ slug: "h-square-salon-harmu", role: "SALON_SPA", goal: "TAKE_APPOINTMENTS", hasServices: true })
        expect(salonLines.join("\n")).not.toMatch(/pet grooming/)
    })

    it("wa prefill + empty copy unchanged for other roles", () => {
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
        expect(waPrefill("BARBER", "Prince")).toMatch(/treatment/i)
        expect(waPrefill("CLINIC", "JK")).toMatch(/appointment/i)
        expect(waPrefill("PLUMBER", "Goodwill")).toMatch(/visit/i)
        expect(guestBookEmptyCopy("GYM")).toBe("No sessions to book.")
        expect(guestBookEmptyCopy("SALON_SPA")).toBe("No treatments to book.")
        expect(guestBookEmptyCopy("BARBER")).toBe("No treatments to book.")
        expect(guestBookEmptyCopy("CLINIC")).toBe("No appointments to book.")
    })
})
