export type HotelConciergeChip = {
    id: "room" | "housekeeping" | "wifi" | "food" | "reception"
    label: string
    prompt?: string
    highlighted?: boolean
}

export function hotelConciergeChips(roomNumber?: string | null): HotelConciergeChip[] {
    const room = (roomNumber || "").trim()
    if (!room) {
        return [
            { id: "housekeeping", label: "Housekeeping", prompt: "I need two towels" },
            { id: "wifi", label: "Wi-Fi", prompt: "What's the wifi password?" },
            { id: "food", label: "Food", prompt: "What restaurants can I order from?" },
            { id: "reception", label: "Reception", prompt: "Talk to reception" },
        ]
    }
    return [
        { id: "room", label: `Room ${room}`, highlighted: true },
        { id: "housekeeping", label: `Towels · ${room}`, prompt: `Two towels for room ${room}` },
        { id: "wifi", label: `Wi-Fi · ${room}`, prompt: "What's the wifi password?" },
        { id: "food", label: `Food · ${room}`, prompt: "What restaurants can I order from?" },
        { id: "reception", label: `Reception · ${room}`, prompt: "Talk to reception" },
    ]
}
