/**
 * Flavor roles on the QA page that reuse an existing kit's surfaces, seed, and onboarding.
 * Unknown roles still fall through to CUSTOM in `surfaces.kit()`.
 */
export const ROLE_ALIAS: Record<string, string> = {
    DEVELOPER: "DESIGNER",
    EDITOR: "DESIGNER",
    INTERIOR: "DESIGNER",

    CAFE: "RESTAURANT",
    CLOUD_KITCHEN: "RESTAURANT",
    DHABA: "RESTAURANT",

    KIRANA: "SHOP",
    OPTICS: "SHOP",
    BOUTIQUE: "SHOP",
    FLORIST: "SHOP",
    BAKERY: "SHOP",
    SWEETS: "SHOP",
    PRINT_SHOP: "SHOP",

    CLINIC: "CONSULTANT",
    AGENCY: "CONSULTANT",
    INSURANCE: "CONSULTANT",
    LAWYER: "CA",

    TUTOR: "COACH",
    MUSIC_TEACHER: "COACH",

    GYM: "SALON_SPA",
    BARBER: "SALON_SPA",
    YOGA: "SALON_SPA",
    PET_GROOMING: "SALON_SPA",

    PLUMBER: "FIELD_SERVICE",
    ELECTRICIAN: "FIELD_SERVICE",
    AC_REPAIR: "FIELD_SERVICE",
    GARAGE: "FIELD_SERVICE",

    PHOTOGRAPHER: "EVENTS_STUDIO",
    CATERER: "EVENTS_STUDIO",
    TRAVEL: "EVENTS_STUDIO",

    NGO: "CREATOR",
}

export function resolveKitRole(role?: string | null): string {
    if (!role) return ""
    return ROLE_ALIAS[role] || role
}
