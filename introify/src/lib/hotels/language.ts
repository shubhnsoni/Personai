import { DEFAULT_MAINTENANCE_CATALOGUE } from "./catalogue"

export type HotelGuestLanguage = "en" | "hi"

export function detectGuestLanguage(text: string): HotelGuestLanguage {
    if (/[\u0900-\u097F]/.test(text)) return "hi"
    if (/\b(nahi|nahin|madad|kripya|kripiya|dhanyavad|chal raha|ac nahi|theek|shikayat)\b/i.test(text)) return "hi"
    return "en"
}

export function staffNoteFromGuest(
    guestText: string,
    intent: { kind: string; sku?: string },
    staffLanguage = "en",
): string {
    const guestLanguage = detectGuestLanguage(guestText)
    const sku = intent.sku
    const maintenance = sku ? DEFAULT_MAINTENANCE_CATALOGUE.find((row) => row.sku === sku) : undefined
    const label = maintenance?.label || intent.kind.replace(/_/g, " ")
    const english = `${label} — original: "${guestText.trim().slice(0, 240)}"`
    if (staffLanguage === "en" && guestLanguage !== "en") return `[Guest ${guestLanguage}] ${english}`
    if (guestLanguage !== staffLanguage) return `[Guest ${guestLanguage}] ${english}`
    return english
}

export function guestMaintenanceCopy(lang: HotelGuestLanguage, label: string, room?: string) {
    if (lang === "hi") {
        return `${label}${room ? ` room ${room}` : ""} की शिकायत दर्ज हो गई है। यह एक request है, billed नहीं। Photo भेज सकते हो।`
    }
    const roomBit = room ? ` for room ${room}` : ""
    return `I’ll file ${label.toLowerCase()}${roomBit} as a maintenance request. You can add a photo. This chat does not charge a fee.`
}

export function guestEmergencyCopy(lang: HotelGuestLanguage) {
    if (lang === "hi") {
        return "अभी reception या emergency number पर call करें। यह ordinary ticket नहीं है — wait न करें, call now."
    }
    return "Call reception or the emergency number now. This is not an ordinary ticket — do not wait on chat."
}
