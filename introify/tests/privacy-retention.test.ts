// @vitest-environment node
import { describe, expect, it } from "vitest"
import { expiredRecordIds, OPERATIONAL_RETENTION_DAYS, privacyRequestRecord } from "@/lib/privacy/retention"

describe("privacy retention and requests", () => {
    it("does not invent an approved legal schedule, only operational analytics expiry", () => {
        expect(OPERATIONAL_RETENTION_DAYS.analyticsEvents).toBe(180)
        expect(OPERATIONAL_RETENTION_DAYS.accounts).toBeNull()
        expect(OPERATIONAL_RETENTION_DAYS.chats).toBeNull()
        expect(OPERATIONAL_RETENTION_DAYS.backups).toBeNull()
    })

    it("selects only analytics rows older than the operational window", () => {
        const now = new Date("2026-09-10T00:00:00.000Z")
        const ids = expiredRecordIds([
            { id: "keep", createdAt: new Date("2026-08-01T00:00:00.000Z") },
            { id: "drop", createdAt: new Date("2026-01-01T00:00:00.000Z") },
        ], OPERATIONAL_RETENTION_DAYS.analyticsEvents!, now)
        expect(ids).toEqual(["drop"])
    })

    it("records access, correction and deletion requests without assigning an owner", () => {
        const request = privacyRequestRecord({
            email: "ada@example.test",
            kind: "DELETION",
            note: "Please remove my chats",
            at: new Date("2026-09-10T00:00:00.000Z"),
        })
        expect(request).toMatchObject({
            kind: "DELETION",
            email: "ada@example.test",
            status: "OPEN",
            owner: null,
        })
        expect(request.action).toBe("privacy_request")
    })
})
