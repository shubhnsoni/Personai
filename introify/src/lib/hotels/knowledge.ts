export const HOTEL_KNOWLEDGE_BUCKETS = [
    "PROPERTY",
    "ROOMS",
    "POLICIES",
    "AMENITIES",
    "FOOD",
    "SPA",
    "ACTIVITIES",
    "TRANSPORT",
    "NEARBY",
    "EMERGENCY",
    "INTERNAL",
] as const

export type HotelKnowledgeBucket = (typeof HOTEL_KNOWLEDGE_BUCKETS)[number]

export type HotelKnowledgeDoc = {
    bucket: HotelKnowledgeBucket
    title: string
    body: string
    guestVisible: boolean
    aliases: string[]
}

export type HotelMapMarker = {
    id: string
    kind: string
    label: string
    x: number
    y: number
    hint: string
    aliases: string[]
}

export const DEFAULT_HOTEL_KNOWLEDGE: HotelKnowledgeDoc[] = [
    {
        bucket: "PROPERTY",
        title: "Hours",
        body: "Reception 00:00–23:59. Check-in 14:00. Checkout 11:00.",
        guestVisible: true,
        aliases: ["hours", "reception hours", "check-in", "checkout time", "property hours"],
    },
    {
        bucket: "ROOMS",
        title: "Rooms",
        body: "28 rooms. Room QR on the nightstand already knows the number.",
        guestVisible: true,
        aliases: ["rooms", "room qr", "nightstand"],
    },
    {
        bucket: "POLICIES",
        title: "Quiet hours",
        body: "Quiet hours 22:00–07:00. Keep corridors calm.",
        guestVisible: true,
        aliases: ["quiet hours", "noise", "policy", "policies"],
    },
    {
        bucket: "AMENITIES",
        title: "Wi-Fi",
        body: "Network haven-guest on every floor. Ask the concierge for the password.",
        guestVisible: true,
        aliases: ["amenities", "wifi", "wi-fi", "gym", "pool hours"],
    },
    {
        bucket: "FOOD",
        title: "Food",
        body: "Meals sit on the connected Introify kitchen — Little Hours Café. We do not copy that menu here.",
        guestVisible: true,
        aliases: ["food", "breakfast", "restaurant", "kitchen"],
    },
    {
        bucket: "SPA",
        title: "Spa",
        body: "Spa is on the lobby level, left of reception. Treatments are a request, not a billed booking.",
        guestVisible: true,
        aliases: ["spa hours", "massage desk"],
    },
    {
        bucket: "ACTIVITIES",
        title: "Activities",
        body: "Hotel-curated: Hinoo evening walk, Ranchi lake morning, Jagannath temple visit.",
        guestVisible: true,
        aliases: ["activities", "experiences", "walk"],
    },
    {
        bucket: "TRANSPORT",
        title: "Transport",
        body: "Airport transfer, taxi, or scooter as a request. This chat does not charge a ride.",
        guestVisible: true,
        aliases: ["transport", "airport", "taxi"],
    },
    {
        bucket: "NEARBY",
        title: "Nearby",
        body: "Hinoo Main Road, Ranchi. Ask for the hotel-curated list — we will not invent a place.",
        guestVisible: true,
        aliases: ["nearby", "local", "around"],
    },
    {
        bucket: "EMERGENCY",
        title: "Emergency",
        body: "Call reception first. Local emergency is 112. This is not a ticket you wait on.",
        guestVisible: true,
        aliases: ["emergency number", "112", "fire", "medical"],
    },
    {
        bucket: "INTERNAL",
        title: "Night audit",
        body: "Night audit at 23:00. Do not share the audit password with guests.",
        guestVisible: false,
        aliases: ["night audit", "audit password", "staff notes"],
    },
]

export const DEFAULT_HOTEL_MAP_MARKERS: HotelMapMarker[] = [
    { id: "reception", kind: "reception", label: "Reception", x: 50, y: 12, hint: "Ground-floor desk", aliases: ["reception", "front desk", "lobby desk"] },
    { id: "spa", kind: "spa", label: "Spa", x: 22, y: 48, hint: "Lobby level, left of reception", aliases: ["spa", "massage"] },
    { id: "pool", kind: "pool", label: "Pool", x: 78, y: 40, hint: "Rear courtyard", aliases: ["pool", "swimming"] },
    { id: "restaurant", kind: "restaurant", label: "Little Hours Café", x: 50, y: 82, hint: "Next door — connected kitchen", aliases: ["restaurant", "cafe", "café", "little hours"] },
]

export function guestVisibleKnowledge(docs: HotelKnowledgeDoc[]) {
    return docs.filter((row) => row.guestVisible && row.bucket !== "INTERNAL")
}

function scoreHit(query: string, aliases: string[], title: string, extra = "") {
    const lower = query.toLowerCase()
    let best = 0
    for (const alias of aliases) {
        if (lower.includes(alias.toLowerCase())) best = Math.max(best, alias.length)
    }
    if (title && lower.includes(title.toLowerCase())) best = Math.max(best, title.length)
    if (extra && lower.includes(extra.toLowerCase())) best = Math.max(best, Math.min(extra.length, 24))
    return best
}

export function lookupHotelKnowledge(
    docs: HotelKnowledgeDoc[],
    query: string,
    options?: { guest?: boolean },
): HotelKnowledgeDoc | null {
    const pool = options?.guest ? guestVisibleKnowledge(docs) : docs
    let best: { row: HotelKnowledgeDoc; score: number } | undefined
    for (const row of pool) {
        const score = scoreHit(query, row.aliases, row.title, row.body.slice(0, 80))
        if (score <= 0) continue
        if (!best || score > best.score) best = { row, score }
    }
    return best?.row || null
}

export function findMapMarker(markers: HotelMapMarker[], query: string): HotelMapMarker | null {
    let best: { row: HotelMapMarker; score: number } | undefined
    for (const row of markers) {
        const score = scoreHit(query, [...row.aliases, row.kind, row.label], row.label)
        if (score <= 0) continue
        if (!best || score > best.score) best = { row, score }
    }
    return best?.row || null
}

export function parseHotelKnowledgeJson(raw: string | null | undefined): HotelKnowledgeDoc[] {
    try {
        const value = JSON.parse(raw || "[]")
        if (!Array.isArray(value)) return []
        return value.filter((row) => row && typeof row.bucket === "string" && typeof row.title === "string" && typeof row.body === "string") as HotelKnowledgeDoc[]
    } catch {
        return []
    }
}

export function parseHotelMapMarkers(raw: string | null | undefined): HotelMapMarker[] {
    try {
        const value = JSON.parse(raw || "[]")
        if (!Array.isArray(value)) return []
        return value
            .filter((row) => row && typeof row.id === "string" && typeof row.label === "string")
            .map((row) => ({
                id: String(row.id),
                kind: String(row.kind || row.label),
                label: String(row.label),
                x: Number(row.x) || 0,
                y: Number(row.y) || 0,
                hint: String(row.hint || ""),
                aliases: Array.isArray(row.aliases) ? row.aliases.filter((item: unknown) => typeof item === "string") : [String(row.label), String(row.kind || "")],
            }))
    } catch {
        return []
    }
}
