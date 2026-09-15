import { describe, expect, it } from "vitest"
import {
    canReviewOrder,
    hireLanguage,
    jobCheckoutOpen,
    maturityLabel,
    orderResolution,
    splitJobPrice,
    trialAllowsMessage,
} from "@/lib/workspace-economy"

describe("Phase 2 job economy", () => {
    it("splits pay-per-job with a 15% platform fee and never implies ownership", () => {
        expect(splitJobPrice(49900)).toEqual({ priceCents: 49900, feeCents: 7485, creatorCents: 42415 })
        expect(hireLanguage()).toMatch(/hire|run job|purchase job/i)
        expect(hireLanguage()).not.toMatch(/buy this ai/i)
    })

    it("keeps paid checkout closed until platform billing is actually available", () => {
        expect(jobCheckoutOpen()).toBe(false)
    })

    it("limits chat previews and only lets completed buyers review", () => {
        expect(trialAllowsMessage("CHAT", 2)).toBe(true)
        expect(trialAllowsMessage("CHAT", 3)).toBe(false)
        expect(trialAllowsMessage("NONE", 0)).toBe(false)
        expect(canReviewOrder({ status: "completed", buyerProfileId: "b1" }, "b1")).toBe(true)
        expect(canReviewOrder({ status: "paid", buyerProfileId: "b1" }, "b1")).toBe(false)
    })

    it("resolves failed paid jobs to a refund without a side negotiation", () => {
        expect(orderResolution("failed")).toBe("refund")
        expect(orderResolution("completed")).toBe("keep")
        expect(orderResolution("cancelled")).toBe("refund")
    })
})

describe("Phase 4 maturity", () => {
    it("maps completed jobs to restrained labels, not XP levels", () => {
        expect(maturityLabel(0)).toBe("New")
        expect(maturityLabel(12)).toBe("Established")
        expect(maturityLabel(80)).toBe("Experienced")
        expect(maturityLabel(400)).toBe("Expert")
        expect(maturityLabel(2000)).toBe("Highly proven")
        expect(maturityLabel(2000)).not.toMatch(/level|xp|master bot/i)
    })
})
