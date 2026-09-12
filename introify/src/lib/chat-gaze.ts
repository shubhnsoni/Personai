export function typingInputGaze(length: number, focused: boolean): { x: number; y: number } | null {
    if (!focused && length <= 0) return null
    const x = length <= 0
        ? -0.72
        : Math.min(0.92, -0.78 + (Math.min(length, 28) / 28) * 1.7)
    return { x, y: -0.92 }
}

export const ASSISTANT_PENDING_DWELL_MS = 5200

export function assistantPendingPhrase(name: string, nowMs: number): string {
    const host = name.trim() || "them"
    const phrases = [
        "thinking this through carefully",
        "reading your message in full",
        "checking the details on the desk",
        "asking around so this is accurate",
        `talking this over with ${host}`,
        "putting a clear reply together now",
    ]
    return phrases[Math.floor(Math.max(0, nowMs) / ASSISTANT_PENDING_DWELL_MS) % phrases.length]
}
