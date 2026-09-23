import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/menu` chrome for empty portfolio / designer / pro kits — never "Shop". */
export const CREATOR_GUEST_MENU_LABEL_PORTFOLIO = "Portfolio"
export const CREATOR_GUEST_MENU_LABEL_WORK = "Work"
export const CREATOR_GUEST_MENU_LABEL_SERVICES = "Services"

export const CREATOR_GUEST_MENU_EMPTY_TITLE = "No products published yet"
export const CREATOR_GUEST_MENU_EMPTY_DETAIL =
    "Ask about the work in chat — selected projects and services live on the home page."

export const SHOP_OWNER_EMPTY_CTA = "Import a catalog or add a product"
export const SHOP_GUEST_EMPTY_TITLE = "No products published yet"

/**
 * Portfolio-first kits that should not force SHOP chrome when the catalog is empty.
 * Covers DESIGNER + aliases (DEVELOPER, EDITOR, INTERIOR), JOB_SEEKER, and SHOW_PORTFOLIO goals.
 * Kept narrow for P0-1 backward compat — CREATOR / COACH / CONSULTANT use shouldUseCreatorGuestMenuEmpty.
 */
export function isCreatorPortfolioMenuRole(role?: string | null, primaryGoal?: string | null): boolean {
    if (primaryGoal === "SHOW_PORTFOLIO") return true
    if (role === "JOB_SEEKER") return true
    return resolveKitRole(role) === "DESIGNER"
}

/**
 * Pro / creator kits (CREATOR + NGO, COACH + tutor aliases, CONSULTANT + clinic/agency)
 * that get role-honest empty `/menu` chrome — not SHOP / HOTEL / restaurant / pharmacy.
 */
export function isCreatorProMenuRole(role?: string | null, _primaryGoal?: string | null): boolean {
    void _primaryGoal
    const kit = resolveKitRole(role)
    return kit === "CREATOR" || kit === "COACH" || kit === "CONSULTANT"
}

/**
 * Empty-catalog guest menu: portfolio kits OR CREATOR / COACH / CONSULTANT kits.
 * Does not include SHOP, HOTEL, restaurant, pharmacy, etc.
 */
export function shouldUseCreatorGuestMenuEmpty(role?: string | null, primaryGoal?: string | null): boolean {
    return isCreatorPortfolioMenuRole(role, primaryGoal) || isCreatorProMenuRole(role, primaryGoal)
}

function isServicesMenuRole(role?: string | null): boolean {
    const kit = resolveKitRole(role)
    return kit === "CONSULTANT" || kit === "COACH"
}

export function creatorGuestMenuLabel(role?: string | null, primaryGoal?: string | null): string {
    if (role === "JOB_SEEKER") return CREATOR_GUEST_MENU_LABEL_WORK
    if (isServicesMenuRole(role)) return CREATOR_GUEST_MENU_LABEL_SERVICES
    if (resolveKitRole(role) === "DESIGNER" || primaryGoal === "SHOW_PORTFOLIO") {
        return CREATOR_GUEST_MENU_LABEL_PORTFOLIO
    }
    if (resolveKitRole(role) === "CREATOR") return CREATOR_GUEST_MENU_LABEL_PORTFOLIO
    // Default for this guest-menu surface — never Shop
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
    if (isServicesMenuRole(input.role)) {
        return {
            title: CREATOR_GUEST_MENU_EMPTY_TITLE,
            detail: `Ask ${who} about services in chat — offerings live on the home page, not a product shop.`,
            chatLabel: `Ask ${who} about services`,
        }
    }
    // Portfolio / Work / CREATOR / SHOW_PORTFOLIO — designer-style copy (never Shop / Import)
    if (
        isCreatorPortfolioMenuRole(input.role, input.primaryGoal)
        || resolveKitRole(input.role) === "CREATOR"
        || shouldUseCreatorGuestMenuEmpty(input.role, input.primaryGoal)
    ) {
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
