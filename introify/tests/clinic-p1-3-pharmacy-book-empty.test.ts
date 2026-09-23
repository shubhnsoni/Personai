import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { bookChip, guestBookEmptyCopy } from "@/lib/kit-copy"

const root = process.cwd()

describe("clinic-p1-3 pharmacy /book empty — no gym sessions chrome", () => {
    it("PHARMACY + SELL_PRODUCTS empty is medicines-honest with zero session wording", () => {
        const copy = guestBookEmptyCopy("PHARMACY", "SELL_PRODUCTS")
        expect(copy).toMatch(/medicines/i)
        expect(copy).toMatch(/MEDICINES/)
        expect(copy.toLowerCase()).not.toMatch(/session/)
        expect(copy.toLowerCase()).not.toMatch(/no sessions to book/)

        // Role alone (no goal) still pharmacy-honest
        expect(guestBookEmptyCopy("PHARMACY").toLowerCase()).not.toMatch(/session/)
        expect(guestBookEmptyCopy("PHARMACY")).toMatch(/medicines/i)
    })

    it("CLINIC empty uses appointments; GYM keeps sessions; salon keeps treatments", () => {
        expect(guestBookEmptyCopy("CLINIC", "TAKE_APPOINTMENTS")).toBe("No appointments to book.")
        expect(guestBookEmptyCopy("CLINIC", "TAKE_APPOINTMENTS").toLowerCase()).not.toMatch(/session/)
        expect(guestBookEmptyCopy("GYM", "TAKE_APPOINTMENTS")).toBe("No sessions to book.")
        expect(guestBookEmptyCopy("YOGA", "TAKE_APPOINTMENTS")).toBe("No classes to book.")
        expect(guestBookEmptyCopy("SALON_SPA", "TAKE_APPOINTMENTS")).toBe("No treatments to book.")
        expect(guestBookEmptyCopy("BARBER", "TAKE_APPOINTMENTS")).toBe("No treatments to book.")
        expect(guestBookEmptyCopy("CAFE")).toBe("Reservations are not open yet.")
    })

    it("JK bookChip stays Book an appointment (P0-1 regress)", () => {
        expect(bookChip("CLINIC")).toBe("Book an appointment")
        expect(bookChip("CLINIC")).not.toMatch(/session/i)
        expect(bookChip("GYM")).toBe("Book a session")
        expect(bookChip("SALON_SPA")).toBe("Book a treatment")
    })

    it("book page wires guestBookEmptyCopy; BookList still used for appointment kits", () => {
        const bookPage = readFileSync(join(root, "src/app/[slug]/book/page.tsx"), "utf8")
        expect(bookPage).toMatch(/guestBookEmptyCopy/)
        expect(bookPage).toMatch(/from "@\/lib\/kit-copy"/)
        expect(bookPage).toMatch(/BookList/)
        // Must not hard-code gym empty on the route anymore
        expect(bookPage).not.toMatch(/restaurant \? "Reservations are not open yet\." : "No sessions to book\."/)
        // Inline empty string must not be the only empty path (comment OK)
        const withoutComments = bookPage
            .split("\n")
            .filter((l) => !l.trim().startsWith("//"))
            .join("\n")
        expect(withoutComments).not.toMatch(/"No sessions to book\."/)
    })
})
