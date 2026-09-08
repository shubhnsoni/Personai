import { describe, expect, it } from "vitest"
import { COPY, filterKitChips, normalizeWhatsapp, splitSpeaker } from "@/lib/onboarding-chat"

describe("onboarding-chat helpers", () => {
    it("locks CEO name copy", () => {
        expect(COPY.name.h).toBe("What's your business called?")
    })

    it("normalizes Indian WhatsApp numbers", () => {
        expect(normalizeWhatsapp("9876543210")).toBe("9876543210")
        expect(normalizeWhatsapp("+91 98765 43210")).toBe("9876543210")
        expect(normalizeWhatsapp("12")).toBeNull()
    })

    it("filters kit chips by typed query", () => {
        expect(filterKitChips("gold").map((k) => k.id)).toEqual(["goldWholesale"])
        expect(filterKitChips("").length).toBe(4)
    })

    it("splits speaker name and role", () => {
        expect(splitSpeaker("Ayoub · Owner")).toEqual({ name: "Ayoub", role: "Owner" })
    })
})
