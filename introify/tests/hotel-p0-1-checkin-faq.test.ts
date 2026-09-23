import { describe, expect, it } from "vitest"
import {
    hotelDeskReply,
    isExplicitHotelCheckoutRequest,
    isHotelStayTimesFaq,
    parseHotelGuestIntent,
    type HotelDeskContext,
} from "@/lib/hotels"

const desk: HotelDeskContext = {
    displayName: "Haven Hinoo",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    wifiName: "haven-guest",
    wifiPassword: "haven-hinoo",
    restaurants: [],
    roomNumber: "101",
}

describe("hotel P0-1 check-in/checkout FAQ vs checkout request", () => {
    it("classifies time/FAQ wording as stay_times, not checkout", () => {
        const faqs = [
            "What time is check-in?",
            "When is checkout?",
            "What time is check-in and checkout at Haven Hinoo?",
            "checkout time",
            "check-in time please",
        ]
        for (const q of faqs) {
            expect(isHotelStayTimesFaq(q), q).toBe(true)
            expect(parseHotelGuestIntent(q).kind, q).toBe("stay_times")
            expect(isExplicitHotelCheckoutRequest(q), q).toBe(false)
        }
    })

    it("answers FAQ with property times and never opens a checkout action/card", () => {
        for (const q of [
            "What time is check-in?",
            "When is checkout?",
            "What time is check-in and checkout at Haven Hinoo?",
        ]) {
            const reply = hotelDeskReply(q, desk)
            expect(reply.action, q).toBeUndefined()
            expect(reply.text, q).toMatch(/14:00/)
            expect(reply.text, q).toMatch(/11:00/)
            expect(reply.text.toLowerCase(), q).not.toMatch(/i'?ll file a checkout request/)
            expect(reply.text, q).not.toMatch(/"type":"checkout"/)
            expect(reply.text, q).not.toMatch(/HOTEL_CARD:[^\n]*checkout/)
        }
    })

    it("says not configured when property times are missing", () => {
        const reply = hotelDeskReply("What time is check-in and checkout?", {
            ...desk,
            checkInTime: null,
            checkOutTime: null,
        })
        expect(reply.action).toBeUndefined()
        expect(reply.text.toLowerCase()).toMatch(/not configured/)
        expect(reply.text).not.toMatch(/14:00|11:00/)
    })

    it("keeps explicit checkout request flow", () => {
        const explicit = [
            "Please check me out of room 101",
            "please check me out",
            "file a checkout",
            "file checkout",
            "we are checking out of room 101",
            "ready to checkout",
            "Ready to checkout of room 101",
        ]
        for (const q of explicit) {
            expect(isExplicitHotelCheckoutRequest(q), q).toBe(true)
            expect(isHotelStayTimesFaq(q), q).toBe(false)
            expect(parseHotelGuestIntent(q).kind, q).toBe("checkout")
        }
        const reply = hotelDeskReply("Please check me out of room 101", desk)
        expect(reply.action).toEqual({ type: "checkout", roomNumber: "101" })
        expect(reply.text.toLowerCase()).toMatch(/checkout request/)
        expect(reply.text.toLowerCase()).toMatch(/does not close a bill|charge a card/)
    })

    it("does not break late checkout or housekeeping", () => {
        expect(parseHotelGuestIntent("late checkout please").kind).toBe("late_checkout")
        expect(parseHotelGuestIntent("two towels room 111").kind).toBe("housekeeping")
        const late = hotelDeskReply("late checkout please", desk)
        expect(late.action).toEqual({ type: "lateCheckout" })
    })
})
