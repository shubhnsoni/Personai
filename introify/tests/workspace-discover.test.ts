import { describe, expect, it } from "vitest"
import { matchesOutcome, publicSignals, rankingScore } from "@/lib/workspace-discover"

describe("Phase 4 discovery", () => {
    it("matches outcome language instead of model names", () => {
        const ani = { name: "ANI", purpose: "Logo motion", description: "Three premium directions", jobs: ["3 logo motion directions"] }
        expect(matchesOutcome("animate my logo", ani)).toBe(true)
        expect(matchesOutcome("gpt claude gemini", ani)).toBe(false)
    })

    it("ranks completed work above vanity", () => {
        const proven = rankingScore({ completed: 80, rating: 4.9, repeats: 20, refunds: 1 })
        const noisy = rankingScore({ completed: 2, rating: 5, repeats: 0, refunds: 0 })
        expect(proven).toBeGreaterThan(noisy)
    })

    it("publishes only interpretable signals", () => {
        const signals = publicSignals({ createdAt: new Date(Date.now() - 14 * 86400000), completed: 12, rating: 4.8 })
        expect(signals.maturity).toBe("Established")
        expect(signals.activeFor).toMatch(/14 days/)
        expect(JSON.stringify(signals)).not.toMatch(/token|xp|level 72/i)
    })
})
