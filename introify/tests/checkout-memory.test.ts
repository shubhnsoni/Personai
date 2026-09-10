// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readBuyerMemory, writeBuyerMemory } from "@/lib/checkout-memory"

function memoryStore(seed?: Record<string, string>) {
    const data = new Map<string, string>(Object.entries(seed || {}))
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value) },
        removeItem: (key: string) => { data.delete(key) },
    }
}

describe("checkout buyer memory", () => {
    it("expires saved name and email instead of keeping them forever", () => {
        const storage = memoryStore()
        writeBuyerMemory(storage, { name: "Ada", email: "ada@example.test" }, 1_000)
        expect(readBuyerMemory(storage, 1_000)).toEqual({ name: "Ada", email: "ada@example.test" })
        expect(readBuyerMemory(storage, 1_000 + 31 * 86400_000)).toBeNull()
    })

    it("ignores legacy keys that have no expiry", () => {
        const storage = memoryStore({
            pl_buyer_name: "Ada",
            pl_buyer_email: "ada@example.test",
        })
        expect(readBuyerMemory(storage, Date.now())).toBeNull()
    })
})
