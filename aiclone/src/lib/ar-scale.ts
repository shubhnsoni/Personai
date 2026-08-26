/**
 * Real-world size for each AR model, in metres, measured on its largest axis.
 *
 * Generated models carry no useful units — Meshy normalises everything into a
 * roughly 2-unit box — so the size has to come from somewhere else. The in-page
 * viewer, the Scene Viewer export and the Quick Look export all read this, so a
 * dish is the same size however it is opened.
 *
 * Longer term this belongs on DigitalProduct as an `arSizeCm` column that the
 * dashboard collects when a model is uploaded. Until that exists, keying off
 * the model filename keeps the three consumers from drifting apart.
 */

const SIZES: Record<string, number> = {
    "avocado-toast": 0.24,
    "caesar-salad": 0.24,
    cappuccino: 0.14,
    "chicken-burger": 0.17,
    "chocolate-brownie": 0.18,
    "garlic-bread": 0.26,
    "margherita-pizza": 0.3,
    "nutella-shake": 0.18,
    "pancake-stack": 0.22,
    "veg-momos": 0.22,
}

/** A plated main course. Safe when a model is not in the table above. */
export const DEFAULT_AR_SIZE = 0.22

export function arSizeFor(modelUrl?: string | null): number {
    if (!modelUrl) return DEFAULT_AR_SIZE
    const file = modelUrl.split("/").pop() || ""
    const key = file.replace(/(-ar)?\.(glb|gltf|usdz)$/i, "")
    return SIZES[key] ?? DEFAULT_AR_SIZE
}
