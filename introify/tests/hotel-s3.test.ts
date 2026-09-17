import { describe, expect, it } from "vitest"
import {
    departmentForType,
    hotelConciergeChips,
    hotelDeskReply,
    hotelGoogleReviewSearchUrl,
    hotelRequestAdvanceLabel,
    hotelRequestStatusLabel,
    hotelStayPath,
    hotelStayPhase,
    nextHotelRequestStatus,
    parseHotelGuestIntent,
    stayFeedbackTone,
    defaultSpaCatalogue,
    defaultTransportOptions,
    defaultHotelExperiences,
} from "@/lib/hotels"
import { TRY_HOTEL, TRY_HOTEL_S3, tryHotelSeedActions } from "@/lib/hotels/try-hotel-seed"

const desk = {
    displayName: "Haven Hinoo",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    roomNumber: "101",
    restaurants: [{ name: "Little Hours Café", slug: "littlehours" }],
    policiesApproved: false,
    spa: defaultSpaCatalogue(),
    transport: defaultTransportOptions(),
    experiences: defaultHotelExperiences(),
}

function expectRequestOnly(text: string) {
    const lower = text.toLowerCase()
    expect(lower).toMatch(/request/)
    expect(lower).not.toMatch(/payment confirmed|charged your card|you're booked|paid in full/)
}

describe("hotel S3 spa catalog", () => {
    it("seeds Haven Hinoo with two to three timed treatments", () => {
        const spa = defaultSpaCatalogue()
        expect(spa.length).toBeGreaterThanOrEqual(2)
        expect(spa.length).toBeLessThanOrEqual(3)
        expect(spa.every((row) => row.durationMinutes >= 30 && row.label && row.sku)).toBe(true)
        expect(spa.map((row) => row.sku)).toEqual(expect.arrayContaining(["massage", "steam-scrub"]))
    })

    it("parses a spa request from room chat and files a ticket, not a paid booking", () => {
        expect(parseHotelGuestIntent("book a 60 minute massage for room 101")).toMatchObject({
            kind: "spa",
            sku: "massage",
            roomNumber: "101",
        })
        expect(parseHotelGuestIntent("spa steam and scrub")).toMatchObject({ kind: "spa", sku: "steam-scrub" })
        const reply = hotelDeskReply("I'd like a massage", desk)
        expect(reply.action).toEqual({ type: "createSpa", sku: "massage", roomNumber: "101" })
        expectRequestOnly(reply.text)
        expect(reply.text).toMatch(/60\s*min/i)
        expect(departmentForType("SPA")).toBe("SPA")
    })

    it("labels spa tickets Accept then Scheduled, not a housekeeping delivery", () => {
        expect(nextHotelRequestStatus("REQUESTED")).toBe("ACCEPTED")
        expect(nextHotelRequestStatus("ACCEPTED")).toBe("ON_THE_WAY")
        expect(hotelRequestAdvanceLabel("ACCEPTED", "SPA")).toBe("Accept")
        expect(hotelRequestAdvanceLabel("ON_THE_WAY", "SPA")).toBe("Scheduled")
        expect(hotelRequestStatusLabel("ON_THE_WAY", "SPA")).toBe("Scheduled")
        expect(hotelRequestAdvanceLabel("COMPLETE", "SPA")).toBe("Done")
        expect(hotelRequestAdvanceLabel("ON_THE_WAY", "HOUSEKEEPING")).toBe("On the way")
    })
})

describe("hotel S3 transport", () => {
    it("offers airport transfer and local taxi or scooter as request cards", () => {
        const options = defaultTransportOptions()
        expect(options.map((row) => row.sku)).toEqual(expect.arrayContaining(["airport", "taxi", "scooter"]))
        expect(parseHotelGuestIntent("airport transfer at 6am")).toMatchObject({ kind: "transport", sku: "airport" })
        expect(parseHotelGuestIntent("need a taxi to the station")).toMatchObject({ kind: "transport", sku: "taxi" })
        expect(parseHotelGuestIntent("can I get a scooter")).toMatchObject({ kind: "transport", sku: "scooter" })
        const reply = hotelDeskReply("airport pickup please", desk)
        expect(reply.action).toEqual({ type: "createTransport", sku: "airport", roomNumber: "101" })
        expectRequestOnly(reply.text)
        expect(reply.text.toLowerCase()).toMatch(/airport/)
        expect(departmentForType("TRANSPORT")).toBe("TRANSPORT")
        expect(hotelRequestAdvanceLabel("ACCEPTED", "TRANSPORT")).toBe("Accept")
        expect(hotelRequestAdvanceLabel("ON_THE_WAY", "TRANSPORT")).toBe("On the way")
    })
})

describe("hotel S3 experiences and local guide", () => {
    it("lists two to four Haven Hinoo experiences and files interest as a request", () => {
        const list = defaultHotelExperiences()
        expect(list.length).toBeGreaterThanOrEqual(2)
        expect(list.length).toBeLessThanOrEqual(4)
        expect(parseHotelGuestIntent("I want the ranchi lake morning")).toMatchObject({
            kind: "experience",
            sku: "lake-morning",
        })
        const reply = hotelDeskReply("book the lake morning", desk)
        expect(reply.action).toMatchObject({ type: "createExperience", sku: "lake-morning" })
        expectRequestOnly(reply.text)
        expect(departmentForType("EXPERIENCE")).toBe("EXPERIENCES")
        expect(hotelRequestAdvanceLabel("ON_THE_WAY", "EXPERIENCE")).toBe("Scheduled")
    })

    it("suggests hotel-curated experiences plus a linked restaurant, and stays honest when empty", () => {
        const withData = hotelDeskReply("what's nearby / local guide", desk)
        expect(withData.action).toBeUndefined()
        expect(withData.text).toMatch(/Little Hours/)
        expect(withData.text.toLowerCase()).toMatch(/lake|walk|temple|hinoo/)
        const empty = hotelDeskReply("things to do nearby", {
            displayName: "Empty Inn",
            restaurants: [],
            experiences: [],
            policiesApproved: false,
        })
        expect(empty.text.toLowerCase()).toMatch(/don.?t have|not listed|ask reception/)
        expect(empty.text.toLowerCase()).not.toMatch(/i recommend a hidden gem|invented/)
    })
})

describe("hotel S3 stay lifecycle", () => {
    it("builds the pre-arrival stay path and a seeded demo token", () => {
        expect(hotelStayPath("try-hotel", "haven-demo")).toBe("/try-hotel/stay/haven-demo")
        expect(TRY_HOTEL_S3.stayToken).toBe("haven-demo")
        expect(TRY_HOTEL.slug).toBe("try-hotel")
    })

    it("classifies pre-arrival, during stay, checkout day, and after checkout without an SLA engine", () => {
        expect(hotelStayPhase({
            now: new Date("2026-09-16T08:00:00+05:30"),
            arrival: new Date("2026-09-17T14:00:00+05:30"),
            departure: new Date("2026-09-19T11:00:00+05:30"),
        })).toBe("pre_arrival")
        expect(hotelStayPhase({
            now: new Date("2026-09-18T09:00:00+05:30"),
            arrival: new Date("2026-09-17T14:00:00+05:30"),
            departure: new Date("2026-09-19T11:00:00+05:30"),
        })).toBe("during")
        expect(hotelStayPhase({
            now: new Date("2026-09-19T09:00:00+05:30"),
            arrival: new Date("2026-09-17T14:00:00+05:30"),
            departure: new Date("2026-09-19T11:00:00+05:30"),
        })).toBe("checkout")
        expect(hotelStayPhase({
            now: new Date("2026-09-19T13:00:00+05:30"),
            arrival: new Date("2026-09-17T14:00:00+05:30"),
            departure: new Date("2026-09-19T11:00:00+05:30"),
        })).toBe("after")
        expect(hotelStayPhase({})).toBeNull()
    })

    it("files checkout as a request and never implies a bill", () => {
        expect(parseHotelGuestIntent("we are checking out of room 101")).toMatchObject({ kind: "checkout" })
        const reply = hotelDeskReply("ready to checkout", desk)
        expect(reply.action).toEqual({ type: "checkout", roomNumber: "101" })
        expectRequestOnly(reply.text)
        expect(reply.text.toLowerCase()).not.toMatch(/bill is closed|card charged|invoice paid/)
        expect(departmentForType("CHECKOUT")).toBe("RECEPTION")
    })

    it("offers a Google review search only after a positive note, and never posts a review", () => {
        expect(stayFeedbackTone("the stay was wonderful, loved the room")).toBe("positive")
        expect(stayFeedbackTone("the ac was loud and breakfast was poor")).toBe("negative")
        expect(stayFeedbackTone("it was fine")).toBe("neutral")
        const good = hotelDeskReply("loved the stay, amazing staff", desk)
        expect(good.action).toMatchObject({ type: "feedback", tone: "positive" })
        expect(good.text).toContain(hotelGoogleReviewSearchUrl("Haven Hinoo", "Ranchi"))
        expect(good.text.toLowerCase()).toMatch(/does not post|won.?t post|never post/)
        const poor = hotelDeskReply("the stay was disappointing", desk)
        expect(poor.action).toMatchObject({ type: "feedback", tone: "negative" })
        expect(poor.text.toLowerCase()).not.toMatch(/google\.com/)
        expect(poor.text.toLowerCase()).not.toMatch(/posted your review|published on google/)
    })

    it("keeps late checkout request-only even when asked from a stay link", () => {
        const reply = hotelDeskReply("late checkout please", desk)
        expect(reply.action).toEqual({ type: "lateCheckout" })
        expectRequestOnly(reply.text)
    })
})

describe("hotel S3 room chips", () => {
    it("adds spa, transport, and experience chips on a room QR", () => {
        const chips = hotelConciergeChips("101")
        expect(chips[0]).toMatchObject({ id: "room", label: "Room 101", highlighted: true })
        expect(chips.map((chip) => chip.id)).toEqual(expect.arrayContaining([
            "spa",
            "transport",
            "experiences",
            "housekeeping",
            "reception",
        ]))
        expect(chips.find((chip) => chip.id === "spa")?.prompt?.toLowerCase()).toMatch(/spa|massage/)
        expect(chips.find((chip) => chip.id === "transport")?.prompt?.toLowerCase()).toMatch(/airport|taxi/)
        expect(chips.find((chip) => chip.id === "experiences")?.prompt?.toLowerCase()).toMatch(/experience|lake|walk/)
    })

    it("swaps in checkout or feedback chips from stay phase without dropping spa during the stay", () => {
        const during = hotelConciergeChips("101", { phase: "during" })
        expect(during.map((chip) => chip.id)).toEqual(expect.arrayContaining(["spa", "transport", "experiences"]))
        expect(during.some((chip) => chip.id === "feedback")).toBe(false)

        const pre = hotelConciergeChips(null, { phase: "pre_arrival" })
        expect(pre.map((chip) => chip.id)).toEqual(expect.arrayContaining(["transport", "experiences"]))
        expect(pre.some((chip) => chip.id === "housekeeping")).toBe(false)

        const leaving = hotelConciergeChips("101", { phase: "checkout" })
        expect(leaving.some((chip) => chip.id === "checkout")).toBe(true)
        expect(leaving.find((chip) => chip.id === "checkout")?.prompt?.toLowerCase()).toMatch(/checkout/)

        const after = hotelConciergeChips(null, { phase: "after" })
        expect(after.some((chip) => chip.id === "feedback")).toBe(true)
        expect(after.find((chip) => chip.id === "feedback")?.prompt?.toLowerCase()).toMatch(/stay|feedback/)
    })
})

describe("hotel S3 demo seed plan", () => {
    it("fills spa, transport, activities, and a haven-demo stay without inventing a restaurant", () => {
        const plan = tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "HOTEL" },
            rooms: ["101", "102", "103"],
            propertyQr: true,
            roomQrs: ["101", "102", "103"],
            linkedRestaurantSlug: "littlehours",
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
            services: ["restaurant", "housekeeping", "concierge"],
            stayToken: null,
        })
        expect(plan.createProfile).toBe(false)
        expect(plan.needServices).toEqual(expect.arrayContaining(["spa", "transport", "airportTransfer", "activities"]))
        expect(plan.needStay).toBe(true)
        expect(plan.stayToken).toBe("haven-demo")
        expect(plan.connectRestaurant).toBeNull()
    })

    it("does not overwrite an existing demo stay token", () => {
        const plan = tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "HOTEL" },
            rooms: ["101", "102", "103"],
            propertyQr: true,
            roomQrs: ["101", "102", "103"],
            linkedRestaurantSlug: "littlehours",
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
            services: ["restaurant", "housekeeping", "concierge", "spa", "transport", "airportTransfer", "activities"],
            stayToken: "haven-demo",
        })
        expect(plan.needServices).toEqual([])
        expect(plan.needStay).toBe(false)
    })
})
