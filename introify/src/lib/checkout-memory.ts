export type KeyValueStore = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem?(key: string): void
}

export const BUYER_MEMORY_KEY = "pl_buyer"
export const BUYER_MEMORY_DAYS = 30
const TTL_MS = BUYER_MEMORY_DAYS * 24 * 60 * 60 * 1000

export type BuyerMemory = { name: string; email: string }
type Stored = { v: 1; name: string; email: string; at: number }

export function readBuyerMemory(storage: KeyValueStore, now = Date.now()): BuyerMemory | null {
    const raw = storage.getItem(BUYER_MEMORY_KEY)
    if (!raw) return null
    try {
        const stored = JSON.parse(raw) as Stored
        if (stored?.v !== 1 || typeof stored.name !== "string" || typeof stored.email !== "string") return null
        if (!Number.isFinite(stored.at) || now - stored.at > TTL_MS) {
            storage.removeItem?.(BUYER_MEMORY_KEY)
            return null
        }
        return { name: stored.name, email: stored.email }
    } catch {
        return null
    }
}

export function writeBuyerMemory(storage: KeyValueStore, buyer: BuyerMemory, now = Date.now()) {
    const stored: Stored = { v: 1, name: buyer.name, email: buyer.email, at: now }
    storage.setItem(BUYER_MEMORY_KEY, JSON.stringify(stored))
    storage.removeItem?.("pl_buyer_name")
    storage.removeItem?.("pl_buyer_email")
}
