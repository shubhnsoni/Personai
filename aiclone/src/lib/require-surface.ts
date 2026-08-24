import { redirect } from "next/navigation"
import { extrasOf, fieldOn, hasSurface, type Surface, type SurfaceExtras } from "@/lib/surfaces"

export function requireSurface(role: string | null | undefined, surface: Surface, extras?: SurfaceExtras | string | null | { personalityConfig?: string | null }) {
    const extra = typeof extras === "string" || extras && "personalityConfig" in extras ? extrasOf(extras) : extras
    if (!hasSurface(role, surface, extra)) redirect("/dashboard")
}

export function requireShopDigital(role: string | null | undefined, extras?: SurfaceExtras | string | null | { personalityConfig?: string | null }) {
    const extra = typeof extras === "string" || extras && "personalityConfig" in extras ? extrasOf(extras) : extras
    if (!hasSurface(role, "shop", extra) || !fieldOn(role, "shopDigital", extra)) redirect("/dashboard")
}
