import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/menu` chrome for empty EVENTS_STUDIO / PHOTOGRAPHER lead kits — never "Shop" / "products". */
export const EVENTS_GUEST_MENU_LABEL_PACKAGES = "Packages"
export const EVENTS_GUEST_MENU_LABEL_PORTFOLIO = "Portfolio"

export const EVENTS_GUEST_MENU_EMPTY_TITLE_PACKAGES = "No packages published"
export const EVENTS_GUEST_MENU_EMPTY_TITLE_PORTFOLIO = "Portfolio coming soon"

/**
 * Kit + flavor roles that share the events studio guest menu surface.
 * PHOTOGRAPHER / CATERER / TRAVEL alias to EVENTS_STUDIO via resolveKitRole.
 */
export function isEventsStudioMenuRole(role?: string | null): boolean {
    return resolveKitRole(role) === "EVENTS_STUDIO"
}

/**
 * Empty-catalog guest `/menu` for COLLECT_LEADS (and other non-shop) events/photo kits.
 * Populated catalogs and SELL_PRODUCTS keep ShopCatalog; restaurant/food untouched.
 */
export function shouldUseEventsGuestMenuEmpty(role?: string | null, primaryGoal?: string | null): boolean {
    if (!isEventsStudioMenuRole(role)) return false
    if (primaryGoal === "SELL_PRODUCTS") return false
    return true
}

/** Photographer flavor gets Portfolio; studio / caterer / travel get Packages. */
export function isEventsPhotographerMenuRole(role?: string | null): boolean {
    return (role || "").trim().toUpperCase() === "PHOTOGRAPHER"
}

export function eventsGuestMenuLabel(role?: string | null): string {
    if (isEventsPhotographerMenuRole(role)) return EVENTS_GUEST_MENU_LABEL_PORTFOLIO
    return EVENTS_GUEST_MENU_LABEL_PACKAGES
}

function firstName(displayName: string): string {
    const part = displayName.trim().split(/\s+/)[0]
    return part || "them"
}

export function eventsGuestMenuEmptyCopy(input: {
    displayName: string
    role?: string | null
    primaryGoal?: string | null
}): { title: string; detail: string; chatLabel: string } {
    void input.primaryGoal
    const who = firstName(input.displayName)
    if (isEventsPhotographerMenuRole(input.role)) {
        return {
            title: EVENTS_GUEST_MENU_EMPTY_TITLE_PORTFOLIO,
            detail: `Ask ${who} about coverage and galleries in chat — selected work lives on the home page.`,
            chatLabel: `Ask ${who} about their work`,
        }
    }
    return {
        title: EVENTS_GUEST_MENU_EMPTY_TITLE_PACKAGES,
        detail: `Ask ${who} about event packages in chat — offerings live on the home page.`,
        chatLabel: `Ask ${who} about packages`,
    }
}
