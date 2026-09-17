import { describe, expect, it } from "vitest"
import { ROLE_ALIAS, resolveKitRole } from "@/lib/role-alias"
import { surfacesFor, hasSurface } from "@/lib/surfaces"
import { needByRole, needById } from "@/lib/onboarding-needs"
import { TRY_KITS, kitFamily } from "@/lib/try-kits"
import { profileSlugFromPath, isProfileCatchAllPath } from "@/lib/reserved-http"
import { isReservedSlug } from "@/lib/slugs"
import { visibleNavItems } from "@/components/dashboard/sidebar"
import { matchNeedFromQuery } from "@/lib/onboarding-chat"
import {
    encodeHotelCard,
    hotelPropertyPath,
    hotelQrPath,
    hotelQrTargetPath,
    hotelRoomPath,
    hotelStayPath,
    isHotelRole,
    isPublicChatViewportPath,
    nextHotelRequestStatus,
    normalizeRoomNumber,
    parseHotelCard,
    parseHotelGuestIntent,
    defaultHousekeepingCatalogue,
} from "@/lib/hotels"

describe("hotel S1 role kit", () => {
    it("treats resort, hostel, homestay, and serviced apartment as the hotel kit", () => {
        for (const flavor of ["RESORT", "HOSTEL", "HOMESTAY", "SERVICED_APARTMENT"] as const) {
            expect(ROLE_ALIAS[flavor]).toBe("HOTEL")
            expect(resolveKitRole(flavor)).toBe("HOTEL")
            expect(isHotelRole(flavor)).toBe(true)
            expect(surfacesFor(flavor)).toEqual(surfacesFor("HOTEL"))
            expect(needByRole(flavor).role).toBe("HOTEL")
        }
        expect(isHotelRole("HOTEL")).toBe(true)
        expect(isHotelRole("RESTAURANT")).toBe(false)
        expect(isHotelRole("CAFE")).toBe(false)
    })

    it("gives hotels concierge surfaces without duplicating restaurant menus", () => {
        expect(hasSurface("HOTEL", "home")).toBe(true)
        expect(hasSurface("HOTEL", "inbox")).toBe(true)
        expect(hasSurface("HOTEL", "services")).toBe(true)
        expect(hasSurface("HOTEL", "shop")).toBe(false)
        expect(hasSurface("HOTEL", "calendar")).toBe(false)
        expect(needById("hotel").next).toBe("/dashboard")
        expect(kitFamily("HOTEL")).toBe("stay")
        expect(kitFamily("RESORT")).toBe("stay")
        const hotelKits = TRY_KITS.filter((kit) => resolveKitRole(kit.role) === "HOTEL")
        expect(hotelKits.map((kit) => kit.role).sort()).toEqual(
            ["HOMESTAY", "HOTEL", "HOSTEL", "RESORT", "SERVICED_APARTMENT"].sort(),
        )
    })

    it("routes hotel, resort, and hostel queries to the hotel need", () => {
        expect(matchNeedFromQuery("Hotel")).toBe("hotel")
        expect(matchNeedFromQuery("Resort")).toBe("hotel")
        expect(matchNeedFromQuery("hostel")).toBe("hotel")
        expect(matchNeedFromQuery("homestay")).toBe("hotel")
    })
})

describe("hotel S1 guest routing", () => {
    it("builds property, room, stay, and dynamic QR paths", () => {
        expect(hotelPropertyPath("haven")).toBe("/haven")
        expect(hotelRoomPath("haven", "101")).toBe("/haven/r/101")
        expect(hotelStayPath("haven", "stay_abc")).toBe("/haven/stay/stay_abc")
        expect(hotelQrPath("hQRcode99")).toBe("/q/hQRcode99")
        expect(hotelQrTargetPath({ kind: "PROPERTY", slug: "haven" })).toBe("/haven")
        expect(hotelQrTargetPath({ kind: "ROOM", slug: "haven", roomNumber: "101" })).toBe("/haven/r/101")
        expect(hotelQrTargetPath({ kind: "STAY", slug: "haven", stayToken: "tok" })).toBe("/haven/stay/tok")
    })

    it("treats property, room, and stay chat as one viewport and leaves catalogues free", () => {
        expect(isPublicChatViewportPath("/haven", "/haven")).toBe(true)
        expect(isPublicChatViewportPath("/haven/", "/haven")).toBe(true)
        expect(isPublicChatViewportPath("/haven/r/101", "/haven")).toBe(true)
        expect(isPublicChatViewportPath("/haven/stay/haven-demo", "/haven")).toBe(true)
        expect(isPublicChatViewportPath("/haven/shop", "/haven")).toBe(false)
        expect(isPublicChatViewportPath("/haven/menu", "/haven")).toBe(false)
        expect(isPublicChatViewportPath("/haven/r/101/extra", "/haven")).toBe(false)
        expect(isPublicChatViewportPath("/other/r/101", "/haven")).toBe(false)
    })

    it("normalizes room numbers from guest phrasing", () => {
        expect(normalizeRoomNumber("101")).toBe("101")
        expect(normalizeRoomNumber(" room 101 ")).toBe("101")
        expect(normalizeRoomNumber("RM-12A")).toBe("12A")
        expect(normalizeRoomNumber("101-A")).toBe("101-A")
    })

    it("keeps /q off the public profile catch-all", () => {
        expect(isProfileCatchAllPath("/q/abc")).toBe(false)
        expect(profileSlugFromPath("/q/abc")).toBeNull()
        expect(isReservedSlug("q")).toBe(true)
        expect(isProfileCatchAllPath("/haven/r/101")).toBe(true)
        expect(profileSlugFromPath("/haven/r/101")).toBe("haven")
    })
})

describe("hotel S1 housekeeping intent", () => {
    it("parses a natural-language towel request with a room", () => {
        expect(parseHotelGuestIntent("two towels room 111")).toEqual({
            kind: "housekeeping",
            items: [{ sku: "towels", qty: 2, label: "Towels" }],
            roomNumber: "111",
        })
    })

    it("parses water and toiletries without inventing a room", () => {
        expect(parseHotelGuestIntent("please send bottled water")).toEqual({
            kind: "housekeeping",
            items: [{ sku: "water", qty: 1, label: "Bottled water" }],
            roomNumber: undefined,
        })
        expect(parseHotelGuestIntent("need toiletries")).toMatchObject({
            kind: "housekeeping",
            items: [{ sku: "toiletries", qty: 1 }],
        })
    })

    it("routes wifi, food, reception, and late checkout", () => {
        expect(parseHotelGuestIntent("what's the wifi password?")).toEqual({ kind: "wifi" })
        expect(parseHotelGuestIntent("I am hungry, any restaurants?")).toEqual({ kind: "food" })
        expect(parseHotelGuestIntent("What restaurants can I order from?")).toEqual({ kind: "food" })
        expect(parseHotelGuestIntent("talk to reception")).toEqual({ kind: "reception" })
        expect(parseHotelGuestIntent("late checkout please")).toEqual({ kind: "late_checkout" })
        expect(parseHotelGuestIntent("hello")).toEqual({ kind: "greeting" })
    })

    it("ships a default housekeeping catalogue", () => {
        const skus = defaultHousekeepingCatalogue().map((item) => item.sku)
        expect(skus).toEqual(expect.arrayContaining(["towels", "water", "toiletries", "cleaning"]))
    })
})

describe("hotel S1 request status and cards", () => {
    it("walks Requested → Accepted → On the way → Delivered", () => {
        expect(nextHotelRequestStatus("REQUESTED")).toBe("ACCEPTED")
        expect(nextHotelRequestStatus("ACCEPTED")).toBe("ON_THE_WAY")
        expect(nextHotelRequestStatus("ON_THE_WAY")).toBe("COMPLETE")
        expect(nextHotelRequestStatus("IN_PROGRESS")).toBe("COMPLETE")
        expect(nextHotelRequestStatus("COMPLETE")).toBeNull()
    })

    it("round-trips a structured request card for chat UI", () => {
        const card = {
            type: "request" as const,
            id: "req_1",
            status: "REQUESTED",
            title: "Housekeeping",
            room: "101",
            items: ["2 towels"],
        }
        const encoded = encodeHotelCard(card)
        expect(encoded).toContain("[[hotel-card:")
        expect(parseHotelCard(`${encoded}\nWe'll bring those up.`)).toEqual(card)
    })
})

describe("hotel S1 staff nav", () => {
    it("labels hospitality dashboard items for hotel roles", () => {
        const names = visibleNavItems("HOTEL").map((item) => item.name)
        expect(names).toEqual(expect.arrayContaining([
            "Home",
            "Requests",
            "Rooms",
            "QR & Print",
            "Restaurants",
            "Services",
            "Staff",
            "Analytics",
            "Chats",
            "Profile",
            "Billing",
        ]))
        expect(names).not.toContain("Menu")
        expect(names).not.toContain("Shop")
        expect(names).not.toContain("Courses")
        expect(visibleNavItems("HOTEL").find((item) => item.name === "Requests")?.href).toBe("/dashboard/requests")
        expect(visibleNavItems("RESORT").find((item) => item.name === "QR & Print")?.href).toBe("/dashboard/qr")
    })
})
