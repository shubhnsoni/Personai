import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    describeHotelGuestRoom,
    hotelGuestMenuEmptyCopy,
    hotelGuestMenuHasContent,
    hotelServiceLabels,
    HOTEL_GUEST_MENU_LABEL,
    resolveHotelBrandLogo,
} from "@/lib/hotels/guest-menu"
import { isHotelRole } from "@/lib/hotels"
import { catalogLabel, isRestaurant } from "@/lib/menu"

const root = process.cwd()

describe("HOTEL P0-2 guest /menu surface helpers", () => {
    it("labels hotel kits Stay, not Shop", () => {
        expect(HOTEL_GUEST_MENU_LABEL).toBe("Stay")
        expect(isHotelRole("HOTEL")).toBe(true)
        expect(isHotelRole("RESORT")).toBe(true)
        expect(isHotelRole("SERVICED_APARTMENT")).toBe(true)
        expect(isRestaurant("HOTEL")).toBe(false)
        // Restaurant chrome unchanged
        expect(catalogLabel("RESTAURANT")).toBe("Menu")
        expect(catalogLabel("CAFE")).toBe("Menu")
        expect(catalogLabel("SHOP")).toBe("Shop")
    })

    it("strips try-arjun / skydine leakage from hotel brand logo", () => {
        expect(resolveHotelBrandLogo("/uploads/try-arjun.jpg")).toBeNull()
        expect(resolveHotelBrandLogo("/uploads/skydine-cafe/interior.jpg")).toBeNull()
        expect(resolveHotelBrandLogo("/uploads/skydine-cafe/interior.jpg", "/uploads/try-arjun.jpg")).toBeNull()
        expect(resolveHotelBrandLogo("/uploads/try-arjun.jpg", "/uploads/demo/haven-mark.png")).toBe(
            "/uploads/demo/haven-mark.png",
        )
        expect(resolveHotelBrandLogo(null, undefined, "")).toBeNull()
    })

    it("maps known service ids and describes rooms without inventing rates", () => {
        expect(hotelServiceLabels(["housekeeping", "spa", "airportTransfer"])).toEqual([
            "Housekeeping",
            "Spa",
            "Airport transfer",
        ])
        expect(describeHotelGuestRoom({ number: "101", floor: "1", category: "Deluxe" })).toBe("Deluxe · Floor 1")
        expect(describeHotelGuestRoom({ number: "102" })).toBe("Room")
    })

    it("chooses honest empty only when nothing publishable exists", () => {
        expect(hotelGuestMenuHasContent({ roomCount: 3, restaurantCount: 0, amenityCount: 0, serviceCount: 0 })).toBe(true)
        expect(hotelGuestMenuHasContent({ roomCount: 0, restaurantCount: 1, amenityCount: 0, serviceCount: 0 })).toBe(true)
        expect(hotelGuestMenuHasContent({ roomCount: 0, restaurantCount: 0, amenityCount: 0, serviceCount: 2 })).toBe(true)
        expect(hotelGuestMenuHasContent({ roomCount: 0, restaurantCount: 0, amenityCount: 0, serviceCount: 0 })).toBe(false)
        const empty = hotelGuestMenuEmptyCopy({ roomCount: 0, restaurantCount: 0 })
        expect(empty?.title).toMatch(/No rooms or menus published yet/i)
        expect(hotelGuestMenuEmptyCopy({ roomCount: 2, restaurantCount: 0 })).toBeNull()
    })
})

describe("HOTEL P0-2 menu route wiring", () => {
    it("branches hotel kits off ShopPage / ShopCatalog / owner empty CTA", () => {
        const menuPage = readFileSync(join(root, "src/app/[slug]/menu/page.tsx"), "utf8")
        expect(menuPage).toMatch(/isHotelRole/)
        expect(menuPage).toMatch(/HotelGuestMenu|HotelMenuPage/)
        expect(menuPage).toMatch(/resolveHotelBrandLogo/)
        expect(menuPage).toMatch(/listLinkedRestaurants/)
        expect(menuPage).toMatch(/return ShopPage\(props\)/)

        const surface = readFileSync(join(root, "src/components/hotel/hotel-guest-menu.tsx"), "utf8")
        expect(surface).toMatch(/HOTEL_GUEST_MENU_LABEL|Stay/)
        expect(surface).toMatch(/Chat with concierge/)
        expect(surface).toMatch(/HOTEL_GUEST_MENU_EMPTY_TITLE|No rooms or menus published yet/)
        expect(surface).toMatch(/data-hotel-guest-menu/)
        expect(surface).not.toMatch(/Import a catalog or add a product/)
        expect(surface).not.toMatch(/ShopCatalog/)
        expect(surface).not.toMatch(/\bSHOP\b/)
    })

    it("leaves restaurant menu + shop catalog empty CTA intact", () => {
        const shopCatalog = readFileSync(join(root, "src/components/shop/shop-catalog.tsx"), "utf8")
        expect(shopCatalog).toMatch(/Import a catalog or add a product/)
        const shopPage = readFileSync(join(root, "src/app/[slug]/shop/page.tsx"), "utf8")
        expect(shopPage).toMatch(/ShopCatalog/)
        expect(shopPage).toMatch(/isRestaurant/)
        expect(shopPage).not.toMatch(/HotelGuestMenu/)
    })
})
