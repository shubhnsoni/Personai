// @vitest-environment node
import { describe, expect, it } from "vitest"
import { emailCanSend, unconfiguredEmailLog } from "@/lib/email"

describe("email delivery safety", () => {
    it("does not treat a missing or placeholder key as a working sender", () => {
        expect(emailCanSend(undefined)).toBe(false)
        expect(emailCanSend("")).toBe(false)
        expect(emailCanSend("placeholder")).toBe(false)
        expect(emailCanSend("re_live_abcdefghijklmnopqrstuv")).toBe(true)
    })

    it("refuses delivery and omits message bodies when the sender is unconfigured", () => {
        const result = unconfiguredEmailLog({ to: "buyer@example.test", subject: "Purchase", html: "<p>secret</p>", text: "secret" })
        expect(result.sent).toBe(false)
        expect(JSON.stringify(result.log)).not.toMatch(/secret/)
        expect(result.log).toMatchObject({ to: "buyer@example.test", subject: "Purchase" })
    })
})
