import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/menu` chrome for empty portfolio / designer kits — never "Shop". */
export const CREATOR_GUEST_MENU_LABEL_PORTFOLIO = "Portfolio"
export const CREATOR_GUEST_MENU_LABEL_WORK = "Work"

export const CREATOR_GUEST_MENU_EMPTY_TITLE = "No products published yet"
export const CREATOR_GUEST_MENU_EMPTY_DETAIL =
    "Ask about the work in chat — selected projects and services live on the home page."

export const SHOP_OWNER_EMPTY_CTA = "Import a catalog or add a product"
export const SHOP_GUEST_EMPTY_TITLE = "No products published yet"

/**
 * Portfolio-first kits that should not force SHOP chrome when the catalog is empty.
 * Covers DESIGNER + aliases (DEVELOPER, EDITOR, INTERIOR), JOB_SEEKER, and SHOW_PORTFOLIO goals.
 */
export function isCreatorPortfolioMenuRole(role?: string | null, primaryGoal?: string | null): boolean {
    if (primaryGoal === "SHOW_PORTFOLIO") return true
    if (role === "JOB_SEEKER") return true
    return resolveKitRole(role) === "DESIGNER"
}

export function creatorGuestMenuLabel(role?: string | null, primaryGoal?: string | null): string {
    if (role === "JOB_SEEKER") return CREATOR_GUEST_MENU_LABEL_WORK
    if (resolveKitRole(role) === "DESIGNER" || primaryGoal === "SHOW_PORTFOLIO") {
        return CREATOR_GUEST_MENU_LABEL_PORTFOLIO
    }
    return CREATOR_GUEST_MENU_LABEL_PORTFOLIO
}

function firstName(displayName: string): string {
    const part = displayName.trim().split(/\s+/)[0]
    return part || "them"
}

export function creatorGuestMenuEmptyCopy(input: {
    displayName: string
    role?: string | null
    primaryGoal?: string | null
}): { title: string; detail: string; chatLabel: string } {
    const who = firstName(input.displayName)
    const portfolio = isCreatorPortfolioMenuRole(input.role, input.primaryGoal)
    if (portfolio) {
        return {
            title: CREATOR_GUEST_MENU_EMPTY_TITLE,
            detail: `Ask ${who} about their work in chat — selected work lives on the home page, not a product shop.`,
            chatLabel: `Ask ${who} about their work`,
        }
    }
    return {
        title: SHOP_GUEST_EMPTY_TITLE,
        detail: CREATOR_GUEST_MENU_EMPTY_DETAIL,
        chatLabel: "Chat",
    }
}

/** Public catalog empty: never owner import ops. */
export function shopCatalogGuestEmptyCopy(shopName?: string | null): { title: string; detail: string; chatLabel: string } {
    const who = firstName(shopName || "the shop")
    return {
        title: SHOP_GUEST_EMPTY_TITLE,
        detail: `Nothing is listed for guests yet. Chat with ${who}, or check back when something is published.`,
        chatLabel: "Chat",
    }
}
