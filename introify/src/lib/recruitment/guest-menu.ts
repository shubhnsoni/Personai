import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/menu` chrome for empty RECRUITMENT_AGENCY lead kits - never "Shop" / "products". */
export const RECRUIT_GUEST_MENU_LABEL_ROLES = "Roles"

export const RECRUIT_GUEST_MENU_EMPTY_TITLE_ROLES = "No open roles listed"
export const RECRUIT_GUEST_MENU_EMPTY_TITLE_CALLS = "Calls are on Book a call"

/**
 * Kit roles that share the recruitment-agency guest menu surface.
 * RECRUITMENT_AGENCY is canonical; resolveKitRole keeps aliases (if any) honest.
 */
export function isRecruitmentAgencyMenuRole(role?: string | null): boolean {
    return resolveKitRole(role) === "RECRUITMENT_AGENCY"
}

/**
 * Empty-catalog guest `/menu` for COLLECT_LEADS (and other non-shop) recruit kits.
 * Populated catalogs and SELL_PRODUCTS keep ShopCatalog; shop/food/bakery untouched.
 */
export function shouldUseRecruitGuestMenuEmpty(role?: string | null, primaryGoal?: string | null): boolean {
    if (!isRecruitmentAgencyMenuRole(role)) return false
    if (primaryGoal === "SELL_PRODUCTS") return false
    return true
}

export function recruitGuestMenuLabel(_role?: string | null): string {
    void _role
    return RECRUIT_GUEST_MENU_LABEL_ROLES
}

function firstName(displayName: string): string {
    const part = displayName.trim().split(/\s+/)[0]
    return part || "them"
}

export function recruitGuestMenuEmptyCopy(input: {
    displayName: string
    role?: string | null
    primaryGoal?: string | null
}): { title: string; detail: string; bookLabel: string } {
    void input.role
    void input.primaryGoal
    const who = firstName(input.displayName)
    return {
        title: RECRUIT_GUEST_MENU_EMPTY_TITLE_ROLES,
        detail: `${RECRUIT_GUEST_MENU_EMPTY_TITLE_CALLS} — ask ${who} about hiring briefs on Book a call.`,
        bookLabel: "Book a call",
    }
}
