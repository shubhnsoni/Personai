export function typingInputGaze(length: number, focused: boolean): { x: number; y: number } | null {
    if (!focused && length <= 0) return null
    const x = length <= 0
        ? -0.72
        : Math.min(0.92, -0.78 + (Math.min(length, 28) / 28) * 1.7)
    return { x, y: -0.92 }
}
