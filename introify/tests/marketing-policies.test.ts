// @vitest-environment node
import { describe, expect, it } from "vitest"
import { policyDocuments } from "@/lib/marketing-policies"

describe("policy wording for implemented controls", () => {
    it("describes the live analytics consent control instead of claiming it is missing", () => {
        const activity = policyDocuments.privacy.sections.find((section) => section.id === "activity")
        const text = (activity?.paragraphs || []).join(" ")
        expect(text).not.toMatch(/not yet implemented/i)
        expect(text).toMatch(/cookie policy/i)
        expect(text).toMatch(/allow analytics|analytics cookies stay off/i)
    })

    it("separates renewal cancellation from refunding a completed payment", () => {
        const cancellation = policyDocuments.refundPolicy.sections.find(section => section.id === "cancel")
        const text = cancellation?.paragraphs?.join(" ") || ""
        expect(text).toContain("Dashboard → Billing")
        expect(text).toContain("Turn off renewal")
        expect(text).toMatch(/continue until the end of the paid period/)
        expect(text).toMatch(/does not automatically refund/)
    })

    it("keeps unapproved refund deadlines unset and preserves consumer rights", () => {
        const status = policyDocuments.refundPolicy.sections.find(section => section.id === "status")
        expect(status?.fields?.filter(field => /window|processing/i.test(field.label)).every(field => field.value === "")).toBe(true)
        expect(status?.paragraphs?.join(" ")).toMatch(/Blank fields do not mean all sales are final/)
        expect(policyDocuments.refundPolicy.draft).toBe(true)
    })

    it("connects purchase policies through stable public links and unique section anchors", () => {
        expect(policyDocuments.terms.relatedLinks).toContainEqual({ label: "Refund and cancellation policy", href: "/refund-policy" })
        expect(policyDocuments.refundPolicy.relatedLinks).toContainEqual({ label: "Terms and conditions", href: "/terms" })
        for (const policy of [policyDocuments.terms, policyDocuments.refundPolicy]) {
            const ids = policy.sections.map(section => section.id)
            expect(new Set(ids).size).toBe(ids.length)
        }
    })
})
