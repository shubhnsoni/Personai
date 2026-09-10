export type AnalyticsConsent = "granted" | "denied"
export type KeyValueStore = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem?(key: string): void
}

export const ANALYTICS_CONSENT_KEY = "pl_analytics_consent"
export const ANALYTICS_CONSENT_DAYS = 180
const TTL_MS = ANALYTICS_CONSENT_DAYS * 24 * 60 * 60 * 1000

type Stored = { v: 1; choice: AnalyticsConsent; at: number }

export function analyticsAllowed(choice: AnalyticsConsent | null | undefined): boolean {
    return choice === "granted"
}

export function readAnalyticsConsent(storage: KeyValueStore, now = Date.now()): AnalyticsConsent | null {
    const raw = storage.getItem(ANALYTICS_CONSENT_KEY)
    if (!raw) return null
    try {
        const stored = JSON.parse(raw) as Stored
        if (stored?.v !== 1 || (stored.choice !== "granted" && stored.choice !== "denied")) return null
        if (!Number.isFinite(stored.at) || now - stored.at > TTL_MS) {
            storage.removeItem?.(ANALYTICS_CONSENT_KEY)
            return null
        }
        return stored.choice
    } catch {
        return null
    }
}

export function writeAnalyticsConsent(storage: KeyValueStore, choice: AnalyticsConsent, now = Date.now()) {
    const stored: Stored = { v: 1, choice, at: now }
    storage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(stored))
}
