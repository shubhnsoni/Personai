// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    ASSISTANT_PENDING_DWELL_MS,
    ASSISTANT_PENDING_ESCALATION_MS,
    ASSISTANT_PENDING_ESCALATION_PHRASE,
    ASSISTANT_PENDING_LONG_WAIT_MS,
    ASSISTANT_PENDING_LONG_WAIT_PHRASE,
    ASSISTANT_PENDING_PHRASES,
    ASSISTANT_PENDING_TICK_MS,
    assistantPendingElapsedLabel,
    assistantPendingPhrase,
    typingInputGaze,
} from "@/lib/chat-gaze"

describe("HOTEL P1-6 — chat pending dwell + honest copy", () => {
    it("shortens phrase dwell so a long wait rotates (not stuck ~9s on one line)", () => {
        expect(ASSISTANT_PENDING_DWELL_MS).toBeLessThanOrEqual(3000)
        expect(ASSISTANT_PENDING_DWELL_MS).toBeGreaterThanOrEqual(1500)
        expect(ASSISTANT_PENDING_TICK_MS).toBeLessThanOrEqual(ASSISTANT_PENDING_DWELL_MS)
        expect(ASSISTANT_PENDING_TICK_MS).toBeGreaterThan(0)
    })

    it("never uses hung-looking jargon as the sole long-dwell stack", () => {
        const banned = [/indexing knowledge/i, /parsing context/i, /tracing sources/i, /buffering tokens/i, /grounding answer/i]
        for (const phrase of ASSISTANT_PENDING_PHRASES) {
            for (const re of banned) {
                expect(phrase, phrase).not.toMatch(re)
            }
        }
        expect(ASSISTANT_PENDING_PHRASES.join(" ")).toMatch(/looking that up|property notes|guest info|almost ready/i)
        // Sample across a 25s wait — no banned jargon appears as the status line.
        for (const t of [0, 2500, 5000, 7999, 8000, 12000, 15000, 25000]) {
            const line = assistantPendingPhrase("Haven Hinoo", t)
            for (const re of banned) {
                expect(line, `t=${t}`).not.toMatch(re)
            }
        }
    })

    it("rotates guest-honest phrases on the short dwell before escalation", () => {
        expect(assistantPendingPhrase("Haven", 0)).toBe(ASSISTANT_PENDING_PHRASES[0])
        expect(assistantPendingPhrase("Haven", ASSISTANT_PENDING_DWELL_MS - 1)).toBe(ASSISTANT_PENDING_PHRASES[0])
        expect(assistantPendingPhrase("Haven", ASSISTANT_PENDING_DWELL_MS)).toBe(ASSISTANT_PENDING_PHRASES[1])
        expect(assistantPendingPhrase("Haven", ASSISTANT_PENDING_DWELL_MS * 2)).toBe(ASSISTANT_PENDING_PHRASES[2])
        // Within ~7.5s a guest sees multiple phrases (was frozen on Indexing for 8.6s).
        const seen = new Set(
            [0, 2500, 5000, 7500].map((t) => assistantPendingPhrase("Haven", t)),
        )
        expect(seen.size).toBeGreaterThanOrEqual(3)
    })

    it("escalates honestly after ~8s and again after ~15s", () => {
        expect(ASSISTANT_PENDING_ESCALATION_MS).toBe(8000)
        expect(ASSISTANT_PENDING_LONG_WAIT_MS).toBe(15000)
        expect(assistantPendingPhrase("Haven", ASSISTANT_PENDING_ESCALATION_MS - 1)).not.toBe(
            ASSISTANT_PENDING_ESCALATION_PHRASE,
        )
        expect(assistantPendingPhrase("Haven", ASSISTANT_PENDING_ESCALATION_MS)).toBe(
            ASSISTANT_PENDING_ESCALATION_PHRASE,
        )
        expect(assistantPendingPhrase("Haven", 12000)).toBe(ASSISTANT_PENDING_ESCALATION_PHRASE)
        expect(assistantPendingPhrase("Haven", ASSISTANT_PENDING_LONG_WAIT_MS)).toBe(
            ASSISTANT_PENDING_LONG_WAIT_PHRASE,
        )
        expect(assistantPendingPhrase("Haven", 30000)).toBe(ASSISTANT_PENDING_LONG_WAIT_PHRASE)
        expect(ASSISTANT_PENDING_ESCALATION_PHRASE).toMatch(/still working|almost there/i)
        expect(ASSISTANT_PENDING_LONG_WAIT_PHRASE).toMatch(/longer|hang tight/i)
    })

    it("exposes a lightweight elapsed label after a few seconds", () => {
        expect(assistantPendingElapsedLabel(0)).toBeNull()
        expect(assistantPendingElapsedLabel(2999)).toBeNull()
        expect(assistantPendingElapsedLabel(3000)).toBe("3s")
        expect(assistantPendingElapsedLabel(12500)).toBe("12s")
    })

    it("keeps typing gaze helper unchanged for composer focus", () => {
        expect(typingInputGaze(0, false)).toBeNull()
        const empty = typingInputGaze(0, true)
        const full = typingInputGaze(28, true)
        expect(empty?.y).toBeLessThan(0)
        expect(full!.x).toBeGreaterThan(empty!.x)
    })
})
