import { isHotelRole } from "@/lib/hotels"
import { isRestaurant } from "@/lib/menu"
import { resolveKitRole } from "@/lib/role-alias"

/**
 * Footer hint under guest /print for non-food kits.
 * Food kits use their own menu/table chrome and return null.
 * Hotels keep the downloadable hotel package CTA; shops/other kits get
 * role-aware or neutral counter/QR language (never hotel leakage).
 */
export function guestPrintFooterHint(role?: string | null): string | null {
    if (isRestaurant(role)) return null
    if (isHotelRole(role)) {
        return "Prefer the downloadable hotel print package? Use Dashboard → QR & Print when this page is a hotel kit."
    }
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
