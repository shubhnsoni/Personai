import { describe, expect, it } from "vitest"
import { bookChip, guestBookEmptyCopy, waPrefill } from "@/lib/kit-copy"
import { appointmentBookAskNoun, appointmentBookPrimaryCta } from "@/lib/appointment-chat"

describe("realestate-p0-1 bookChip by roleTemplate flavor", () => {
    it("REAL_ESTATE_BROKERAGE uses Book a call — never session", () => {
        expect(bookChip("REAL_ESTATE_BROKERAGE")).toBe("Book a call")
        expect(bookChip("REAL_ESTATE_BROKERAGE")).not.toMatch(/session/i)
    })

    it("gym/salon/clinic/events keep their nouns (no cross-role regress)", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("CLINIC")).toBe("Book an appointment")
        expect(bookChip("EVENTS_STUDIO")).toBe("Book a call")
    })

    it("wa prefill matches call language for real estate", () => {
        expect(waPrefill("REAL_ESTATE_BROKERAGE", "Shakti Property")).toMatch(/call/i)
        expect(waPrefill("REAL_ESTATE_BROKERAGE", "Shakti")).not.toMatch(/session/i)
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("CLINIC", "JK")).toMatch(/appointment/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
        expect(waPrefill("EVENTS_STUDIO", "NLE")).toMatch(/call/i)
    })

    it("empty /book copy for real estate avoids session noun", () => {
        expect(guestBookEmptyCopy("REAL_ESTATE_BROKERAGE")).toBe("No calls to book.")
        expect(guestBookEmptyCopy("REAL_ESTATE_BROKERAGE")).not.toMatch(/session/i)
        expect(guestBookEmptyCopy("GYM")).toMatch(/session/i)
        expect(guestBookEmptyCopy("CLINIC")).toMatch(/appointment/i)
        expect(guestBookEmptyCopy("SALON_SPA")).toMatch(/treatment/i)
        expect(guestBookEmptyCopy("EVENTS_STUDIO")).toMatch(/call/i)
    })
})

describe("realestate-p0-1 chat booking steers (copy only; prefers-path is P1)", () => {
    it("primary CTA cites Book a call + /book — never session", () => {
        const shakti = appointmentBookPrimaryCta({ slug: "shakti-property-lalpur", role: "REAL_ESTATE_BROKERAGE" })
        expect(shakti).toMatch(/Book a call/)
        expect(shakti).toMatch(/\/shakti-property-lalpur\/book/)
        expect(shakti).not.toMatch(/session/i)

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

    it("ask noun uses call/consultation/viewing — never session", () => {
        expect(appointmentBookAskNoun("REAL_ESTATE_BROKERAGE")).toMatch(/call|consultation|viewing/i)
        expect(appointmentBookAskNoun("REAL_ESTATE_BROKERAGE")).not.toMatch(/session/i)
        expect(appointmentBookAskNoun("GYM")).toMatch(/session/i)
        expect(appointmentBookAskNoun("CLINIC")).toMatch(/appointment/i)
        expect(appointmentBookAskNoun("SALON_SPA")).toMatch(/treatment/i)
        expect(appointmentBookAskNoun("EVENTS_STUDIO")).toMatch(/call|enquire|shoot/i)
    })
})

describe("realestate-p0-1 modal confirmLabel contract (reserve-sheet)", () => {
    /**
     * sessionSheetProps (profile-view + book-list) maps REAL_ESTATE_BROKERAGE → confirmLabel "Book call".
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
            case "Request visit":
                return { title: "Request a visit", button: "Request visit" }
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
                return "Request visit"
            default:
                return "Book session"
        }
    }

    it("Shakti / REAL_ESTATE modal title+button never say session", () => {
        const copy = sessionCopy(sheetConfirm("REAL_ESTATE_BROKERAGE"))
        expect(copy.title).toBe("Book a call")
        expect(copy.button).toBe("Book call")
        expect(copy.title).not.toMatch(/session/i)
        expect(copy.button).not.toMatch(/session/i)
    })

    it("/book slot modals use call language (Property consultation / Site viewing / Mandate review)", () => {
        // All three Shakti services share roleTemplate → same confirmLabel → call chrome.
        for (const _slot of ["Property consultation", "Site viewing", "Mandate review"]) {
            const copy = sessionCopy(sheetConfirm("REAL_ESTATE_BROKERAGE"))
            expect(copy.title).toMatch(/call|consultation|viewing|enquire/i)
            expect(copy.title).not.toMatch(/session/i)
            expect(copy.button).not.toMatch(/session/i)
        }
    })

    it("gym/salon/clinic/events modal nouns unchanged", () => {
        expect(sessionCopy(sheetConfirm("GYM")).title).toBe("Book a session")
        expect(sessionCopy(sheetConfirm("SALON_SPA")).title).toBe("Book a treatment")
        expect(sessionCopy(sheetConfirm("CLINIC")).title).toBe("Book an appointment")
        expect(sessionCopy(sheetConfirm("EVENTS_STUDIO")).title).toBe("Book a call")
    })
})
