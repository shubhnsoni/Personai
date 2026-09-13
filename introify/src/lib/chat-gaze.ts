export function typingInputGaze(length: number, focused: boolean): { x: number; y: number } | null {
    if (!focused && length <= 0) return null
    const x = length <= 0
        ? -0.72
        : Math.min(0.92, -0.78 + (Math.min(length, 28) / 28) * 1.7)
    return { x, y: -0.92 }
}

export const ASSISTANT_PENDING_DWELL_MS = 8600

export const ASSISTANT_PENDING_PHRASES = [
    "Parsing context",
    "Indexing knowledge",
    "Tracing sources",
    "Compiling reply",
    "Reasoning quietly",
    "Aligning facts",
    "Buffering tokens",
    "Grounding answer",
] as const

export function assistantPendingPhrase(_name: string, nowMs: number): string {
    const index = Math.floor(Math.max(0, nowMs) / ASSISTANT_PENDING_DWELL_MS) % ASSISTANT_PENDING_PHRASES.length
    return ASSISTANT_PENDING_PHRASES[index]
}
