import { describe, expect, it } from "vitest"
import { guestDeskReply } from "@/lib/chat-fallback"

const neal = {
    displayName: "Nilesh Kumar",
    headline: "Sales & Operations Leader | Deel | Ex-Razorpay",
    bio: "Nilesh Kumar is a Sales & Revenue Operations leader at Deel in Bengaluru.\n\nWith over a decade across sales and operations.",
}

describe("guest desk reply", () => {
    it("greets without asking for email", () => {
        expect(guestDeskReply("Hi", neal)).toMatch(/Hi —/)
        expect(guestDeskReply("Hi", neal)).not.toMatch(/share your name and email/)
    })
    it("answers where Nilesh is from from the bio", () => {
        expect(guestDeskReply("Where is nilesh from", neal)).toBe("Nilesh Kumar is based in Bengaluru, Karnataka, India.")
    })
})
