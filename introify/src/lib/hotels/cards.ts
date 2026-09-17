const CARD_RE = /\[\[hotel-card:(\{[\s\S]*?\})\]\]/

export type HotelActionCard = {
    type: "request" | "restaurants" | "wifi" | "late_checkout" | "handoff" | "spa" | "transport" | "experiences" | "checkout" | "feedback" | "local_guide" | "maintenance" | "emergency" | "map" | "knowledge"
    id?: string
    status?: string
    title: string
    room?: string
    items?: string[]
    restaurants?: { name: string; slug: string }[]
    wifiName?: string
    note?: string
    href?: string
    cta?: string
    photoUrl?: string
    phones?: { label: string; href: string }[]
    marker?: { label: string; x: number; y: number; kind: string; hint?: string }
    mapImageUrl?: string
}

export function encodeHotelCard(card: HotelActionCard): string {
    return `[[hotel-card:${JSON.stringify(card)}]]`
}

export function parseHotelCard(text: string): HotelActionCard | null {
    const match = text.match(CARD_RE)
    if (!match?.[1]) return null
    try {
        const parsed = JSON.parse(match[1]) as HotelActionCard
        if (!parsed || typeof parsed.title !== "string") return null
        return parsed
    } catch {
        return null
    }
}

export function stripHotelCard(text: string): string {
    return text.replace(CARD_RE, "").trim()
}
