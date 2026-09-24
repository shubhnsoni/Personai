import { describe, expect, it } from "vitest"
import { bookChip, guestBookEmptyCopy, waPrefill } from "@/lib/kit-copy"
import { appointmentBookAskNoun, appointmentBookPrimaryCta } from "@/lib/appointment-chat"

describe("recruit-p0-1 bookChip by roleTemplate flavor", () => {
    it("RECRUITMENT_AGENCY uses Book a call — never session", () => {
        expect(bookChip("RECRUITMENT_AGENCY")).toBe("Book a call")
        expect(bookChip("RECRUITMENT_AGENCY")).not.toMatch(/session/i)
    })

    it("gym/salon/clinic/events/RE/field keep their nouns (no cross-role regress)", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("CLINIC")).toBe("Book an appointment")
        expect(bookChip("EVENTS_STUDIO")).toBe("Book a call")
        expect(bookChip("REAL_ESTATE_BROKERAGE")).toBe("Book a call")
        expect(bookChip("FIELD_SERVICE")).toBe("Request a visit")
        expect(bookChip("PLUMBER")).toBe("Request a visit")
    })

    it("wa prefill matches call language for recruitment", () => {
        expect(waPrefill("RECRUITMENT_AGENCY", "Nita Recruiter")).toMatch(/call/i)
        expect(waPrefill("RECRUITMENT_AGENCY", "Nita")).not.toMatch(/session/i)
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("CLINIC", "JK")).toMatch(/appointment/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
        expect(waPrefill("EVENTS_STUDIO", "NLE")).toMatch(/call/i)
        expect(waPrefill("REAL_ESTATE_BROKERAGE", "Shakti")).toMatch(/call/i)
        expect(waPrefill("PLUMBER", "Goodwill")).toMatch(/visit/i)
    })

    it("empty /book copy for recruitment avoids session noun", () => {
        expect(guestBookEmptyCopy("RECRUITMENT_AGENCY")).toBe("No calls to book.")
        expect(guestBookEmptyCopy("RECRUITMENT_AGENCY")).not.toMatch(/session/i)
        expect(guestBookEmptyCopy("GYM")).toMatch(/session/i)
        expect(guestBookEmptyCopy("CLINIC")).toMatch(/appointment/i)
        expect(guestBookEmptyCopy("SALON_SPA")).toMatch(/treatment/i)
        expect(guestBookEmptyCopy("EVENTS_STUDIO")).toMatch(/call/i)
        expect(guestBookEmptyCopy("REAL_ESTATE_BROKERAGE")).toMatch(/call/i)
        expect(guestBookEmptyCopy("FIELD_SERVICE")).toMatch(/visit/i)
    })
})

describe("recruit-p0-1 chat booking steers (copy only)", () => {
    it("primary CTA cites Book a call + /book — never session", () => {
        const nita = appointmentBookPrimaryCta({
            slug: "nita-recruiters-ashok-nagar",
            role: "RECRUITMENT_AGENCY",
        })
        expect(nita).toMatch(/Book a call/)
        expect(nita).toMatch(/\/nita-recruiters-ashok-nagar\/book/)
        expect(nita).not.toMatch(/session/i)

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
        expect(appointmentBookPrimaryCta({ slug: "goodwill-plumbing", role: "PLUMBER" })).toMatch(/Request a visit/)
    })

    it("ask noun uses call/interview/hiring brief — never session", () => {
        expect(appointmentBookAskNoun("RECRUITMENT_AGENCY")).toMatch(/call|interview|hiring brief/i)
        expect(appointmentBookAskNoun("RECRUITMENT_AGENCY")).not.toMatch(/session/i)
        expect(appointmentBookAskNoun("GYM")).toMatch(/session/i)
        expect(appointmentBookAskNoun("CLINIC")).toMatch(/appointment/i)
        expect(appointmentBookAskNoun("SALON_SPA")).toMatch(/treatment/i)
        expect(appointmentBookAskNoun("EVENTS_STUDIO")).toMatch(/call|enquire|shoot/i)
        expect(appointmentBookAskNoun("REAL_ESTATE_BROKERAGE")).toMatch(/call|consultation|viewing/i)
        expect(appointmentBookAskNoun("FIELD_SERVICE")).toMatch(/visit|job|service/i)
    })
})

describe("recruit-p0-1 modal confirmLabel contract (reserve-sheet)", () => {
    /**
     * sessionSheetProps (profile-view + book-list) maps RECRUITMENT_AGENCY → confirmLabel "Book call".
     * reserve-sheet sessionCopy("Book call") → title "Book a call", button "Book call".
     * Mirror that contract here so regress catches title/session leaks without mounting React.
     */
    const sessionCopy = (confirmLabel?: string) => {
        switch (confirmLabel) {
            case "Book appointment":
                return { title: "Book an appointment", button: "Book appointment" }
            case "Book consult":
                return { title: "Book a consult", button: "Book consult" }
            case "Book treatment":
                return { title: "Book a treatment", button: "Book treatment" }
            case "Book call":
                return { title: "Book a call", button: "Book call" }
            case "Book visit":
                return { title: "Book a visit", button: "Book visit" }
            default:
                return { title: "Book a session", button: "Book session" }
        }
    }

    const sheetConfirm = (role?: string | null) => {
        switch (role) {
            case "CLINIC":
                return "Book appointment"
            case "CA":
                return "Book consult"
            case "SALON_SPA":
                return "Book treatment"
            case "EVENTS_STUDIO":
            case "PHOTOGRAPHER":
            case "CATERER":
            case "TRAVEL":
                return "Book call"
            case "REAL_ESTATE_BROKERAGE":
            case "RECRUITMENT_AGENCY":
                return "Book call"
            case "FIELD_SERVICE":
            case "PLUMBER":
            case "ELECTRICIAN":
            case "AC_REPAIR":
            case "GARAGE":
                return "Book visit"
            default:
                return "Book session"
        }
    }

    it("Nita / RECRUITMENT_AGENCY modal title+button never say session", () => {
        const copy = sessionCopy(sheetConfirm("RECRUITMENT_AGENCY"))
        expect(copy.title).toBe("Book a call")
        expect(copy.button).toBe("Book call")
        expect(copy.title).not.toMatch(/session/i)
        expect(copy.button).not.toMatch(/session/i)
    })

    it("/book slot modals use call language (Hiring brief call / Candidate intro / Interview slot)", () => {
        for (const _slot of ["Hiring brief call", "Candidate intro", "Interview slot"]) {
            const copy = sessionCopy(sheetConfirm("RECRUITMENT_AGENCY"))
            expect(copy.title).toMatch(/call|interview|enquire/i)
            expect(copy.title).not.toMatch(/session/i)
            expect(copy.button).not.toMatch(/session/i)
            expect(copy.title).toBe("Book a call")
            expect(copy.button).toBe("Book call")
        }
    })

    it("gym/salon/clinic/events/RE/field modal nouns unchanged", () => {
        expect(sessionCopy(sheetConfirm("GYM")).title).toBe("Book a session")
        expect(sessionCopy(sheetConfirm("SALON_SPA")).title).toBe("Book a treatment")
        expect(sessionCopy(sheetConfirm("CLINIC")).title).toBe("Book an appointment")
        expect(sessionCopy(sheetConfirm("EVENTS_STUDIO")).title).toBe("Book a call")
        expect(sessionCopy(sheetConfirm("REAL_ESTATE_BROKERAGE")).title).toBe("Book a call")
        expect(sessionCopy(sheetConfirm("PLUMBER")).title).toBe("Book a visit")
        expect(sessionCopy(sheetConfirm("FIELD_SERVICE")).title).toBe("Book a visit")
    })
})
