export type Surface =
    | "home"
    | "profile"
    | "inbox"
    | "leads"
    | "shop"
    | "services"
    | "calendar"
    | "courses"
    | "events"
    | "sales"
    | "businessOs"

export type FieldPack =
    | "shopPhysical"
    | "shopDigital"
    | "menuDish"
    | "tableBook"
    | "ar"
    | "portfolio"
    | "whatsappUpi"

const CORE: Surface[] = ["home", "profile", "inbox"]

const ALL_SURFACES: Surface[] = [
    "home", "profile", "inbox", "leads",
    "shop", "services", "calendar",
    "courses", "events", "sales",
]

// `businessOs` is intentionally absent from ALL_SURFACES. CUSTOM is the schema default
// for `Profile.roleTemplate`, the "Something else" onboarding option, and the try-kit
// role, and `kit()` falls back to CUSTOM for any unrecognised role. Listing the surface
// here would therefore switch an unfinished owner console on for those profiles by
// default. It is granted only by explicit per-profile opt-in through extras.

/**
 * Exported so the blueprint preview resolver can enumerate packs without restating the union. A second
 * copy of this list would drift the first time a pack is added.
 */
export const ALL_PACKS: FieldPack[] = [
    "shopPhysical", "shopDigital", "menuDish", "tableBook", "ar", "portfolio", "whatsappUpi",
]

const KIT: Record<string, { surfaces: Surface[]; packs: FieldPack[] }> = {
    SHOP: {
        surfaces: [...CORE, "shop", "sales"],
        packs: ["shopPhysical", "shopDigital", "ar", "whatsappUpi"],
    },
    JEWELRY_RETAIL: {
        surfaces: [...CORE, "shop", "sales"],
        packs: ["shopPhysical", "ar", "whatsappUpi"],
    },
    JEWELRY_WHOLESALE: {
        surfaces: [...CORE, "shop", "sales", "leads"],
        packs: ["shopPhysical", "whatsappUpi"],
    },
    RESTAURANT: {
        surfaces: [...CORE, "shop", "calendar", "sales"],
        packs: ["menuDish", "ar", "tableBook", "whatsappUpi"],
    },
    CONSULTANT: {
        surfaces: [...CORE, "leads", "services", "calendar", "sales"],
        packs: ["portfolio"],
    },
    CA: {
        surfaces: [...CORE, "leads", "services", "calendar", "sales"],
        packs: ["portfolio", "whatsappUpi"],
    },
    COACH: {
        surfaces: [...CORE, "leads", "courses", "shop", "services", "calendar", "events", "sales"],
        packs: ["portfolio", "shopDigital"],
    },
    CREATOR: {
        surfaces: [...CORE, "leads", "shop", "sales"],
        packs: ["shopDigital", "whatsappUpi"],
    },
    DESIGNER: {
        surfaces: [...CORE, "leads"],
        packs: ["portfolio"],
    },
    DEVELOPER: {
        surfaces: [...CORE, "leads"],
        packs: ["portfolio"],
    },
    EDITOR: {
        surfaces: [...CORE, "leads"],
        packs: ["portfolio"],
    },
    JOB_SEEKER: {
        surfaces: [...CORE, "leads"],
        packs: ["portfolio"],
    },
    FIELD_SERVICE: {
        surfaces: [...CORE, "leads", "services", "calendar", "sales"],
        packs: [],
    },
    SALON_SPA: {
        surfaces: [...CORE, "services", "calendar", "shop", "sales"],
        packs: ["shopPhysical"],
    },
    EVENTS_STUDIO: {
        surfaces: [...CORE, "leads", "services", "calendar", "events", "sales"],
        packs: ["portfolio"],
    },
    REAL_ESTATE_BROKERAGE: {
        surfaces: [...CORE, "leads", "services", "calendar", "sales"],
        packs: ["portfolio"],
    },
    RECRUITMENT_AGENCY: {
        surfaces: [...CORE, "leads", "services", "calendar", "sales"],
        packs: [],
    },
    CUSTOM: {
        surfaces: ALL_SURFACES,
        packs: ALL_PACKS,
    },
}

export type SurfaceExtras = { surfaces?: Surface[]; packs?: FieldPack[]; addons?: string[] }

export function extrasOf(raw?: string | null | { personalityConfig?: string | null }): SurfaceExtras {
    const text = typeof raw === "string" ? raw : raw?.personalityConfig
    try {
        const o = JSON.parse(text || "{}") as { extras?: SurfaceExtras; surfaces?: Surface[] }
        const surfaces = o.extras?.surfaces || o.surfaces || []
        const packs = o.extras?.packs || []
        const addons = o.extras?.addons || []
        return {
            surfaces: Array.isArray(surfaces) ? surfaces.filter(Boolean) as Surface[] : [],
            packs: Array.isArray(packs) ? packs.filter(Boolean) as FieldPack[] : [],
            addons: Array.isArray(addons) ? addons.filter(Boolean) : [],
        }
    } catch {
        return { surfaces: [], packs: [] }
    }
}

export function writeExtras(existing: string | null | undefined, extras: SurfaceExtras) {
    let o: Record<string, unknown> = {}
    try { o = JSON.parse(existing || "{}") as Record<string, unknown> } catch { o = {} }
    o.extras = {
        surfaces: [...new Set(extras.surfaces || [])],
        packs: [...new Set(extras.packs || [])],
        addons: [...new Set(extras.addons || [])],
    }
    return JSON.stringify(o)
}

function kit(role?: string | null, extras?: SurfaceExtras | null) {
    const base = KIT[role || ""] || KIT.CUSTOM
    if (!extras) return base
    return {
        surfaces: [...new Set([...base.surfaces, ...(extras.surfaces || [])])],
        packs: [...new Set([...base.packs, ...(extras.packs || [])])],
    }
}

export function surfacesFor(role?: string | null, extras?: SurfaceExtras | null): Surface[] {
    return kit(role, extras).surfaces
}

export function hasSurface(role: string | null | undefined, surface: Surface, extras?: SurfaceExtras | null) {
    return kit(role, extras).surfaces.includes(surface)
}

export function fieldOn(role: string | null | undefined, pack: FieldPack, extras?: SurfaceExtras | null) {
    return kit(role, extras).packs.includes(pack)
}

export function shopNavLabel(role?: string | null) {
    if (role === "RESTAURANT") return "Menu"
    if (role === "JEWELRY_RETAIL") return "Jewellery"
    if (role === "JEWELRY_WHOLESALE") return "Stock"
    return "Shop"
}

export function leadsNavLabel(role?: string | null) {
    if (role === "JEWELRY_WHOLESALE") return "Parties"
    return "Leads"
}

export function salesNavLabel(role?: string | null) {
    if (role === "JEWELRY_RETAIL" || role === "JEWELRY_WHOLESALE") return "Cashflow"
    return "Sales"
}

export function defaultFulfillment(role?: string | null, extras?: SurfaceExtras | null): "PHYSICAL" | "DIGITAL" | "BOTH" {
    if (fieldOn(role, "shopDigital", extras) && !fieldOn(role, "shopPhysical", extras) && !fieldOn(role, "menuDish", extras)) return "DIGITAL"
    if (role === "RESTAURANT" || role === "SHOP" || role === "JEWELRY_RETAIL" || role === "JEWELRY_WHOLESALE") return "PHYSICAL"
    return "PHYSICAL"
}

export function calendarNoun(role?: string | null) {
    if (role === "RESTAURANT") return "Reservations"
    if (role === "CONSULTANT" || role === "CA" || role === "COACH") return "Sessions"
    return "Bookings"
}

export function surfaceForPath(pathname: string): Surface | null {
    if (pathname === "/dashboard") return "home"
    if (pathname.startsWith("/dashboard/business-os")) return "businessOs"
    if (pathname.startsWith("/dashboard/profile") || pathname.startsWith("/dashboard/content") || pathname.startsWith("/dashboard/import") || pathname.startsWith("/dashboard/links")) return "profile"
    if (pathname.startsWith("/dashboard/inbox") || pathname.startsWith("/dashboard/conversations")) return "inbox"
    if (pathname.startsWith("/dashboard/leads")) return "leads"
    if (pathname.startsWith("/dashboard/products") || pathname.startsWith("/dashboard/lead-magnets") || pathname.startsWith("/dashboard/offer") || pathname.startsWith("/dashboard/orders")) return "shop"
    if (pathname.startsWith("/dashboard/services")) return "services"
    if (pathname.startsWith("/dashboard/calendar")) return "calendar"
    if (pathname.startsWith("/dashboard/courses")) return "courses"
    if (pathname.startsWith("/dashboard/events") || pathname.startsWith("/dashboard/community")) return "events"
    if (pathname.startsWith("/dashboard/money") || pathname.startsWith("/dashboard/payments")) return "sales"
    return null
}

export function navHrefToSurface(href: string): Surface | null {
    switch (href) {
        case "/dashboard": return "home"
        case "/dashboard/profile": return "profile"
        case "/dashboard/inbox": return "inbox"
        case "/dashboard/leads": return "leads"
        case "/dashboard/products": return "shop"
        case "/dashboard/services": return "services"
        case "/dashboard/calendar": return "calendar"
        case "/dashboard/courses": return "courses"
        case "/dashboard/events": return "events"
        case "/dashboard/money": return "sales"
        case "/dashboard/business-os": return "businessOs"
        default: return null
    }
}

export function publicChipAllowed(role: string | null | undefined, chip: string, extras?: SurfaceExtras | null) {
    const shop = hasSurface(role, "shop", extras)
    const book = hasSurface(role, "services", extras) || hasSurface(role, "calendar", extras)
    const courses = hasSurface(role, "courses", extras)
    const events = hasSurface(role, "events", extras)
    switch (chip) {
        case "shop":
        case "products":
            return shop
        case "book":
        case "services":
        case "rates":
            return book
        case "courses":
            return courses
        case "events":
        case "communities":
            return events
        case "work":
        case "portfolio":
        case "projects":
        case "cases":
        case "history":
            return fieldOn(role, "portfolio", extras) || role === "CUSTOM"
        case "guide":
            return fieldOn(role, "shopDigital", extras)
        case "wa":
            return fieldOn(role, "whatsappUpi", extras) || shop || hasSurface(role, "calendar", extras)
        case "tip":
            return fieldOn(role, "whatsappUpi", extras) || role === "CREATOR" || role === "CUSTOM"
        default:
            return true
    }
}
