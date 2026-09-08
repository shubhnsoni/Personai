import { describe, expect, it } from "vitest"
import { demoteBlockReason, isAdminEmail } from "@/lib/admin/allowlist"
import { loadBand, suggestedTier } from "@/lib/admin/capacity"
import { formatAdminMoney, shopPipeline } from "@/lib/admin/money"

describe("admin money helpers", () => {
    it("formats INR without a currency prefix clutter", () => {
        expect(formatAdminMoney(125000, "INR")).toContain("₹")
        expect(formatAdminMoney(199, "USD")).toBe("USD 1.99")
    })

    it("classifies shop pipeline stages", () => {
        expect(shopPipeline({
            isPublic: false, setupPending: 2, sessions7d: 0, chats: 0, paid7d: 0, paid14d: 0,
        })).toBe("signed-up")
        expect(shopPipeline({
            isPublic: true, setupPending: 0, sessions7d: 0, chats: 0, paid7d: 0, paid14d: 0,
        })).toBe("silent")
        expect(shopPipeline({
            isPublic: true, setupPending: 0, sessions7d: 12, chats: 0, paid7d: 0, paid14d: 0,
        })).toBe("no-chat")
        expect(shopPipeline({
            isPublic: true, setupPending: 0, sessions7d: 12, chats: 3, paid7d: 2, paid14d: 2,
        })).toBe("selling")
        expect(shopPipeline({
            isPublic: true, setupPending: 0, sessions7d: 1, chats: 1, paid7d: 0, paid14d: 4,
        })).toBe("dormant")
        expect(shopPipeline({
            isPublic: true, suspendedAt: new Date(), setupPending: 0, sessions7d: 0, chats: 0, paid7d: 0, paid14d: 0,
        })).toBe("suspended")
    })
})

describe("capacity bands", () => {
    it("stays ok on a quiet box", () => {
        expect(loadBand({ liveVisitors: 3, llmP95Ms: 800, dbMs: 12, pollQps: 0.4 })).toBe("ok")
    })

    it("goes warm on festival traffic or slow db", () => {
        expect(loadBand({ liveVisitors: 80, llmP95Ms: 900, dbMs: 20, pollQps: 2 })).toBe("warm")
        expect(loadBand({ liveVisitors: 10, llmP95Ms: 500, dbMs: 90, pollQps: 1 })).toBe("warm")
        expect(loadBand({ liveVisitors: 10, llmP95Ms: 500, dbMs: 20, pollQps: 25 })).toBe("warm")
    })

    it("goes hot when visitors or db blow up", () => {
        expect(loadBand({ liveVisitors: 250, llmP95Ms: 900, dbMs: 20, pollQps: 5 })).toBe("hot")
        expect(loadBand({ liveVisitors: 10, llmP95Ms: 900, dbMs: 250, pollQps: 1 })).toBe("hot")
        expect(loadBand({ liveVisitors: 10, llmP95Ms: 9000, dbMs: 20, pollQps: 1 })).toBe("hot")
    })

    it("maps bands to suggested tiers", () => {
        expect(suggestedTier("hot")).toBe("hot")
        expect(suggestedTier("warm")).toBe("warm")
    })
})

describe("demote rules", () => {
    it("blocks ADMIN_EMAILS, self, and the last admin", () => {
        const prev = process.env.ADMIN_EMAILS
        process.env.ADMIN_EMAILS = "ops@example.com"
        expect(isAdminEmail("ops@example.com")).toBe(true)
        expect(demoteBlockReason({
            actorId: "a1",
            target: { id: "t1", email: "ops@example.com", role: "ADMIN" },
            adminCount: 3,
        })).toMatch(/ADMIN_EMAILS/)
        expect(demoteBlockReason({
            actorId: "a1",
            target: { id: "a1", email: "other@example.com", role: "ADMIN" },
            adminCount: 3,
        })).toMatch(/yourself/)
        expect(demoteBlockReason({
            actorId: "a1",
            target: { id: "t2", email: "other@example.com", role: "ADMIN" },
            adminCount: 1,
        })).toMatch(/at least one admin/)
        expect(demoteBlockReason({
            actorId: "a1",
            target: { id: "t2", email: "other@example.com", role: "ADMIN" },
            adminCount: 2,
        })).toBeNull()
        if (prev === undefined) delete process.env.ADMIN_EMAILS
        else process.env.ADMIN_EMAILS = prev
    })
})
