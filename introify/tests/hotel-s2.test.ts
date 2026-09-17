import { describe, expect, it } from "vitest"
import { encodeQr } from "@/lib/qr-encode"
import {
    hotelConciergeChips,
    hotelSuggestedReplies,
    hotelRequestAdvanceLabel,
    hotelRequestStatusLabel,
    nextHotelRequestStatus,
    hotelDeskReply,
    parseHotelGuestIntent,
} from "@/lib/hotels"
import {
    PRINT_DPI,
    PRINT_TEMPLATES,
    QR_QUIET_ZONE_MODULES,
    buildPrintCsv,
    buildPrintPackage,
    paperPixels,
    qrSvg,
    validatePrintQr,
} from "@/lib/hotels/print-kit"
import { unzipStore, zipStore } from "@/lib/hotels/zip-store"
import { pickLinkedRestaurant, tryHotelSeedActions, TRY_HOTEL } from "@/lib/hotels/try-hotel-seed"

describe("hotel S2 housekeeping path", () => {
    it("walks Requested → Accepted → On the way → Delivered", () => {
        expect(nextHotelRequestStatus("REQUESTED")).toBe("ACCEPTED")
        expect(nextHotelRequestStatus("ACCEPTED")).toBe("ON_THE_WAY")
        expect(nextHotelRequestStatus("ON_THE_WAY")).toBe("COMPLETE")
        expect(nextHotelRequestStatus("COMPLETE")).toBeNull()
    })

    it("treats leftover In progress tickets as On the way, then Delivered", () => {
        expect(hotelRequestStatusLabel("IN_PROGRESS")).toBe("On the way")
        expect(hotelRequestStatusLabel("ON_THE_WAY")).toBe("On the way")
        expect(hotelRequestStatusLabel("COMPLETE")).toBe("Delivered")
        expect(nextHotelRequestStatus("IN_PROGRESS")).toBe("COMPLETE")
        expect(hotelRequestAdvanceLabel("ON_THE_WAY")).toBe("On the way")
        expect(hotelRequestAdvanceLabel("COMPLETE")).toBe("Delivered")
    })
})

describe("hotel S2 room-context chips", () => {
    it("keeps property chips when there is no room", () => {
        const chips = hotelConciergeChips()
        expect(chips.map((chip) => chip.id)).toEqual(["housekeeping", "wifi", "food", "reception", "emergency"])
        expect(chips[0]?.label).toBe("Housekeeping")
        expect(chips.some((chip) => chip.id === "room")).toBe(false)
    })

    it("leads with a highlighted Room chip and suffixes every action with the number", () => {
        const chips = hotelConciergeChips("101")
        expect(chips[0]).toMatchObject({ id: "room", label: "Room 101", highlighted: true })
        expect(chips.find((chip) => chip.id === "housekeeping")).toMatchObject({
            label: "Towels · 101",
            prompt: "Two towels for room 101",
        })
        expect(chips.find((chip) => chip.id === "wifi")?.label).toBe("Wi-Fi · 101")
        expect(chips.find((chip) => chip.id === "food")?.label).toBe("Food · 101")
        expect(chips.find((chip) => chip.id === "reception")?.label).toBe("Reception · 101")
    })
})

describe("hotel suggested replies vs welcome catalog", () => {
    it("moves room-QR actions into suggested replies and drops the Room chip", () => {
        const replies = hotelSuggestedReplies("101")
        expect(replies.map((chip) => chip.id)).toEqual([
            "housekeeping",
            "maintenance",
            "wifi",
            "food",
            "spa",
            "transport",
            "experiences",
            "reception",
            "emergency",
        ])
        expect(replies.some((chip) => chip.id === "room")).toBe(false)
        expect(replies.find((chip) => chip.id === "housekeeping")).toMatchObject({
            label: "Towels",
            prompt: "Two towels for room 101",
        })
        expect(replies.find((chip) => chip.id === "maintenance")).toMatchObject({
            label: "Fix",
            prompt: "AC is broken in room 101",
        })
        const source = hotelConciergeChips("101")
        for (const reply of replies) {
            expect(source.find((chip) => chip.id === reply.id)?.prompt).toBe(reply.prompt)
        }
    })

    it("keeps phase-aware suggested replies without a Room fake action", () => {
        expect(hotelSuggestedReplies(null, { phase: "pre_arrival" }).map((chip) => chip.id)).toEqual([
            "transport",
            "experiences",
            "food",
            "reception",
        ])
        expect(hotelSuggestedReplies(null, { phase: "after" }).map((chip) => chip.id)).toEqual([
            "feedback",
            "food",
            "reception",
        ])
        const leaving = hotelSuggestedReplies("101", { phase: "checkout" })
        expect(leaving.map((chip) => chip.id)).toEqual(["checkout", "transport", "housekeeping", "reception"])
        expect(leaving.some((chip) => chip.id === "room")).toBe(false)
        expect(leaving.find((chip) => chip.id === "checkout")?.prompt).toBe("Ready to checkout of room 101")
    })
})

describe("hotel S2 honest late checkout", () => {
    const ctx = {
        displayName: "Haven Hinoo",
        checkOutTime: "11:00",
        restaurants: [] as { name: string; slug: string }[],
        policiesApproved: false,
    }

    it("files a request and does not confirm payment while policies are unapproved", () => {
        expect(parseHotelGuestIntent("late checkout please")).toEqual({ kind: "late_checkout" })
        const reply = hotelDeskReply("late checkout please", ctx)
        expect(reply.action).toEqual({ type: "lateCheckout" })
        expect(reply.text.toLowerCase()).toMatch(/request/)
        expect(reply.text.toLowerCase()).not.toMatch(/paid|charged|payment confirmed/)
        expect(reply.text).toMatch(/11:00/)
    })

    it("still refuses to confirm a charge even if policiesApproved later", () => {
        const reply = hotelDeskReply("late checkout please", { ...ctx, policiesApproved: true })
        expect(reply.action).toEqual({ type: "lateCheckout" })
        expect(reply.text.toLowerCase()).toMatch(/request/)
        expect(reply.text.toLowerCase()).not.toMatch(/payment confirmed|you're booked|checkout is paid/)
    })
})

describe("hotel S2 prod demo seed plan", () => {
    it("creates Haven Hinoo / try-hotel with rooms 101–103 and connects an existing restaurant only", () => {
        expect(TRY_HOTEL.slug).toBe("try-hotel")
        expect(TRY_HOTEL.displayName).toBe("Haven Hinoo")
        expect(TRY_HOTEL.rooms).toEqual(["101", "102", "103"])
        const plan = tryHotelSeedActions({
            profile: null,
            rooms: [],
            propertyQr: false,
            roomQrs: [],
            linkedRestaurantSlug: null,
            availableRestaurants: [
                { slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true },
                { slug: "maya", roleTemplate: "DESIGNER", isPublic: true },
            ],
        })
        expect(plan.createProfile).toBe(true)
        expect(plan.addRooms).toEqual(["101", "102", "103"])
        expect(plan.needPropertyQr).toBe(true)
        expect(plan.needRoomQrs).toEqual(["101", "102", "103"])
        expect(plan.connectRestaurant).toBe("littlehours")
    })

    it("never invents a restaurant menu and skips overwriting an existing hotel", () => {
        expect(pickLinkedRestaurant([
            { slug: "formandfield", roleTemplate: "SHOP", isPublic: true },
        ])).toBeNull()
        const plan = tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "HOTEL" },
            rooms: ["101", "102", "103"],
            propertyQr: true,
            roomQrs: ["101", "102", "103"],
            linkedRestaurantSlug: "littlehours",
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
        })
        expect(plan.createProfile).toBe(false)
        expect(plan.addRooms).toEqual([])
        expect(plan.needPropertyQr).toBe(false)
        expect(plan.needRoomQrs).toEqual([])
        expect(plan.connectRestaurant).toBeNull()
    })

    it("fills missing rooms and QRs on an existing try-hotel without touching a foreign role", () => {
        expect(tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "CONSULTANT" },
            rooms: [],
            propertyQr: false,
            roomQrs: [],
            linkedRestaurantSlug: null,
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
        }).createProfile).toBe(false)

        const plan = tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "HOTEL" },
            rooms: ["101"],
            propertyQr: true,
            roomQrs: [],
            linkedRestaurantSlug: null,
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
        })
        expect(plan.addRooms).toEqual(["102", "103"])
        expect(plan.needPropertyQr).toBe(false)
        expect(plan.needRoomQrs).toEqual(["101", "102", "103"])
        expect(plan.connectRestaurant).toBe("littlehours")
    })
})

describe("hotel S2 print kit", () => {
    it("ships room card, bedside, door sticker, reception stand, and table tent on A4/A5/A6", () => {
        const ids = PRINT_TEMPLATES.map((row) => row.id)
        expect(ids).toEqual(expect.arrayContaining([
            "room_card",
            "bedside",
            "door_sticker",
            "reception_stand",
            "table_tent",
        ]))
        expect(PRINT_TEMPLATES.every((row) => ["A4", "A5", "A6"].includes(row.paper))).toBe(true)
        expect(PRINT_DPI).toBe(300)
        expect(paperPixels("A6")).toEqual({ width: 1240, height: 1748 })
    })

    it("encodes a vector QR with a four-module quiet zone and rejects a tight crop", () => {
        const url = "https://introify.com/q/hTestCode1"
        const svg = qrSvg(url, { quietModules: QR_QUIET_ZONE_MODULES, dark: "#0e7490", light: "#fffdf8" })
        expect(svg).toContain("<svg")
        expect(svg).toContain("shape-rendering=\"crispEdges\"")
        expect(validatePrintQr({ url, quietModules: QR_QUIET_ZONE_MODULES }).ok).toBe(true)
        expect(validatePrintQr({ url, quietModules: 3 }).ok).toBe(false)
        expect(validatePrintQr({ url: "https://introify.com/try-hotel", quietModules: 4 }).ok).toBe(false)
        const modules = encodeQr(url)
        expect(svg).toContain(`viewBox="0 0 ${modules.size + 8} ${modules.size + 8}"`)
    })

    it("builds a ZIP + CSV mapping room → code → /q/{code} URL using hotel brand colors", () => {
        const pack = buildPrintPackage({
            slug: "try-hotel",
            hotelName: "Haven Hinoo",
            origin: "https://introify.com",
            accent: "#00D7FF",
            logoUrl: "/uploads/try-arjun.jpg",
            qrs: [
                { code: "hProp0001", kind: "PROPERTY", label: "Property", roomNumber: null },
                { code: "hRoom0101", kind: "ROOM", label: "Room 101", roomNumber: "101" },
                { code: "hRoom0102", kind: "ROOM", label: "Room 102", roomNumber: "102" },
                { code: "hRoom0103", kind: "ROOM", label: "Room 103", roomNumber: "103" },
            ],
        })
        const files = unzipStore(pack.zip)
        const names = Object.keys(files)
        expect(names).toEqual(expect.arrayContaining([
            "mapping.csv",
            "README.txt",
            "qrs/property.svg",
            "qrs/room-101.svg",
            "templates/room-card-101.svg",
            "templates/bedside-101.svg",
            "templates/door-sticker-101.svg",
            "templates/reception-stand.svg",
            "templates/table-tent.svg",
            "templates/a4-room-sheet.svg",
        ]))
        const csv = new TextDecoder().decode(files["mapping.csv"])
        expect(csv).toMatch(/^room,kind,code,url,label/m)
        expect(csv).toContain("101,ROOM,hRoom0101,https://introify.com/q/hRoom0101,Room 101")
        expect(csv).toContain("103,ROOM,hRoom0103,https://introify.com/q/hRoom0103")
        const mapping = buildPrintCsv({
            origin: "https://introify.com",
            qrs: [{ code: "hRoom0101", kind: "ROOM", label: "Room 101", roomNumber: "101" }],
        })
        expect(mapping).toContain("/q/hRoom0101")
        const card = new TextDecoder().decode(files["templates/room-card-101.svg"])
        expect(card).toContain("Haven Hinoo")
        expect(card).toContain("#00D7FF")
        expect(card).toContain("Room 101")
        expect(card).toContain("105mm")
        const readme = new TextDecoder().decode(files["README.txt"])
        expect(readme.toLowerCase()).toMatch(/300 dpi/)
        expect(readme.toLowerCase()).toMatch(/quiet zone/)
        expect(readme.toLowerCase()).toMatch(/test qr/)
        expect(pack.filename).toMatch(/try-hotel.*print/i)
    })

    it("round-trips stored ZIP entries without compression", () => {
        const zip = zipStore([
            { name: "a.txt", data: new TextEncoder().encode("hello") },
            { name: "nested/b.txt", data: new TextEncoder().encode("world") },
        ])
        const files = unzipStore(zip)
        expect(new TextDecoder().decode(files["a.txt"])).toBe("hello")
        expect(new TextDecoder().decode(files["nested/b.txt"])).toBe("world")
    })
})
