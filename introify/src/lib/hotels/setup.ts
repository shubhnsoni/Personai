export type HotelSetupItem = {
    id: "rooms" | "restaurants" | "services" | "qrs" | "live"
    ok: boolean
    label: string
    href: string
}

export function hotelSetupChecklist(input: {
    rooms: number
    restaurants: number
    services: readonly string[]
    qrs: number
    isPublic: boolean
    liveHref: string
}): HotelSetupItem[] {
    const roomsOk = input.rooms > 0
    const qrsOk = input.qrs > 0
    return [
        { id: "rooms", ok: roomsOk, label: "Rooms connected", href: "/dashboard/rooms" },
        { id: "restaurants", ok: input.restaurants > 0, label: "Restaurants connected", href: "/dashboard/restaurants" },
        { id: "services", ok: input.services.length > 0, label: "Hotel services", href: "/dashboard" },
        { id: "qrs", ok: qrsOk, label: "Room QRs", href: "/dashboard/qr" },
        {
            id: "live",
            ok: input.isPublic && roomsOk && qrsOk,
            label: "Guest concierge ready",
            href: input.liveHref,
        },
    ]
}

export function hotelConciergeIsLive(items: readonly { ok: boolean }[]): boolean {
    return items.length > 0 && items.every((row) => row.ok)
}
