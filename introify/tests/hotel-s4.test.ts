import { describe, expect, it } from "vitest"
import {
    DEFAULT_HOTEL_KNOWLEDGE,
    DEFAULT_HOTEL_MAP_MARKERS,
    DEFAULT_HOTEL_SLA_MINUTES,
    DEFAULT_HOTEL_UPSELLS,
    DEFAULT_MAINTENANCE_CATALOGUE,
    HOTEL_KNOWLEDGE_BUCKETS,
    departmentForType,
    detectGuestLanguage,
    feedbackRoute,
    findMapMarker,
    guestVisibleKnowledge,
    hotelConciergeChips,
    hotelDeskReply,
    hotelRequestAdvanceLabel,
    hotelRequestStatusLabel,
    lookupHotelKnowledge,
    parseHotelGuestIntent,
    shouldOfferUpsell,
    slaBadge,
    staffNoteFromGuest,
    summarizeHotelAnalytics,
    upsellCopy,
} from "@/lib/hotels"
import { TRY_HOTEL, TRY_HOTEL_S3, TRY_HOTEL_S4, tryHotelSeedActions } from "@/lib/hotels/try-hotel-seed"

const desk = {
    displayName: "Haven Hinoo",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    roomNumber: "101",
    restaurants: [{ name: "Little Hours Café", slug: "littlehours" }],
    policiesApproved: false,
    emergencyContact: "112",
    receptionPhone: "919431100221",
    receptionWhatsapp: "919431100221",
    quietHours: "22:00–07:00",
    parkingInfo: "Street parking on Hinoo Main Road. No valet.",
    propertyHours: "Reception 00:00–23:59",
    knowledge: DEFAULT_HOTEL_KNOWLEDGE,
    mapMarkers: DEFAULT_HOTEL_MAP_MARKERS,
    upsells: DEFAULT_HOTEL_UPSELLS,
    staffLanguage: "en" as const,
}

function expectRequestOnly(text: string) {
    const lower = text.toLowerCase()
    expect(lower).toMatch(/request/)
    expect(lower).not.toMatch(/payment confirmed|charged your card|you're booked|paid in full/)
}

describe("hotel S4 maintenance", () => {
    it("catalogues AC, TV, Wi-Fi, plumbing, and electrical as maintenance SKUs", () => {
        const skus = DEFAULT_MAINTENANCE_CATALOGUE.map((row) => row.sku)
        expect(skus).toEqual(expect.arrayContaining(["ac", "tv", "wifi", "plumbing", "electrical"]))
        expect(DEFAULT_MAINTENANCE_CATALOGUE.every((row) => row.label && row.aliases.length)).toBe(true)
    })

    it("files a broken AC or TV as a maintenance ticket, not housekeeping", () => {
        expect(parseHotelGuestIntent("AC not working in room 101")).toMatchObject({
            kind: "maintenance",
            sku: "ac",
            roomNumber: "101",
        })
        expect(parseHotelGuestIntent("the tv is broken")).toMatchObject({ kind: "maintenance", sku: "tv" })
        expect(parseHotelGuestIntent("tap is leaking")).toMatchObject({ kind: "maintenance", sku: "plumbing" })
        const reply = hotelDeskReply("AC not working", desk)
        expect(reply.action).toEqual({ type: "createMaintenance", sku: "ac", roomNumber: "101" })
        expectRequestOnly(reply.text)
        expect(reply.text.toLowerCase()).toMatch(/photo|picture/)
        expect(departmentForType("MAINTENANCE")).toBe("MAINTENANCE")
    })

    it("treats dead Wi-Fi as maintenance and a password ask as Wi-Fi, not the other way around", () => {
        expect(parseHotelGuestIntent("wifi is not working")).toMatchObject({ kind: "maintenance", sku: "wifi" })
        expect(parseHotelGuestIntent("what's the wifi password")).toMatchObject({ kind: "wifi" })
        expect(hotelDeskReply("wifi down in 101", desk).action).toMatchObject({ type: "createMaintenance", sku: "wifi" })
        expect(hotelDeskReply("what's the wifi password", desk).action).toBeUndefined()
        expect(hotelDeskReply("what's the wifi password", desk).text.toLowerCase()).toMatch(/haven-guest|network|password|reception/)
    })
})

describe("hotel S4 emergency", () => {
    it("surfaces call links instead of an ordinary wait-on-ticket path", () => {
        expect(parseHotelGuestIntent("emergency")).toEqual({ kind: "emergency" })
        expect(parseHotelGuestIntent("there's a fire in the corridor")).toEqual({ kind: "emergency" })
        expect(parseHotelGuestIntent("medical emergency")).toEqual({ kind: "emergency" })
        const reply = hotelDeskReply("emergency", desk)
        expect(reply.action).toEqual({ type: "emergency" })
        expect(reply.text.toLowerCase()).toMatch(/call/)
        expect(reply.text).toMatch(/112|919431100221/)
        expect(reply.text.toLowerCase()).toMatch(/not (an ordinary |a )ticket|do not wait|call now/)
        expect(reply.text.toLowerCase()).not.toMatch(/housekeeping will pick it up|we.?ll bring towels/)
        expect(departmentForType("EMERGENCY")).toBe("SECURITY")
        expect(hotelRequestAdvanceLabel("ACCEPTED", "EMERGENCY")).toBe("Acknowledge")
        expect(hotelRequestStatusLabel("ON_THE_WAY", "EMERGENCY")).toBe("Attending")
        expect(hotelRequestStatusLabel("COMPLETE", "EMERGENCY")).toBe("Closed")
    })
})

describe("hotel S4 knowledge and map", () => {
    it("keeps eleven buckets and hides INTERNAL from guests", () => {
        expect(HOTEL_KNOWLEDGE_BUCKETS).toEqual([
            "PROPERTY", "ROOMS", "POLICIES", "AMENITIES", "FOOD", "SPA", "ACTIVITIES", "TRANSPORT", "NEARBY", "EMERGENCY", "INTERNAL",
        ])
        expect(DEFAULT_HOTEL_KNOWLEDGE.map((row) => row.bucket).sort()).toEqual([...HOTEL_KNOWLEDGE_BUCKETS].sort())
        const guest = guestVisibleKnowledge(DEFAULT_HOTEL_KNOWLEDGE)
        expect(guest.every((row) => row.guestVisible)).toBe(true)
        expect(guest.some((row) => row.bucket === "INTERNAL")).toBe(false)
        expect(lookupHotelKnowledge(DEFAULT_HOTEL_KNOWLEDGE, "quiet hours", { guest: true })?.bucket).toBe("POLICIES")
        expect(lookupHotelKnowledge(DEFAULT_HOTEL_KNOWLEDGE, "night audit password", { guest: true })).toBeNull()
        expect(lookupHotelKnowledge(DEFAULT_HOTEL_KNOWLEDGE, "night audit", { guest: false })?.bucket).toBe("INTERNAL")
    })

    it("answers where's the spa with a marker card, not an invented indoor path", () => {
        expect(findMapMarker(DEFAULT_HOTEL_MAP_MARKERS, "where's the spa")?.kind).toBe("spa")
        expect(findMapMarker(DEFAULT_HOTEL_MAP_MARKERS, "pool")?.kind).toBe("pool")
        const reply = hotelDeskReply("where's the spa?", desk)
        expect(reply.action).toBeUndefined()
        expect(reply.text.toLowerCase()).toMatch(/spa/)
        expect(reply.text.toLowerCase()).toMatch(/marker|map|lobby/)
        expect(reply.text.toLowerCase()).not.toMatch(/turn left at the second corridor|indoor navigation/)
        const empty = hotelDeskReply("where's the spa?", {
            displayName: "Empty Inn",
            restaurants: [],
            mapMarkers: [],
            knowledge: [],
            policiesApproved: false,
        })
        expect(empty.text.toLowerCase()).toMatch(/ask reception|no map/)
        expect(empty.text.toLowerCase()).not.toMatch(/i placed the spa on level 4/)
    })
})

describe("hotel S4 language and feedback", () => {
    it("replies in the guest's language and keeps the staff ticket in English", () => {
        expect(detectGuestLanguage("The AC is broken")).toBe("en")
        expect(detectGuestLanguage("AC nahi chal raha room 101")).toBe("hi")
        expect(detectGuestLanguage("एसी खराब है")).toBe("hi")
        const hi = hotelDeskReply("AC nahi chal raha", desk)
        expect(hi.action).toMatchObject({ type: "createMaintenance", sku: "ac" })
        expect(hi.text).toMatch(/request|शिकायत|ठीक/)
        expect(/[अ-ह]/.test(hi.text) || /nahi|room|request/i.test(hi.text)).toBe(true)
        const note = staffNoteFromGuest("AC nahi chal raha", { kind: "maintenance", sku: "ac" }, "en")
        expect(note.toLowerCase()).toMatch(/air conditioning|ac/)
        expect(note).toMatch(/\[Guest hi\]/i)
        expect(note.toLowerCase()).not.toMatch(/charged|payment confirmed/)
    })

    it("routes negative stay feedback internally and never posts a Google review", () => {
        expect(feedbackRoute("negative")).toEqual({ internal: true, googleCta: false })
        expect(feedbackRoute("positive")).toEqual({ internal: true, googleCta: true })
        expect(feedbackRoute("neutral")).toEqual({ internal: true, googleCta: false })
        const poor = hotelDeskReply("the stay was disappointing", desk)
        expect(poor.action).toMatchObject({ type: "feedback", tone: "negative" })
        expect(poor.text.toLowerCase()).toMatch(/reception/)
        expect(poor.text.toLowerCase()).not.toMatch(/google\.com|posted your review/)
    })
})

describe("hotel S4 analytics, SLA, upsells", () => {
    it("summarizes real request volume, completion time, QR scans, and a handoff stub", () => {
        const now = new Date("2026-09-17T16:00:00+05:30")
        const summary = summarizeHotelAnalytics({
            now,
            requests: [
                { type: "HOUSEKEEPING", department: "HOUSEKEEPING", status: "COMPLETE", createdAt: new Date("2026-09-17T15:00:00+05:30"), updatedAt: new Date("2026-09-17T15:20:00+05:30") },
                { type: "MAINTENANCE", department: "MAINTENANCE", status: "REQUESTED", createdAt: new Date("2026-09-17T15:10:00+05:30"), updatedAt: new Date("2026-09-17T15:10:00+05:30") },
                { type: "HANDOFF", department: "RECEPTION", status: "REQUESTED", createdAt: new Date("2026-09-17T15:50:00+05:30"), updatedAt: new Date("2026-09-17T15:50:00+05:30") },
            ],
            qrs: [
                { code: "abc", label: "Room 101", kind: "ROOM", scanCount: 12 },
                { code: "prop", label: "Property", kind: "PROPERTY", scanCount: 4 },
            ],
            questions: ["wifi password", "wifi password", "where's the spa", "two towels"],
            sla: DEFAULT_HOTEL_SLA_MINUTES,
        })
        expect(summary.volumeByDepartment.HOUSEKEEPING).toBe(1)
        expect(summary.volumeByDepartment.MAINTENANCE).toBe(1)
        expect(summary.avgCompletionMinutes.HOUSEKEEPING).toBe(20)
        expect(summary.qrScansByCode[0]).toMatchObject({ label: "Room 101", scanCount: 12 })
        expect(summary.handoffRate).toBeCloseTo(1 / 3)
        expect(summary.topQuestions[0]).toEqual({ text: "wifi password", count: 2 })
        expect(summary.sla.find((row) => row.department === "MAINTENANCE")?.approaching).toBeGreaterThanOrEqual(0)
    })

    it("marks a ticket approaching SLA then breached without inventing a pager", () => {
        const now = new Date("2026-09-17T16:00:00+05:30")
        expect(slaBadge({
            department: "HOUSEKEEPING",
            status: "REQUESTED",
            createdAt: new Date("2026-09-17T15:40:00+05:30"),
        }, DEFAULT_HOTEL_SLA_MINUTES, now)).toBe("ok")
        expect(slaBadge({
            department: "HOUSEKEEPING",
            status: "REQUESTED",
            createdAt: new Date("2026-09-17T15:32:00+05:30"),
        }, DEFAULT_HOTEL_SLA_MINUTES, now)).toBe("approaching")
        expect(slaBadge({
            department: "HOUSEKEEPING",
            status: "REQUESTED",
            createdAt: new Date("2026-09-17T15:20:00+05:30"),
        }, DEFAULT_HOTEL_SLA_MINUTES, now)).toBe("breached")
        expect(slaBadge({
            department: "HOUSEKEEPING",
            status: "COMPLETE",
            createdAt: new Date("2026-09-17T15:00:00+05:30"),
        }, DEFAULT_HOTEL_SLA_MINUTES, now)).toBe("ok")
    })

    it("offers configured upsells as requests and never charges when policies are unapproved", () => {
        const spa = DEFAULT_HOTEL_UPSELLS.find((row) => row.id === "spa")
        expect(spa).toMatchObject({ kind: "spa", audience: "during", frequency: "daily" })
        expect(shouldOfferUpsell(spa!, { phase: "during", alreadyOffered: false })).toBe(true)
        expect(shouldOfferUpsell(spa!, { phase: "pre_arrival", alreadyOffered: false })).toBe(false)
        expect(shouldOfferUpsell(spa!, { phase: "during", alreadyOffered: true })).toBe(false)
        const copy = upsellCopy(spa!, false)
        expect(copy.toLowerCase()).toMatch(/request/)
        expect(copy.toLowerCase()).not.toMatch(/charged|payment confirmed|paid booking/)
        const late = hotelDeskReply("hi", { ...desk, stayPhase: "checkout" })
        expect(late.text.toLowerCase()).toMatch(/checkout|spa|transfer|request/)
        expect(late.text.toLowerCase()).not.toMatch(/i charged|payment went through/)
    })
})

describe("hotel S4 room chips and demo seed", () => {
    it("adds maintenance and emergency chips on a room QR", () => {
        const chips = hotelConciergeChips("101")
        expect(chips.map((chip) => chip.id)).toEqual(expect.arrayContaining(["maintenance", "emergency", "spa", "housekeeping"]))
        expect(chips.find((chip) => chip.id === "maintenance")?.prompt?.toLowerCase()).toMatch(/ac|tv|wifi|broken/)
        expect(chips.find((chip) => chip.id === "emergency")?.prompt?.toLowerCase()).toMatch(/emergency/)
        const property = hotelConciergeChips()
        expect(property.map((chip) => chip.id)).toEqual(expect.arrayContaining(["emergency", "housekeeping"]))
        expect(property.some((chip) => chip.id === "maintenance")).toBe(false)
    })

    it("fills Haven knowledge buckets and a map stub without inventing a restaurant", () => {
        expect(TRY_HOTEL.slug).toBe("try-hotel")
        expect(TRY_HOTEL_S3.stayToken).toBe("haven-demo")
        expect(TRY_HOTEL_S4.knowledgeBuckets).toEqual(HOTEL_KNOWLEDGE_BUCKETS)
        expect(TRY_HOTEL_S4.mapMarkerKinds).toEqual(expect.arrayContaining(["reception", "spa", "pool", "restaurant"]))
        const plan = tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "HOTEL" },
            rooms: ["101", "102", "103"],
            propertyQr: true,
            roomQrs: ["101", "102", "103"],
            linkedRestaurantSlug: "littlehours",
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
            services: [...TRY_HOTEL_S3.services],
            stayToken: "haven-demo",
            knowledgeBuckets: [],
            mapMarkerCount: 0,
        })
        expect(plan.needKnowledge).toBe(true)
        expect(plan.needMap).toBe(true)
        expect(plan.connectRestaurant).toBeNull()
        const done = tryHotelSeedActions({
            profile: { slug: "try-hotel", roleTemplate: "HOTEL" },
            rooms: ["101", "102", "103"],
            propertyQr: true,
            roomQrs: ["101", "102", "103"],
            linkedRestaurantSlug: "littlehours",
            availableRestaurants: [{ slug: "littlehours", roleTemplate: "RESTAURANT", isPublic: true }],
            services: [...TRY_HOTEL_S3.services],
            stayToken: "haven-demo",
            knowledgeBuckets: [...HOTEL_KNOWLEDGE_BUCKETS],
            mapMarkerCount: 4,
        })
        expect(done.needKnowledge).toBe(false)
        expect(done.needMap).toBe(false)
    })
})
