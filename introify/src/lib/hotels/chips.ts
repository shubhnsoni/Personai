import type { HotelStayPhase } from "./stay"

export type HotelConciergeChip = {
    id: "room" | "housekeeping" | "wifi" | "food" | "reception" | "spa" | "transport" | "experiences" | "checkout" | "feedback" | "maintenance" | "emergency"
    label: string
    prompt?: string
    highlighted?: boolean
}

export function hotelConciergeChips(roomNumber?: string | null, options?: { phase?: HotelStayPhase | null }): HotelConciergeChip[] {
    const room = (roomNumber || "").trim()
    const phase = options?.phase || null

    if (phase === "pre_arrival") {
        return [
            { id: "transport", label: "Airport", prompt: "Airport transfer please" },
            { id: "experiences", label: "Experiences", prompt: "What experiences can I join?" },
            { id: "food", label: "Food", prompt: "What restaurants can I order from?" },
            { id: "reception", label: "Reception", prompt: "Talk to reception" },
        ]
    }
    if (phase === "after") {
        return [
            { id: "feedback", label: "Feedback", prompt: "The stay was wonderful" },
            { id: "food", label: "Food", prompt: "What restaurants can I order from?" },
            { id: "reception", label: "Reception", prompt: "Talk to reception" },
        ]
    }
    if (phase === "checkout" && room) {
        return [
            { id: "room", label: `Room ${room}`, highlighted: true },
            { id: "checkout", label: `Checkout · ${room}`, prompt: `Ready to checkout of room ${room}` },
            { id: "transport", label: `Airport · ${room}`, prompt: `Airport transfer please for room ${room}` },
            { id: "housekeeping", label: `Towels · ${room}`, prompt: `Two towels for room ${room}` },
            { id: "reception", label: `Reception · ${room}`, prompt: "Talk to reception" },
        ]
    }
    if (!room) {
        return [
            { id: "housekeeping", label: "Housekeeping", prompt: "I need two towels" },
            { id: "wifi", label: "Wi-Fi", prompt: "What's the wifi password?" },
            { id: "food", label: "Food", prompt: "What restaurants can I order from?" },
            { id: "reception", label: "Reception", prompt: "Talk to reception" },
            { id: "emergency", label: "Emergency", prompt: "Emergency" },
        ]
    }
    return [
        { id: "room", label: `Room ${room}`, highlighted: true },
        { id: "housekeeping", label: `Towels · ${room}`, prompt: `Two towels for room ${room}` },
        { id: "maintenance", label: `Fix · ${room}`, prompt: `AC is broken in room ${room}` },
        { id: "wifi", label: `Wi-Fi · ${room}`, prompt: "What's the wifi password?" },
        { id: "food", label: `Food · ${room}`, prompt: "What restaurants can I order from?" },
        { id: "spa", label: `Spa · ${room}`, prompt: `I'd like a spa massage for room ${room}` },
        { id: "transport", label: `Airport · ${room}`, prompt: `Airport transfer please for room ${room}` },
        { id: "experiences", label: `Experiences · ${room}`, prompt: "What experiences can I join?" },
        { id: "reception", label: `Reception · ${room}`, prompt: "Talk to reception" },
        { id: "emergency", label: "Emergency", prompt: "Emergency" },
    ]
}

/** Composer suggested replies. Room is stay context, not an action chip. */
export function hotelSuggestedReplies(roomNumber?: string | null, options?: { phase?: HotelStayPhase | null }): HotelConciergeChip[] {
    return hotelConciergeChips(roomNumber, options)
        .filter((chip) => Boolean(chip.prompt))
        .map((chip) => ({
            ...chip,
            label: chip.label.replace(/\s·\s.+$/, ""),
        }))
}
