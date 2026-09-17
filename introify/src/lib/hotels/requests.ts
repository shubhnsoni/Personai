import {
    DEFAULT_HOTEL_EXPERIENCES,
    DEFAULT_HOUSEKEEPING_CATALOGUE,
    DEFAULT_MAINTENANCE_CATALOGUE,
    DEFAULT_SPA_CATALOGUE,
    DEFAULT_TRANSPORT_OPTIONS,
} from "./catalogue"
import { extractRoomNumber } from "./rooms"
import { stayFeedbackTone } from "./stay"

export const HOTEL_REQUEST_STATUSES = ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "COMPLETE"] as const
export type HotelRequestStatus = (typeof HOTEL_REQUEST_STATUSES)[number]

export const HOTEL_REQUEST_TYPES = [
    "HOUSEKEEPING",
    "MAINTENANCE",
    "RECEPTION",
    "LATE_CHECKOUT",
    "HANDOFF",
    "SPA",
    "TRANSPORT",
    "EXPERIENCE",
    "CHECKOUT",
    "FEEDBACK",
    "EMERGENCY",
] as const
export type HotelRequestType = (typeof HOTEL_REQUEST_TYPES)[number]

export const HOTEL_REQUEST_DESKS = ["HOUSEKEEPING", "SPA", "TRANSPORT", "EXPERIENCES", "RECEPTION", "MAINTENANCE", "SECURITY"] as const

export type HotelRequestItem = { sku: string; qty: number; label: string }

export type HotelGuestIntent =
    | { kind: "housekeeping"; items: HotelRequestItem[]; roomNumber?: string }
    | { kind: "wifi" }
    | { kind: "food" }
    | { kind: "reception" }
    | { kind: "late_checkout" }
    | { kind: "spa"; sku: string; roomNumber?: string }
    | { kind: "transport"; sku: string; roomNumber?: string }
    | { kind: "experience"; sku: string; roomNumber?: string }
    | { kind: "experiences" }
    | { kind: "local_guide" }
    | { kind: "checkout"; roomNumber?: string }
    | { kind: "feedback" }
    | { kind: "maintenance"; sku: string; roomNumber?: string }
    | { kind: "emergency" }
    | { kind: "map"; query: string }
    | { kind: "knowledge"; query: string }
    | { kind: "greeting" }
    | { kind: "unknown" }

const QTY_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, extra: 1, some: 1,
    two: 2, three: 3, four: 4, five: 5, six: 6,
}

const SCHEDULED_TYPES = new Set(["SPA", "EXPERIENCE"])
const DONE_TYPES = new Set(["SPA", "EXPERIENCE", "TRANSPORT", "CHECKOUT", "FEEDBACK"])

export function nextHotelRequestStatus(current: string): HotelRequestStatus | null {
    if (current === "IN_PROGRESS") return "COMPLETE"
    const i = HOTEL_REQUEST_STATUSES.indexOf(current as HotelRequestStatus)
    if (i < 0 || i >= HOTEL_REQUEST_STATUSES.length - 1) return null
    return HOTEL_REQUEST_STATUSES[i + 1]
}

export function hotelRequestStatusLabel(status: string, type?: string): string {
    if (type === "EMERGENCY") {
        if (status === "ACCEPTED") return "Acknowledged"
        if (status === "ON_THE_WAY" || status === "IN_PROGRESS") return "Attending"
        if (status === "COMPLETE") return "Closed"
        if (status === "REQUESTED") return "Alerted"
    }
    const scheduled = type && SCHEDULED_TYPES.has(type)
    if (status === "ON_THE_WAY" || status === "IN_PROGRESS") return scheduled ? "Scheduled" : "On the way"
    if (status === "COMPLETE") return type && DONE_TYPES.has(type) ? "Done" : "Delivered"
    if (status === "ACCEPTED") return "Accepted"
    if (status === "REQUESTED") return "Requested"
    return status.replace(/_/g, " ").toLowerCase()
}

export function hotelRequestAdvanceLabel(next: string, type?: string): string {
    if (type === "EMERGENCY") {
        if (next === "ACCEPTED") return "Acknowledge"
        if (next === "ON_THE_WAY" || next === "IN_PROGRESS") return "Attending"
        if (next === "COMPLETE") return "Closed"
    }
    if (next === "ACCEPTED") return "Accept"
    if (next === "ON_THE_WAY" || next === "IN_PROGRESS") {
        return type && SCHEDULED_TYPES.has(type) ? "Scheduled" : "On the way"
    }
    if (next === "COMPLETE") return type && DONE_TYPES.has(type) ? "Done" : "Delivered"
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

function wifiIsBroken(lower: string) {
    return /\b((wifi|wi-fi|internet).{0,24}(down|not working|broken|dead|off)|no (wifi|wi-fi|internet))\b/.test(lower)
}

function escapeRe(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function matchSkuBounded<T extends { sku: string; aliases: string[] }>(text: string, catalog: T[]): T | undefined {
    let best: { item: T; alias: string } | undefined
    for (const item of catalog) {
        for (const alias of item.aliases) {
            if (!new RegExp(`\\b${escapeRe(alias)}\\b`, "i").test(text)) continue
            if (!best || alias.length > best.alias.length) best = { item, alias }
        }
    }
    return best?.item
}

function matchMaintenance(lower: string) {
    if (wifiIsBroken(lower)) return DEFAULT_MAINTENANCE_CATALOGUE.find((row) => row.sku === "wifi")
    return matchSkuBounded(lower, DEFAULT_MAINTENANCE_CATALOGUE)
}

function isEmergency(lower: string) {
    return /\b(emergency|ambulance|i'?m hurt|im hurt|need a doctor|medical emergency)\b/.test(lower)
        || /\b(fire|smoke) (in|at|on)\b/.test(lower)
        || /\bthere'?s a fire\b/.test(lower)
}

function isLocationAsk(lower: string) {
    return /\b(where'?s|where is|how do i get to|on the map)\b/.test(lower)
}

function matchSku<T extends { sku: string; aliases: string[] }>(text: string, catalog: T[]): T | undefined {
    let best: { item: T; alias: string } | undefined
    for (const item of catalog) {
        for (const alias of item.aliases) {
            if (!text.includes(alias)) continue
            if (!best || alias.length > best.alias.length) best = { item, alias }
        }
    }
    return best?.item
}

export function parseHotelGuestIntent(query: string): HotelGuestIntent {
    const text = query.trim()
    const lower = text.toLowerCase()
    if (!lower) return { kind: "unknown" }
    if (/^(hi|hello|hey|namaste)\b/.test(lower) && lower.length < 24) return { kind: "greeting" }
    if (isEmergency(lower)) return { kind: "emergency" }
    if (isLocationAsk(lower)) return { kind: "map", query: text }
    const maintenance = matchMaintenance(lower)
    if (maintenance) {
        return { kind: "maintenance", sku: maintenance.sku, roomNumber: extractRoomNumber(text) }
    }
    if (/\b(quiet hours|parking|property hours|policies)\b/.test(lower)) return { kind: "knowledge", query: text }
    if (/\b(wifi|wi-fi|password|network)\b/.test(lower)) return { kind: "wifi" }
    if (/\b(late\s*check[- ]?out|checkout late)\b/.test(lower)) return { kind: "late_checkout" }
    if (/\b(check(?:ing)?\s*out|ready to (?:check\s*out|leave))\b/.test(lower)) {
        return { kind: "checkout", roomNumber: extractRoomNumber(text) }
    }
    if (/\b(talk to (reception|someone|a person|staff|human)|human|receptionist|front desk)\b/.test(lower)) {
        return { kind: "reception" }
    }
    if (/\b(spa|massage|hot stone|steam)\b/.test(lower)) {
        const match = matchSku(lower, DEFAULT_SPA_CATALOGUE)
        return { kind: "spa", sku: match?.sku || "massage", roomNumber: extractRoomNumber(text) }
    }
    if (/\b(airport|taxi|cab|scooter|transfer)\b/.test(lower)) {
        const match = matchSku(lower, DEFAULT_TRANSPORT_OPTIONS)
        return { kind: "transport", sku: match?.sku || "taxi", roomNumber: extractRoomNumber(text) }
    }
    const experience = matchSku(lower, DEFAULT_HOTEL_EXPERIENCES)
    if (experience && !/\b(nearby|local guide|things to do)\b/.test(lower)) {
        return { kind: "experience", sku: experience.sku, roomNumber: extractRoomNumber(text) }
    }
    if (/\b(experiences?|activities|tours?)\b/.test(lower)) return { kind: "experiences" }
    if (/\b(local guide|what'?s nearby|things to do|nearby)\b/.test(lower)) return { kind: "local_guide" }
    if (/\b(feedback|google review|leave a review)\b/.test(lower) || (/\bstay\b/.test(lower) && stayFeedbackTone(lower) !== "neutral")) {
        return { kind: "feedback" }
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
    if (type === "EMERGENCY") return "SECURITY"
    if (type === "SPA") return "SPA"
    if (type === "TRANSPORT") return "TRANSPORT"
    if (type === "EXPERIENCE") return "EXPERIENCES"
    if (type === "RECEPTION" || type === "LATE_CHECKOUT" || type === "HANDOFF" || type === "CHECKOUT" || type === "FEEDBACK") {
        return "RECEPTION"
    }
    return "HOUSEKEEPING"
}

export function catalogRequestItem(input: { sku: string; label: string; durationMinutes?: number }): HotelRequestItem {
    return {
        sku: input.sku,
        qty: 1,
        label: input.durationMinutes ? `${input.label} (${input.durationMinutes} min)` : input.label,
    }
}
