/**
 * Real-world size for each AR model, in metres, measured on its largest axis.
 *
 * Prefer an explicit `sizeMeters` from the caller. The filename table is a
 * demo-only override for baked SkyDine assets. Everything else uses pack
 * defaults: a plated dish vs a physical shop object.
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

export const DEFAULT_AR_SIZE_MENU = 0.22
export const DEFAULT_AR_SIZE_OBJECT = 0.35
/** Alias for `DEFAULT_AR_SIZE_MENU` — one-arg callers and `optimize-glb`. */
export const DEFAULT_AR_SIZE = DEFAULT_AR_SIZE_MENU

export function arSizeFor(
    modelUrl?: string | null,
    opts?: { sizeMeters?: number | null; pack?: "menuDish" | "shopPhysical" | string },
): number {
    if (opts?.sizeMeters != null && opts.sizeMeters > 0) return opts.sizeMeters
    if (modelUrl) {
        const file = modelUrl.split("/").pop() || ""
        const key = file.replace(/(-ar)?\.(glb|gltf|usdz)$/i, "")
        if (SIZES[key]) return SIZES[key]
    }
    return !opts?.pack || opts.pack === "menuDish" ? DEFAULT_AR_SIZE_MENU : DEFAULT_AR_SIZE_OBJECT
}
