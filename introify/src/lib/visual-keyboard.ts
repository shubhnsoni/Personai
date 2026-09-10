/** Inset (layout viewport minus visual viewport) that means the software keyboard is open. */
export const VISUAL_KEYBOARD_INSET = 120

export function visualKeyboardOpen() {
    if (typeof window === "undefined") return false
    const viewport = window.visualViewport
    if (!viewport || viewport.scale !== 1) return false
    return window.innerHeight - viewport.height > VISUAL_KEYBOARD_INSET
}

export function subscribeVisualKeyboard(onChange: () => void) {
    if (typeof window === "undefined") return () => {}
    const viewport = window.visualViewport
    viewport?.addEventListener("resize", onChange)
    viewport?.addEventListener("scroll", onChange)
    window.addEventListener("resize", onChange)
    return () => {
        viewport?.removeEventListener("resize", onChange)
        viewport?.removeEventListener("scroll", onChange)
        window.removeEventListener("resize", onChange)
    }
}
