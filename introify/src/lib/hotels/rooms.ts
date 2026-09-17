const ROOM_PREFIX = /^(?:room|rm|r)\s*[-:]?\s*/i

export function normalizeRoomNumber(raw?: string | null): string {
    const trimmed = (raw || "").trim()
    if (!trimmed) return ""
    const stripped = trimmed.replace(ROOM_PREFIX, "").trim()
    return stripped.replace(/\s+/g, "").toUpperCase()
}

export function extractRoomNumber(text: string): string | undefined {
    const roomPhrase = text.match(/\broom\s*([a-z0-9-]{1,8})\b/i)
    if (roomPhrase?.[1]) return normalizeRoomNumber(roomPhrase[1])
    const trailing = text.match(/\b(\d{3,4}[a-z]?)\b/i)
    if (trailing?.[1]) return normalizeRoomNumber(trailing[1])
    return undefined
}
