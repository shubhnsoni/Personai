import { describe, expect, it } from "vitest"
import { wantsLiveSupport } from "@/lib/live-support"

describe("wantsLiveSupport", () => {
    it("matches live-chat and support phrases", () => {
        expect(wantsLiveSupport("I need live chat")).toBe(true)
        expect(wantsLiveSupport("live chat support please")).toBe(true)
        expect(wantsLiveSupport("Can I talk to a human?")).toBe(true)
        expect(wantsLiveSupport("customer support")).toBe(true)
        expect(wantsLiveSupport("speak to someone")).toBe(true)
        expect(wantsLiveSupport("urgent support")).toBe(true)
    })

    it("ignores ordinary chat", () => {
        expect(wantsLiveSupport("what is 22K gold")).toBe(false)
        expect(wantsLiveSupport("help me pick a bangle")).toBe(false)
        expect(wantsLiveSupport("")).toBe(false)
    })
})
