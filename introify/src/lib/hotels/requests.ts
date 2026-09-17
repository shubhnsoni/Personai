import { DEFAULT_HOUSEKEEPING_CATALOGUE } from "./catalogue"
import { extractRoomNumber } from "./rooms"

export const HOTEL_REQUEST_STATUSES = ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "COMPLETE"] as const
export type HotelRequestStatus = (typeof HOTEL_REQUEST_STATUSES)[number]

export const HOTEL_REQUEST_TYPES = ["HOUSEKEEPING", "MAINTENANCE", "RECEPTION", "LATE_CHECKOUT", "HANDOFF"] as const
export type HotelRequestType = (typeof HOTEL_REQUEST_TYPES)[number]

export type HotelRequestItem = { sku: string; qty: number; label: string }

export type HotelGuestIntent =
    | { kind: "housekeeping"; items: HotelRequestItem[]; roomNumber?: string }
    | { kind: "wifi" }
    | { kind: "food" }
    | { kind: "reception" }
    | { kind: "late_checkout" }
    | { kind: "greeting" }
    | { kind: "unknown" }

const QTY_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, extra: 1, some: 1,
    two: 2, three: 3, four: 4, five: 5, six: 6,
}

export function nextHotelRequestStatus(current: string): HotelRequestStatus | null {
    if (current === "IN_PROGRESS") return "COMPLETE"
    const i = HOTEL_REQUEST_STATUSES.indexOf(current as HotelRequestStatus)
    if (i < 0 || i >= HOTEL_REQUEST_STATUSES.length - 1) return null
    return HOTEL_REQUEST_STATUSES[i + 1]
}

export function hotelRequestStatusLabel(status: string): string {
    if (status === "ON_THE_WAY" || status === "IN_PROGRESS") return "On the way"
    if (status === "COMPLETE") return "Delivered"
    if (status === "ACCEPTED") return "Accepted"
    if (status === "REQUESTED") return "Requested"
    return status.replace(/_/g, " ").toLowerCase()
}

export function hotelRequestAdvanceLabel(next: string): string {
    if (next === "ACCEPTED") return "Accept"
    if (next === "ON_THE_WAY" || next === "IN_PROGRESS") return "On the way"
    if (next === "COMPLETE") return "Delivered"
    return next.replace(/_/g, " ").toLowerCase()
}

function quantityBefore(text: string, index: number): number {
    const before = text.slice(Math.max(0, index - 18), index).toLowerCase()
    const word = before.match(/(\d+|one|two|three|four|five|six|a|an|extra|some)\s*$/)
    if (!word) return 1
    const raw = word[1]
    if (/^\d+$/.test(raw)) return Math.max(1, Math.min(12, Number(raw)))
    return QTY_WORDS[raw] || 1
}

function housekeepingItems(text: string): HotelRequestItem[] {
    const lower = text.toLowerCase()
    const found: HotelRequestItem[] = []
    const seen = new Set<string>()
    for (const item of DEFAULT_HOUSEKEEPING_CATALOGUE) {
        for (const alias of item.aliases) {
            const idx = lower.indexOf(alias)
            if (idx < 0) continue
            if (seen.has(item.sku)) break
            seen.add(item.sku)
            found.push({ sku: item.sku, qty: quantityBefore(lower, idx), label: item.label })
            break
        }
    }
    return found
}

export function parseHotelGuestIntent(query: string): HotelGuestIntent {
    const text = query.trim()
    const lower = text.toLowerCase()
    if (!lower) return { kind: "unknown" }
    if (/^(hi|hello|hey|namaste)\b/.test(lower) && lower.length < 24) return { kind: "greeting" }
    if (/\b(wifi|wi-fi|password|network)\b/.test(lower)) return { kind: "wifi" }
    if (/\b(late\s*check[- ]?out|checkout late)\b/.test(lower)) return { kind: "late_checkout" }
    if (/\b(talk to (reception|someone|a person|staff|human)|human|receptionist|front desk)\b/.test(lower)) {
        return { kind: "reception" }
    }
    if (/\b(restaurants?|cafes?|menu|hungry|food|eat|dinner|breakfast|lunch|room service|kitchen)\b/.test(lower)) {
        return { kind: "food" }
    }
    const items = housekeepingItems(lower)
    if (items.length) {
        return { kind: "housekeeping", items, roomNumber: extractRoomNumber(text) }
    }
    if (/\b(housekeeping|clean the room|make up)\b/.test(lower)) {
        return {
            kind: "housekeeping",
            items: [{ sku: "cleaning", qty: 1, label: "Room cleaning" }],
            roomNumber: extractRoomNumber(text),
        }
    }
    if (/^(hi|hello|hey|namaste)\b/.test(lower)) return { kind: "greeting" }
    return { kind: "unknown" }
}

export function departmentForType(type: HotelRequestType): string {
    if (type === "MAINTENANCE") return "MAINTENANCE"
    if (type === "RECEPTION" || type === "LATE_CHECKOUT" || type === "HANDOFF") return "RECEPTION"
    return "HOUSEKEEPING"
}
