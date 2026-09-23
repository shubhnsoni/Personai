import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    CREATOR_GUEST_BOOK_EMPTY_TITLE,
    CREATOR_GUEST_BOOK_FORBIDDEN_COPY,
    CREATOR_GUEST_BOOK_LABEL,
    creatorBookCopyLooksLikeSessions,
    creatorGuestBookEmptyCopy,
    isCreatorLeadBookSurface,
    shouldUseCreatorLeadBookEmpty,
} from "@/lib/creator/guest-book"

const root = process.cwd()

describe("CREATOR P1-2 guest /book lead surface helpers", () => {
    it("treats CREATOR + COLLECT_LEADS as lead book surface; CONSULTANT/CA alone false", () => {
        expect(isCreatorLeadBookSurface("CREATOR")).toBe(true)
        expect(isCreatorLeadBookSurface("NGO")).toBe(true) // alias → CREATOR
        expect(isCreatorLeadBookSurface("CREATOR", "COLLECT_LEADS")).toBe(true)
        expect(isCreatorLeadBookSurface("SHOP", "COLLECT_LEADS")).toBe(true)
        expect(isCreatorLeadBookSurface("DESIGNER", "COLLECT_LEADS")).toBe(true)
        expect(isCreatorLeadBookSurface("CONSULTANT")).toBe(false)
        expect(isCreatorLeadBookSurface("CONSULTANT", "TAKE_APPOINTMENTS")).toBe(false)
        expect(isCreatorLeadBookSurface("CA")).toBe(false)
        expect(isCreatorLeadBookSurface("DESIGNER")).toBe(false)
        expect(isCreatorLeadBookSurface("DESIGNER", "SHOW_PORTFOLIO")).toBe(false)
        expect(isCreatorLeadBookSurface("HOTEL")).toBe(false)
        expect(CREATOR_GUEST_BOOK_LABEL).toBe("Contact")
        expect(CREATOR_GUEST_BOOK_EMPTY_TITLE.toLowerCase()).not.toMatch(/session/)
    })

    it("uses lead empty only when offeringCount is 0", () => {
        expect(
            shouldUseCreatorLeadBookEmpty({
                role: "CREATOR",
                primaryGoal: "COLLECT_LEADS",
                offeringCount: 0,
            }),
        ).toBe(true)
        expect(
            shouldUseCreatorLeadBookEmpty({
                role: "CREATOR",
                primaryGoal: "COLLECT_LEADS",
                offeringCount: 2,
            }),
        ).toBe(false)
        expect(
            shouldUseCreatorLeadBookEmpty({
                role: "CONSULTANT",
                primaryGoal: "TAKE_APPOINTMENTS",
                offeringCount: 0,
            }),
        ).toBe(false)
        expect(
            shouldUseCreatorLeadBookEmpty({
                role: "CONSULTANT",
                primaryGoal: "TAKE_APPOINTMENTS",
                offeringCount: 3,
            }),
        ).toBe(false)
        expect(
            shouldUseCreatorLeadBookEmpty({
                role: "DESIGNER",
                primaryGoal: "SHOW_PORTFOLIO",
                offeringCount: 0,
            }),
        ).toBe(false)
    })

    it("detects forbidden sessions copy and keeps lead empty honest", () => {
        for (const bad of CREATOR_GUEST_BOOK_FORBIDDEN_COPY) {
            expect(creatorBookCopyLooksLikeSessions(bad)).toBe(true)
        }
        expect(creatorBookCopyLooksLikeSessions(CREATOR_GUEST_BOOK_EMPTY_TITLE)).toBe(false)
        expect(creatorBookCopyLooksLikeSessions("Get in touch via WhatsApp")).toBe(false)

        const copy = creatorGuestBookEmptyCopy({ displayName: "Aria Bloom", whatsapp: true })
        expect(copy.title).toBe(CREATOR_GUEST_BOOK_EMPTY_TITLE)
        expect(copy.detail.toLowerCase()).not.toMatch(/session/)
        expect(copy.chatLabel).toMatch(/Chat with Aria/)
        expect(copy.waLabel).toMatch(/WhatsApp/i)
        expect(JSON.stringify(copy).toLowerCase()).not.toMatch(/no sessions to book/)
    })
})

describe("CREATOR P1-2 book route wiring", () => {
    it("branches lead empty kits to CreatorGuestBook; keeps non-lead sessions empty", () => {
        const bookPage = readFileSync(join(root, "src/app/[slug]/book/page.tsx"), "utf8")
        expect(bookPage).toMatch(/shouldUseCreatorLeadBookEmpty/)
        expect(bookPage).toMatch(/CreatorGuestBook/)
        expect(bookPage).toMatch(/isHotelRole/)
        expect(bookPage).toMatch(/HotelGuestBook|HotelBookPage/)
        // Non-lead empty uses role-aware kit-copy helper (gym sessions default lives there)
        expect(bookPage).toMatch(/guestBookEmptyCopy/)
        expect(bookPage).toMatch(/BookList/)

        const surface = readFileSync(join(root, "src/components/creator/creator-guest-book.tsx"), "utf8")
        expect(surface).toMatch(/data-creator-guest-book/)
        expect(surface).toMatch(/CREATOR_GUEST_BOOK_LABEL|Contact/)
        expect(surface).toMatch(/max-w-5xl/)
        expect(surface).toMatch(/whatsappHref/)
        expect(surface).not.toMatch(/No sessions to book/)
        expect(surface).not.toMatch(/BookList/)
        expect(surface.toLowerCase()).not.toMatch(/no sessions/)
        // Desktop catalog shell — do not introduce phone-shell-only max-w-lg layouts.
        expect(surface.includes("max-w-lg") && !surface.includes("max-w-5xl")).toBe(false)
        // Surface chrome must not ship the word "sessions"
        expect(surface.toLowerCase()).not.toMatch(/sessions/)

        const helpers = readFileSync(join(root, "src/lib/creator/guest-book.ts"), "utf8")
        expect(helpers).toMatch(/CREATOR_GUEST_BOOK_EMPTY_TITLE/)
        expect(helpers).toMatch(/CREATOR_GUEST_BOOK_FORBIDDEN_COPY/)
        expect(helpers).toMatch(/resolveKitRole/)
        expect(CREATOR_GUEST_BOOK_EMPTY_TITLE.toLowerCase()).not.toMatch(/session/)
    })
})
