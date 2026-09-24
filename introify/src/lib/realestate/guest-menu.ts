import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/menu` chrome for empty REAL_ESTATE_BROKERAGE lead kits - never "Shop" / "products". */
export const REALESTATE_GUEST_MENU_LABEL_LISTINGS = "Listings"

export const REALESTATE_GUEST_MENU_EMPTY_TITLE_LISTINGS = "No listings published"
export const REALESTATE_GUEST_MENU_EMPTY_TITLE_PROPERTIES = "Properties coming soon"

/**
 * Kit roles that share the real-estate brokerage guest menu surface.
 * REAL_ESTATE_BROKERAGE is canonical; resolveKitRole keeps aliases (if any) honest.
 */
export function isRealestateBrokerageMenuRole(role?: string | null): boolean {
    return resolveKitRole(role) === "REAL_ESTATE_BROKERAGE"
}

/**
 * Empty-catalog guest `/menu` for COLLECT_LEADS (and other non-shop) realtor kits.
 * Populated catalogs and SELL_PRODUCTS keep ShopCatalog; shop/food/bakery untouched.
 */
export function shouldUseRealestateGuestMenuEmpty(role?: string | null, primaryGoal?: string | null): boolean {
    if (!isRealestateBrokerageMenuRole(role)) return false
    if (primaryGoal === "SELL_PRODUCTS") return false
    return true
}

export function realestateGuestMenuLabel(_role?: string | null): string {
    void _role
    return REALESTATE_GUEST_MENU_LABEL_LISTINGS
}

function firstName(displayName: string): string {
    const part = displayName.trim().split(/\s+/)[0]
    return part || "them"
}

export function realestateGuestMenuEmptyCopy(input: {
    displayName: string
    role?: string | null
    primaryGoal?: string | null
}): { title: string; detail: string; chatLabel: string } {
    void input.role
    void input.primaryGoal
    const who = firstName(input.displayName)
    return {
        title: REALESTATE_GUEST_MENU_EMPTY_TITLE_LISTINGS,
        detail: `Ask ${who} about flats, plots, and viewings in chat - listings live on the home page.`,
        chatLabel: `Ask ${who} about properties`,
    }
}
