export function typingInputGaze(length: number, focused: boolean): { x: number; y: number } | null {
    if (!focused && length <= 0) return null
    const x = length <= 0
        ? -0.72
        : Math.min(0.92, -0.78 + (Math.min(length, 28) / 28) * 1.7)
    return { x, y: -0.92 }
}

/** How long each rotating pending phrase stays visible (HOTEL P1-6: was 8600). */
export const ASSISTANT_PENDING_DWELL_MS = 2500

/** UI tick for elapsed seconds + escalation (PendingStatus interval). */
export const ASSISTANT_PENDING_TICK_MS = 500

/** After this, escalate to an honest "still working" line. */
export const ASSISTANT_PENDING_ESCALATION_MS = 8000

/** After this, escalate again so a 20–30s wait never looks frozen. */
export const ASSISTANT_PENDING_LONG_WAIT_MS = 15000

/** Guest-honest rotating copy — no "Indexing knowledge" / jargon stack. */
export const ASSISTANT_PENDING_PHRASES = [
    "Looking that up…",
    "Checking property notes…",
    "Pulling guest info…",
    "Almost ready…",
] as const

export const ASSISTANT_PENDING_ESCALATION_PHRASE = "Still working — almost there…"
export const ASSISTANT_PENDING_LONG_WAIT_PHRASE = "Taking a bit longer — hang tight…"

/**
 * Pending status line for the assistant bubble.
 * Rotates guest-honest phrases on a short dwell, then escalates by elapsed time
 * so a slow grounded reply never looks stuck on one jargon label.
 */
export function assistantPendingPhrase(_name: string, nowMs: number): string {
    const elapsed = Math.max(0, nowMs)
    if (elapsed >= ASSISTANT_PENDING_LONG_WAIT_MS) {
        return ASSISTANT_PENDING_LONG_WAIT_PHRASE
    }
    if (elapsed >= ASSISTANT_PENDING_ESCALATION_MS) {
        return ASSISTANT_PENDING_ESCALATION_PHRASE
    }
    const index = Math.floor(elapsed / ASSISTANT_PENDING_DWELL_MS) % ASSISTANT_PENDING_PHRASES.length
    return ASSISTANT_PENDING_PHRASES[index]
}

/** Lightweight elapsed label once the wait is noticeable (≥3s). */
export function assistantPendingElapsedLabel(nowMs: number): string | null {
    const secs = Math.floor(Math.max(0, nowMs) / 1000)
    if (secs < 3) return null
    return `${secs}s`
}
