import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/menu` chrome for empty FIELD_SERVICE appointment kits - never "Shop" / "products". */
export const FIELD_GUEST_MENU_LABEL_PARTS = "Parts"

export const FIELD_GUEST_MENU_EMPTY_TITLE_PARTS = "No parts listed"
export const FIELD_GUEST_MENU_EMPTY_TITLE_SERVICES = "Services are on Book a visit"

/**
 * Kit + flavor roles that share the field-service guest menu surface.
 * PLUMBER / ELECTRICIAN / AC_REPAIR / GARAGE alias to FIELD_SERVICE via resolveKitRole.
 */
export function isFieldServiceMenuRole(role?: string | null): boolean {
    return resolveKitRole(role) === "FIELD_SERVICE"
}

/**
 * Empty-catalog guest `/menu` for TAKE_APPOINTMENTS (and other non-shop) field kits.
 * Populated catalogs (cooling-world, bhola) and SELL_PRODUCTS keep ShopCatalog;
 * shop/food/bakery untouched.
 */
export function shouldUseFieldGuestMenuEmpty(role?: string | null, primaryGoal?: string | null): boolean {
    if (!isFieldServiceMenuRole(role)) return false
    if (primaryGoal === "SELL_PRODUCTS") return false
    return true
}

export function fieldGuestMenuLabel(_role?: string | null): string {
    void _role
    return FIELD_GUEST_MENU_LABEL_PARTS
}

function firstName(displayName: string): string {
    const part = displayName.trim().split(/\s+/)[0]
    return part || "them"
}

export function fieldGuestMenuEmptyCopy(input: {
    displayName: string
    role?: string | null
    primaryGoal?: string | null
}): { title: string; detail: string; bookLabel: string } {
    void input.role
    void input.primaryGoal
    const who = firstName(input.displayName)
    return {
        title: FIELD_GUEST_MENU_EMPTY_TITLE_PARTS,
        detail: `${FIELD_GUEST_MENU_EMPTY_TITLE_SERVICES} — ask ${who} for a site visit on Book a visit.`,
        bookLabel: "Book a visit",
    }
}
