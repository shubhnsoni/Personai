import type { HotelGuestMenuRoom } from "./guest-menu"
import { describeHotelGuestRoom } from "./guest-menu"

/** Guest `/book` chrome label for hotel kits — never appointment "sessions". */
export const HOTEL_GUEST_BOOK_LABEL = "Book"

export const HOTEL_GUEST_BOOK_EMPTY_TITLE =
    "Reservations via reception / chat — no online inventory yet"

export const HOTEL_GUEST_BOOK_EMPTY_DETAIL =
    "This stay does not publish bookable rooms or rates online yet. Message the concierge or reception to reserve — we will not invent inventory here."

export const HOTEL_GUEST_BOOK_RATES_NOTE =
    "Rates and availability stay with reception. Ask in chat or WhatsApp — this page does not invent prices."

export const HOTEL_GUEST_BOOK_FORBIDDEN_COPY = [
    "No sessions to book",
    "No sessions to book.",
    "Book session",
    "sessions to book",
] as const

export type HotelGuestBookRoom = HotelGuestMenuRoom

export type HotelGuestBookOffering = {
    id: string
    name: string
    description?: string | null
    /** Present only when owner published a real price — never invent. */
    priceCents?: number | null
    isFree?: boolean
}

export function hotelGuestBookLabel(_role?: string | null): string {
    void _role
    return HOTEL_GUEST_BOOK_LABEL
}

export function hotelGuestBookHasInventory(input: {
    roomCount: number
    offeringCount: number
}): boolean {
    return input.roomCount + input.offeringCount > 0
}

export function hotelGuestBookEmptyCopy(input: {
    roomCount: number
    offeringCount: number
}): { title: string; detail: string } | null {
    if (hotelGuestBookHasInventory(input)) return null
    return {
        title: HOTEL_GUEST_BOOK_EMPTY_TITLE,
        detail: HOTEL_GUEST_BOOK_EMPTY_DETAIL,
    }
}

export function describeHotelGuestBookRoom(room: HotelGuestBookRoom): string {
    return describeHotelGuestRoom(room)
}

/** True when a string looks like appointment-session empty chrome (must never ship on hotel /book). */
export function hotelBookCopyLooksLikeSessions(text: string): boolean {
    const lower = text.toLowerCase()
    return (
        lower.includes("no sessions to book") ||
        /\bsessions?\s+to\s+book\b/.test(lower) ||
        /\bbook\s+session\b/.test(lower)
    )
}

/**
 * Map active service offerings onto hotel stay packages when an owner actually
 * published them. Hotels must not fall back to appointment BookList chrome.
 * TABLE / restaurant-table kinds are skipped (not hotel stay inventory).
 */
export function hotelStayOfferingsFromServices(
    services: Array<{
        id: string
        name: string
        description?: string | null
        priceCents?: number | null
        isFree?: boolean | null
        kind?: string | null
        isActive?: boolean | null
    }>,
): HotelGuestBookOffering[] {
    return services
        .filter((row) => row && row.isActive !== false)
        .filter((row) => String(row.kind || "").toUpperCase() !== "TABLE")
        .map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description ?? null,
            priceCents: typeof row.priceCents === "number" ? row.priceCents : null,
            isFree: Boolean(row.isFree),
        }))
}
