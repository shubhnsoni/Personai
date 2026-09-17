export const HOTEL_INTEGRATION_ADAPTERS = [
    { id: "pms", label: "PMS stay sync", status: "stub" as const, summary: "Pull stays later. No vendor account in this slice." },
    { id: "pos", label: "POS", status: "stub" as const, summary: "Room charges stay on the hotel POS. Introify does not take a card here." },
    { id: "whatsapp", label: "WhatsApp", status: "stub" as const, summary: "Guest WhatsApp later. Interface only — no Business API credentials." },
    { id: "webhook", label: "Webhook", status: "placeholder" as const, summary: "HTTPS callback for request events. Optional. No live keys." },
] as const

export type HotelIntegrationStatus = {
    pms: "stub"
    pos: "stub"
    whatsapp: "stub"
    webhook: "placeholder"
}

const DEFAULT_STATUS: HotelIntegrationStatus = {
    pms: "stub",
    pos: "stub",
    whatsapp: "stub",
    webhook: "placeholder",
}

const SECRETISH = /secret|token|password|api[_-]?key|sk_live|bearer|mews\.com|oracle.?opera|clock.?pms/i

export function parseHotelIntegrations(_raw?: string | null): HotelIntegrationStatus {
    return { ...DEFAULT_STATUS }
}

export function hotelWebhookReady(url?: string | null): { ready: boolean; reason: string } {
    const value = url?.trim() || ""
    if (!value) return { ready: false, reason: "not_configured" }
    if (SECRETISH.test(value)) return { ready: false, reason: "refused_secret" }
    try {
        const parsed = new URL(value)
        if (parsed.protocol !== "https:") return { ready: false, reason: "https_only" }
        return { ready: true, reason: "placeholder" }
    } catch {
        return { ready: false, reason: "invalid_url" }
    }
}

export type PmsStay = {
    confirmation: string
    guestName: string
    roomNumber: string | null
    arrival: string | null
    departure: string | null
}

export interface PmsStaySync {
    pullStays(hotelProfileId: string): Promise<PmsStay[]>
}

export interface PosAdapter {
    postCharge(input: { hotelProfileId: string; roomNumber: string; amountCents: number }): Promise<{ ok: false; reason: string }>
}

export interface WhatsAppAdapter {
    send(input: { to: string; text: string }): Promise<{ ok: false; reason: string; stub: true }>
}

export const stubPms: PmsStaySync = {
    async pullStays() {
        return []
    },
}

export const stubPos: PosAdapter = {
    async postCharge() {
        return { ok: false, reason: "pos_stub" }
    },
}

export const stubWhatsApp: WhatsAppAdapter = {
    async send() {
        return { ok: false, reason: "interface-only", stub: true }
    },
}
