import { hotelQrPath, hotelRoomPath } from "./paths"

export function hotelHidesIntroifyChrome(input: {
    entitled: boolean
    hotelWhiteLabel: boolean
    personalityConfig?: string | null
}): boolean {
    if (!input.entitled) return false
    if (input.hotelWhiteLabel) return true
    try {
        return JSON.parse(input.personalityConfig || "{}").hideIntroifyBrand === true
    } catch {
        return false
    }
}

/** Guest QR and room URLs stay the same when white-label chrome is hidden. */
export function hotelGuestPathsUnchanged() {
    return {
        room: hotelRoomPath("try-hotel", "101"),
        qr: hotelQrPath("hRoom101"),
    }
}
