import { isHotelRole } from "@/lib/hotels"
import { isRestaurant } from "@/lib/menu"
import { resolveKitRole } from "@/lib/role-alias"

/** Legacy lying teaser — must never appear on HOTEL/RESORT/SERVICED_APARTMENT guest /print. */
export const HOTEL_DEFERRED_KIT_TEASER =
    "Prefer the downloadable hotel print package? Use Dashboard → QR & Print when this page is a hotel kit."

/**
 * Footer hint under guest /print for non-food kits.
 * Food kits use their own menu/table chrome and return null.
 * Hotel kits (HOTEL P1-2): return null — the page is already a hotel kit; do not defer
 * guests to Dashboard with “when this page is a hotel kit.” Room/property tents live on the sheet.
 * Shops/other kits get role-aware or neutral counter/QR language (never hotel leakage).
 */
export function guestPrintFooterHint(role?: string | null): string | null {
    if (isRestaurant(role)) return null
    if (isHotelRole(role)) return null
    const kit = resolveKitRole(role)
    if (
        kit === "SHOP" ||
        kit === "JEWELRY_RETAIL" ||
        kit === "JEWELRY_WHOLESALE" ||
        kit === "PHARMACY" ||
        kit === "AUTO_PARTS" ||
        kit === "DISTRIBUTOR"
    ) {
        return "Tape this QR at the counter or till. Owners can use Dashboard → QR & Print when a downloadable kit is available for this shop."
    }
    return "Print this QR for guests. Prefer Dashboard → QR & Print when a downloadable kit is available for this page."
}

export function guestPrintKicker(role?: string | null): "Menu QR" | "Stay QR" | "Page QR" {
    if (isRestaurant(role)) return "Menu QR"
    if (isHotelRole(role)) return "Stay QR"
    return "Page QR"
}

export function guestPrintScanCopy(role?: string | null): string {
    if (isRestaurant(role)) return "Scan for the live menu. Works on any phone — no app."
    if (isHotelRole(role)) {
        return "Scan for the concierge — towels, Wi-Fi, food, reception. Works on any phone — no app."
    }
    return "Scan to open this Introify page."
}

export function hotelGuestPrintEmptyRoomsCopy(): string {
    return "No room tents published yet — property QR above still works for the front desk."
}
