import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    describeHotelGuestBookRoom,
    hotelBookCopyLooksLikeSessions,
    hotelGuestBookEmptyCopy,
    hotelGuestBookHasInventory,
    hotelStayOfferingsFromServices,
    HOTEL_GUEST_BOOK_EMPTY_TITLE,
    HOTEL_GUEST_BOOK_FORBIDDEN_COPY,
    HOTEL_GUEST_BOOK_LABEL,
    HOTEL_GUEST_BOOK_RATES_NOTE,
} from "@/lib/hotels/guest-book"
import { isHotelRole } from "@/lib/hotels"
import { isRestaurant } from "@/lib/menu"

const root = process.cwd()

describe("HOTEL P1-1 guest /book surface helpers", () => {
    it("labels hotel kits Book and never appointment sessions empty", () => {
        expect(HOTEL_GUEST_BOOK_LABEL).toBe("Book")
        expect(isHotelRole("HOTEL")).toBe(true)
        expect(isHotelRole("RESORT")).toBe(true)
        expect(isHotelRole("SERVICED_APARTMENT")).toBe(true)
        expect(isRestaurant("HOTEL")).toBe(false)
        expect(HOTEL_GUEST_BOOK_EMPTY_TITLE).toMatch(/reception|chat/i)
        expect(HOTEL_GUEST_BOOK_EMPTY_TITLE.toLowerCase()).not.toMatch(/session/)
        expect(HOTEL_GUEST_BOOK_RATES_NOTE.toLowerCase()).not.toMatch(/session/)
        for (const bad of HOTEL_GUEST_BOOK_FORBIDDEN_COPY) {
            expect(hotelBookCopyLooksLikeSessions(bad)).toBe(true)
        }
        expect(hotelBookCopyLooksLikeSessions(HOTEL_GUEST_BOOK_EMPTY_TITLE)).toBe(false)
    })

    it("chooses honest empty only when no rooms and no published stay offerings", () => {
        expect(hotelGuestBookHasInventory({ roomCount: 3, offeringCount: 0 })).toBe(true)
        expect(hotelGuestBookHasInventory({ roomCount: 0, offeringCount: 1 })).toBe(true)
        expect(hotelGuestBookHasInventory({ roomCount: 0, offeringCount: 0 })).toBe(false)
        const empty = hotelGuestBookEmptyCopy({ roomCount: 0, offeringCount: 0 })
        expect(empty?.title).toBe(HOTEL_GUEST_BOOK_EMPTY_TITLE)
        expect(empty?.detail.toLowerCase()).not.toMatch(/session/)
        expect(hotelGuestBookEmptyCopy({ roomCount: 2, offeringCount: 0 })).toBeNull()
        expect(describeHotelGuestBookRoom({ number: "101", floor: "1", category: "Deluxe" })).toBe(
            "Deluxe · Floor 1",
        )
    })

    it("maps published services to stay offerings without TABLE kinds or invented rates", () => {
        const rows = hotelStayOfferingsFromServices([
            {
                id: "a",
                name: "Weekend stay",
                description: "Two nights",
                priceCents: 450000,
                isFree: false,
                kind: "SESSION",
                isActive: true,
            },
            {
                id: "t",
                name: "Table",
                priceCents: 0,
                kind: "TABLE",
                isActive: true,
            },
            {
                id: "b",
                name: "Day use",
                priceCents: null,
                kind: null,
                isActive: true,
            },
        ])
        expect(rows.map((r) => r.id)).toEqual(["a", "b"])
        expect(rows[0].priceCents).toBe(450000)
        expect(rows[1].priceCents).toBeNull()
    })
})

describe("HOTEL P1-1 book route wiring", () => {
    it("branches hotel kits off appointment BookList / sessions empty", () => {
        const bookPage = readFileSync(join(root, "src/app/[slug]/book/page.tsx"), "utf8")
        expect(bookPage).toMatch(/isHotelRole/)
        expect(bookPage).toMatch(/HotelGuestBook|HotelBookPage/)
        expect(bookPage).toMatch(/resolveHotelBrandLogo/)
        expect(bookPage).toMatch(/hotelStayOfferingsFromServices/)
        // Non-hotel empty uses role-aware kit-copy helper (gym sessions default lives there)
        expect(bookPage).toMatch(/guestBookEmptyCopy/)

        const surface = readFileSync(join(root, "src/components/hotel/hotel-guest-book.tsx"), "utf8")
        expect(surface).toMatch(/HOTEL_GUEST_BOOK_LABEL|Book/)
        expect(surface).toMatch(/Chat with concierge/)
        expect(surface).toMatch(/HOTEL_GUEST_BOOK_EMPTY_TITLE|Reservations via reception/)
        expect(surface).toMatch(/data-hotel-guest-book/)
        expect(surface).not.toMatch(/No sessions to book/)
        expect(surface).not.toMatch(/BookList/)
        expect(surface).not.toMatch(/Book session/)
        expect(surface.toLowerCase()).not.toMatch(/no sessions/)

        const helpers = readFileSync(join(root, "src/lib/hotels/guest-book.ts"), "utf8")
        expect(helpers).toMatch(/HOTEL_GUEST_BOOK_EMPTY_TITLE/)
        expect(helpers).toMatch(/HOTEL_GUEST_BOOK_FORBIDDEN_COPY/)
        // Forbidden list may mention "sessions" for the detector; empty title must not.
        expect(HOTEL_GUEST_BOOK_EMPTY_TITLE.toLowerCase()).not.toMatch(/session/)
    })

    it("leaves non-hotel BookList session chrome intact for salon/clinic paths", () => {
        const bookList = readFileSync(join(root, "src/app/[slug]/book/book-list.tsx"), "utf8")
        expect(bookList).toMatch(/Book session/)
        expect(bookList).toMatch(/mode="session"/)
        expect(bookList).not.toMatch(/HotelGuestBook/)
    })
})
