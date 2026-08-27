import { redirect } from "next/navigation"
import { extrasOf, fieldOn, hasSurface, type Surface, type SurfaceExtras } from "@/lib/surfaces"

type ExtrasInput = SurfaceExtras | string | null | undefined | { personalityConfig?: string | null }

/** Accepts already-parsed extras, a raw config string, or a profile-like row. */
function normalizeExtras(extras?: ExtrasInput): SurfaceExtras | null | undefined {
    if (extras === null || extras === undefined) return extras
    if (typeof extras === "string") return extrasOf(extras)
    // `personalityConfig` is optional, so `in` cannot narrow the remaining
    // branch on its own; decide explicitly instead.
    if ("personalityConfig" in extras) return extrasOf(extras as { personalityConfig?: string | null })
    return extras as SurfaceExtras
}

export function requireSurface(role: string | null | undefined, surface: Surface, extras?: ExtrasInput) {
    const extra = normalizeExtras(extras)
    if (!hasSurface(role, surface, extra)) redirect("/dashboard")
}

export function requireShopDigital(role: string | null | undefined, extras?: ExtrasInput) {
    const extra = normalizeExtras(extras)
    if (!hasSurface(role, "shop", extra) || !fieldOn(role, "shopDigital", extra)) redirect("/dashboard")
}
