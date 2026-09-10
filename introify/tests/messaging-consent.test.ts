// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    applyDeliveryCallback,
    isSuppressed,
    recordMessagingChoice,
    signMessagingCallback,
    verifyMessagingCallback,
} from "@/lib/messaging/consent"

describe("SMS and WhatsApp consent scaffolding", () => {
    it("records consent, honours withdrawal, and never claims a live send", () => {
        let records = recordMessagingChoice([], {
            recipient: "+15551212",
            channel: "SMS",
            purpose: "appointment-reminder",
            granted: true,
            templateVersion: "v1",
            at: new Date("2026-09-10T00:00:00.000Z"),
        })
        expect(isSuppressed(records, "+15551212", "SMS")).toBe(false)
        records = recordMessagingChoice(records, {
            recipient: "+15551212",
            channel: "SMS",
            purpose: "appointment-reminder",
            granted: false,
            templateVersion: "v1",
            at: new Date("2026-09-11T00:00:00.000Z"),
        })
        expect(isSuppressed(records, "+15551212", "SMS")).toBe(true)
        expect(isSuppressed(records, "+15551212", "WHATSAPP")).toBe(false)
    })

    it("accepts only authenticated delivery callbacks and does not send messages", () => {
        const body = JSON.stringify({ providerMessageId: "m1", status: "delivered" })
        const secret = "callback-secret"
        const token = signMessagingCallback(body, secret)
        expect(verifyMessagingCallback(body, token, secret)).toBe(true)
        expect(verifyMessagingCallback(body, "bad", secret)).toBe(false)
        expect(applyDeliveryCallback({ status: "delivered" })).toEqual({ recorded: true, sent: false })
    })
})
