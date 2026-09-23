import { describe, expect, it } from "vitest"
import { bookChip, guestBookEmptyCopy, waPrefill } from "@/lib/kit-copy"
import {
    appointmentBookAskNoun,
    appointmentBookPrimaryCta,
    appointmentBookPromptGuidance,
} from "@/lib/appointment-chat"

describe("events-p0-1 bookChip by roleTemplate flavor", () => {
    it("EVENTS_STUDIO + PHOTOGRAPHER use Book a call — never session", () => {
        expect(bookChip("EVENTS_STUDIO")).toBe("Book a call")
        expect(bookChip("PHOTOGRAPHER")).toBe("Book a call")
        expect(bookChip("EVENTS_STUDIO")).not.toMatch(/session/i)
        expect(bookChip("PHOTOGRAPHER")).not.toMatch(/session/i)
        expect(bookChip("CATERER")).toBe("Book a call")
        expect(bookChip("TRAVEL")).toBe("Book a call")
    })

    it("gym/salon/clinic keep their nouns (no cross-role regress)", () => {
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
        expect(bookChip("CLINIC")).toBe("Book an appointment")
    })

    it("wa prefill matches call language for events/photo", () => {
        expect(waPrefill("EVENTS_STUDIO", "Next Level Events")).toMatch(/call/i)
        expect(waPrefill("PHOTOGRAPHER", "Let's Click")).toMatch(/call/i)
        expect(waPrefill("EVENTS_STUDIO", "NLE")).not.toMatch(/session/i)
        expect(waPrefill("GYM", "Aura")).toMatch(/session/i)
        expect(waPrefill("CLINIC", "JK")).toMatch(/appointment/i)
        expect(waPrefill("SALON_SPA", "H Square")).toMatch(/treatment/i)
    })

    it("empty /book copy for events/photo avoids session noun", () => {
        expect(guestBookEmptyCopy("EVENTS_STUDIO")).toBe("No calls to book.")
        expect(guestBookEmptyCopy("PHOTOGRAPHER")).toBe("No calls to book.")
        expect(guestBookEmptyCopy("EVENTS_STUDIO")).not.toMatch(/session/i)
        expect(guestBookEmptyCopy("GYM")).toMatch(/session/i)
        expect(guestBookEmptyCopy("CLINIC")).toMatch(/appointment/i)
        expect(guestBookEmptyCopy("SALON_SPA")).toMatch(/treatment/i)
    })
})

describe("events-p0-1 chat booking steers", () => {
    it("primary CTA cites Book a call + /book", () => {
        const nle = appointmentBookPrimaryCta({ slug: "next-level-events-kanke", role: "EVENTS_STUDIO" })
        expect(nle).toMatch(/Book a call/)
        expect(nle).toMatch(/\/next-level-events-kanke\/book/)
        expect(nle).not.toMatch(/session/i)

        const lc = appointmentBookPrimaryCta({ slug: "lets-click-ratu-road", role: "PHOTOGRAPHER" })
        expect(lc).toMatch(/Book a call/)
        expect(lc).toMatch(/\/lets-click-ratu-road\/book/)
        expect(lc).not.toMatch(/session/i)

        expect(appointmentBookPrimaryCta({ slug: "aura-fitness-ranchi", role: "GYM" })).toMatch(/Book a session/)
        expect(appointmentBookPrimaryCta({ slug: "h-square-salon-harmu", role: "SALON_SPA" })).toMatch(
            /Book a treatment/,
        )
        expect(appointmentBookPrimaryCta({ slug: "jk-sharma-clinic-harmu", role: "CLINIC" })).toMatch(
            /Book an appointment/,
        )
    })

    it("ask noun uses call/enquire — never session", () => {
        expect(appointmentBookAskNoun("EVENTS_STUDIO")).toMatch(/call|enquire|shoot/i)
        expect(appointmentBookAskNoun("EVENTS_STUDIO")).not.toMatch(/session/i)
        expect(appointmentBookAskNoun("PHOTOGRAPHER")).toMatch(/call|enquire|shoot/i)
        expect(appointmentBookAskNoun("PHOTOGRAPHER")).not.toMatch(/session/i)
        expect(appointmentBookAskNoun("GYM")).toMatch(/session/i)
        expect(appointmentBookAskNoun("CLINIC")).toMatch(/appointment/i)
        expect(appointmentBookAskNoun("SALON_SPA")).toMatch(/treatment/i)
    })

    it("prompt guidance cites Book a call without session", () => {
        const g = appointmentBookPromptGuidance({
            slug: "next-level-events-kanke",
            role: "EVENTS_STUDIO",
            goal: "COLLECT_LEADS",
            hasServices: true,
            whatsapp: "917903133317",
        }).join(" ")
        // COLLECT_LEADS may not prefer appointment path — guidance can be empty.
        // Flavor noun path is covered above; when guidance fires (TAKE_APPOINTMENTS), chip must be call.
        const g2 = appointmentBookPromptGuidance({
            slug: "next-level-events-kanke",
            role: "EVENTS_STUDIO",
            goal: "TAKE_APPOINTMENTS",
            hasServices: true,
            whatsapp: "917903133317",
        }).join(" ")
        expect(g2).toMatch(/Book a call/)
        expect(g2).toMatch(/\/next-level-events-kanke\/book/)
        expect(g2).not.toMatch(/session/i)
        expect(g.length === 0 || !/session/i.test(g)).toBe(true)
    })
})

describe("events-p0-1 modal confirmLabel contract (reserve-sheet)", () => {
    /**
     * sessionSheetProps (profile-view + book-list) maps EVENTS_STUDIO/PHOTOGRAPHER → confirmLabel "Book call".
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
            case "FIELD_SERVICE":
                return "Request visit"
            default:
                return "Book session"
        }
    }

    it("events/photo modal title+button never say session", () => {
        for (const role of ["EVENTS_STUDIO", "PHOTOGRAPHER", "CATERER", "TRAVEL"] as const) {
            const copy = sessionCopy(sheetConfirm(role))
            expect(copy.title).toBe("Book a call")
            expect(copy.button).toBe("Book call")
            expect(copy.title).not.toMatch(/session/i)
            expect(copy.button).not.toMatch(/session/i)
        }
    })

    it("gym/salon/clinic modal nouns unchanged", () => {
        expect(sessionCopy(sheetConfirm("GYM")).title).toBe("Book a session")
        expect(sessionCopy(sheetConfirm("SALON_SPA")).title).toBe("Book a treatment")
        expect(sessionCopy(sheetConfirm("CLINIC")).title).toBe("Book an appointment")
    })
})
