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
})
