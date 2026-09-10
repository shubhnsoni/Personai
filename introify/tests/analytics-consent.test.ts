// @vitest-environment node
import { describe, expect, it } from "vitest"
import { analyticsAllowed, readAnalyticsConsent, writeAnalyticsConsent } from "@/lib/analytics-consent"

function memoryStore() {
    const data = new Map<string, string>()
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value) },
        removeItem: (key: string) => { data.delete(key) },
    }
}

describe("analytics cookie preference", () => {
    it("fails closed until the visitor grants analytics", () => {
        const storage = memoryStore()
        expect(readAnalyticsConsent(storage)).toBeNull()
        expect(analyticsAllowed(null)).toBe(false)
        expect(analyticsAllowed("denied")).toBe(false)
        expect(analyticsAllowed("granted")).toBe(true)
    })

    it("round-trips a choice without restoring after expiry", () => {
        const storage = memoryStore()
        writeAnalyticsConsent(storage, "granted", 1_000)
        expect(readAnalyticsConsent(storage, 1_000)).toBe("granted")
        expect(readAnalyticsConsent(storage, 1_000 + 181 * 86400_000)).toBeNull()
        writeAnalyticsConsent(storage, "denied", 2_000)
        expect(readAnalyticsConsent(storage, 2_000)).toBe("denied")
    })
})
