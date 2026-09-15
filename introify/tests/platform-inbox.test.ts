import { describe, expect, it } from "vitest"
import { parseInquiryInput, validEmail } from "@/lib/platform-inbox-parse"

describe("platform waitlist and contact intake", () => {
    it("accepts a waitlist email and drops honeypot spam silently", () => {
        expect(parseInquiryInput({ kind: "WAITLIST", email: "maya@example.com", plan: "pro" })).toMatchObject({
            email: "maya@example.com",
            plan: "pro",
        })
        expect(parseInquiryInput({ kind: "WAITLIST", email: "maya@example.com", honeypot: "http://spam.test" })).toEqual({ spam: true })
        expect(validEmail("not-an-email")).toBe(false)
    })

    it("requires a real message for contact and never invents a refund promise", () => {
        expect(parseInquiryInput({ kind: "CONTACT", email: "maya@example.com", message: "hi" })).toEqual({
            error: "Write a short message so we know how to help.",
        })
        const ok = parseInquiryInput({ kind: "CONTACT", email: "Maya@Example.com", name: "Maya", message: "The demo page will not load on my phone." })
        expect(ok).toMatchObject({ email: "maya@example.com", name: "Maya" })
        expect(JSON.stringify(ok)).not.toMatch(/refund/i)
    })
})
