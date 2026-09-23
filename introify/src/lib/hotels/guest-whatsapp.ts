import { digitsPhone } from "@/lib/commerce"

/**
 * Guest-facing WhatsApp for stay kits.
 * Prefer Profile.whatsapp; fall back to hotelProperty.receptionWhatsapp
 * (same source chain as /book and /menu).
 */
export function resolveGuestWhatsapp(
    profileWhatsapp?: string | null,
    receptionWhatsapp?: string | null,
): string | null {
    const primary = digitsPhone(profileWhatsapp)
    if (primary) return primary
    const reception = digitsPhone(receptionWhatsapp)
    return reception || null
}

/** Explicit copy when a hotel share/home has no WA configured (never silent missing). */
export const HOTEL_SHARE_NO_WA_COPY =
    "WhatsApp is not configured for this stay. Chat reception on the guest page instead."

export const HOTEL_SHARE_CHAT_RECEPTION_LABEL = "Chat reception"

/** True when a hotel guest surface must not silently omit handoff. */
export function hotelNeedsExplicitHandoff(opts: {
    isHotel: boolean
    whatsapp?: string | null
}): boolean {
    return opts.isHotel && !digitsPhone(opts.whatsapp)
}
