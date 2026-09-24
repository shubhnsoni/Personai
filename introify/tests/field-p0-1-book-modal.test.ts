import { describe, expect, it } from "vitest"
import { bookChip, guestBookEmptyCopy, waPrefill } from "@/lib/kit-copy"
import { appointmentBookAskNoun, appointmentBookPrimaryCta } from "@/lib/appointment-chat"

const FIELD_ROLES = ["FIELD_SERVICE", "PLUMBER", "ELECTRICIAN", "AC_REPAIR", "GARAGE"] as const

describe("field-p0-1 bookChip by roleTemplate flavor", () => {
    it("FIELD_SERVICE / PLUMBER / ELECTRICIAN / AC_REPAIR / GARAGE use Request a visit — never session", () => {
        for (const role of FIELD_ROLES) {
            expect(bookChip(role)).toBe("Request a visit")
            expect(bookChip(role)).not.toMatch(/session/i)
        }
    })

    it("gym/salon/clinic/events/RE keep their nouns (no cross-role regress)", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("CLINIC")).toBe("Book an appointment")
        expect(bookChip("EVENTS_STUDIO")).toBe("Book a call")
        expect(bookChip("REAL_ESTATE_BROKERAGE")).toBe("Book a call")
    })

    it("wa prefill matches visit language for field flavors", () => {
        expect(waPrefill("PLUMBER", "Goodwill")).toMatch(/visit/i)
        expect(waPrefill("PLUMBER", "Goodwill")).not.toMatch(/session/i)
        expect(waPrefill("ELECTRICIAN", "Vicky")).toMatch(/visit/i)
        expect(waPrefill("AC_REPAIR", "Cooling")).toMatch(/visit/i)
        expect(waPrefill("GARAGE", "Bhola")).toMatch(/visit/i)
        expect(waPrefill("FIELD_SERVICE", "Crew")).toMatch(/visit/i)
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("CLINIC", "JK")).toMatch(/appointment/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
        expect(waPrefill("EVENTS_STUDIO", "NLE")).toMatch(/call/i)
        expect(waPrefill("REAL_ESTATE_BROKERAGE", "Shakti")).toMatch(/call/i)
    })

    it("empty /book copy for field avoids session noun", () => {
        for (const role of FIELD_ROLES) {
            expect(guestBookEmptyCopy(role)).toBe("No visits to book.")
            expect(guestBookEmptyCopy(role)).not.toMatch(/session/i)
        }
        expect(guestBookEmptyCopy("GYM")).toMatch(/session/i)
        expect(guestBookEmptyCopy("CLINIC")).toMatch(/appointment/i)
        expect(guestBookEmptyCopy("SALON_SPA")).toMatch(/treatment/i)
        expect(guestBookEmptyCopy("EVENTS_STUDIO")).toMatch(/call/i)
        expect(guestBookEmptyCopy("REAL_ESTATE_BROKERAGE")).toMatch(/call/i)
    })
})

describe("field-p0-1 chat booking steers (copy only)", () => {
    it("primary CTA cites Request a visit + /book — never session", () => {
        const goodwill = appointmentBookPrimaryCta({ slug: "goodwill-plumbing", role: "PLUMBER" })
        expect(goodwill).toMatch(/Request a visit/)
        expect(goodwill).toMatch(/\/goodwill-plumbing\/book/)
        expect(goodwill).not.toMatch(/session/i)

        expect(appointmentBookPrimaryCta({ slug: "jharkhand-plumbing-electrical", role: "FIELD_SERVICE" })).not.toMatch(
            /session/i,
        )
        expect(appointmentBookPrimaryCta({ slug: "vicky-electrical", role: "ELECTRICIAN" })).toMatch(/Request a visit/)
        expect(appointmentBookPrimaryCta({ slug: "cooling-world-ranchi", role: "AC_REPAIR" })).toMatch(/Request a visit/)
        expect(appointmentBookPrimaryCta({ slug: "bhola-service-centre", role: "GARAGE" })).toMatch(/Request a visit/)

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

    it("ask noun uses visit/job/service — never session", () => {
        for (const role of FIELD_ROLES) {
            expect(appointmentBookAskNoun(role)).toMatch(/visit|job|service/i)
            expect(appointmentBookAskNoun(role)).not.toMatch(/session/i)
        }
        expect(appointmentBookAskNoun("GYM")).toMatch(/session/i)
        expect(appointmentBookAskNoun("CLINIC")).toMatch(/appointment/i)
        expect(appointmentBookAskNoun("SALON_SPA")).toMatch(/treatment/i)
        expect(appointmentBookAskNoun("EVENTS_STUDIO")).toMatch(/call|enquire|shoot/i)
        expect(appointmentBookAskNoun("REAL_ESTATE_BROKERAGE")).toMatch(/call|consultation|viewing/i)
    })
})

describe("field-p0-1 modal confirmLabel contract (reserve-sheet)", () => {
    /**
     * sessionSheetProps (profile-view + book-list) maps FIELD_SERVICE / PLUMBER / ELECTRICIAN /
     * AC_REPAIR / GARAGE → confirmLabel "Book visit".
     * reserve-sheet sessionCopy("Book visit") → title "Book a visit", button "Book visit".
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

    it("Goodwill / PLUMBER modal title+button never say session", () => {
        const copy = sessionCopy(sheetConfirm("PLUMBER"))
        expect(copy.title).toBe("Book a visit")
        expect(copy.button).toBe("Book visit")
        expect(copy.title).not.toMatch(/session/i)
        expect(copy.button).not.toMatch(/session/i)
    })

    it("/book slot modals use visit language for all field flavors (Site visit / Tap repair / …)", () => {
        for (const role of FIELD_ROLES) {
            for (const _slot of ["Site visit", "Tap and mixer repair", "Pipe leak repair"]) {
                const copy = sessionCopy(sheetConfirm(role))
                expect(copy.title).toMatch(/visit|job|service/i)
                expect(copy.title).not.toMatch(/session/i)
                expect(copy.button).not.toMatch(/session/i)
                expect(copy.title).toBe("Book a visit")
                expect(copy.button).toBe("Book visit")
            }
        }
    })

    it("gym/salon/clinic/events/RE modal nouns unchanged", () => {
        expect(sessionCopy(sheetConfirm("GYM")).title).toBe("Book a session")
        expect(sessionCopy(sheetConfirm("SALON_SPA")).title).toBe("Book a treatment")
        expect(sessionCopy(sheetConfirm("CLINIC")).title).toBe("Book an appointment")
        expect(sessionCopy(sheetConfirm("EVENTS_STUDIO")).title).toBe("Book a call")
        expect(sessionCopy(sheetConfirm("REAL_ESTATE_BROKERAGE")).title).toBe("Book a call")
    })
})
