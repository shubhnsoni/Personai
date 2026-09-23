import { isCrossRoleShopProductImage } from "@/lib/shop-product-imagery"
import { HOTEL_SERVICE_OPTIONS } from "./catalogue"

/** Guest `/menu` chrome label for hotel kits — never "Shop". */
export const HOTEL_GUEST_MENU_LABEL = "Stay"

export const HOTEL_GUEST_MENU_EMPTY_TITLE = "No rooms or menus published yet"
export const HOTEL_GUEST_MENU_EMPTY_DETAIL =
    "Ask the concierge in chat for stay details, or check back when the desk publishes rooms or a connected kitchen."

export function hotelGuestMenuLabel(role?: string | null): string {
    // Role arg kept for callers that already know the kit; non-hotel should not use this helper.
    void role
    return HOTEL_GUEST_MENU_LABEL
}

/**
 * Hotel header/logo policy for guest menu (P0-2 / P1-5 slice).
 * Drop known cross-role stock (try-arjun people stills, skydine cafe) so guests
 * do not see creator/cafe leakage. Prefer a non-leaky logo; otherwise null
 * (CatalogHeader falls back to wordmark-only identity).
 */
export function resolveHotelBrandLogo(
    ...candidates: Array<string | null | undefined>
): string | null {
    for (const raw of candidates) {
        const url = typeof raw === "string" ? raw.trim() : ""
        if (!url) continue
        if (isCrossRoleShopProductImage(url)) continue
        return url
    }
    return null
}

export function hotelServiceLabels(serviceIds: string[]): string[] {
    const map = new Map(HOTEL_SERVICE_OPTIONS.map((row) => [row.id, row.label]))
    const out: string[] = []
    const seen = new Set<string>()
    for (const id of serviceIds) {
        const key = String(id || "").trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        const mapped = map.get(key as (typeof HOTEL_SERVICE_OPTIONS)[number]["id"])
        if (mapped) {
            out.push(mapped)
            continue
        }
        // Unknown id — humanize camelCase / kebab without inventing inventory.
        const human = key
            .replace(/[-_]+/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim()
        if (human) out.push(human)
    }
    return out
}

export type HotelGuestMenuRoom = {
    number: string
    floor?: string | null
    category?: string | null
}

export type HotelGuestMenuRestaurant = {
    name: string
    slug: string
    label?: string | null
    headline?: string | null
}

export function describeHotelGuestRoom(room: HotelGuestMenuRoom): string {
    const bits = [
        room.category?.trim() || null,
        room.floor?.trim() ? `Floor ${room.floor.trim()}` : null,
    ].filter(Boolean) as string[]
    return bits.length ? bits.join(" · ") : "Room"
}

export function hotelGuestMenuEmptyCopy(input: {
    roomCount: number
    restaurantCount: number
}): { title: string; detail: string } | null {
    if (input.roomCount > 0 || input.restaurantCount > 0) return null
    return {
        title: HOTEL_GUEST_MENU_EMPTY_TITLE,
        detail: HOTEL_GUEST_MENU_EMPTY_DETAIL,
    }
}

/** True when the guest surface has something honest to show (rooms, kitchens, or amenities/services). */
export function hotelGuestMenuHasContent(input: {
    roomCount: number
    restaurantCount: number
    amenityCount: number
    serviceCount: number
}): boolean {
    return input.roomCount + input.restaurantCount + input.amenityCount + input.serviceCount > 0
}
