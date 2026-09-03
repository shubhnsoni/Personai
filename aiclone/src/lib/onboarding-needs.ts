import type { FieldPack, Surface } from "@/lib/surfaces"

export type NeedId =
    | "sell" | "dine" | "time" | "teach" | "ca" | "hire" | "show" | "leads" | "page" | "field"
    | "salon" | "eventStudio" | "estate" | "recruit" | "jewelryRetail" | "goldWholesale"

export type RoleTemplate =
    | "SHOP"
    | "JEWELRY_RETAIL"
    | "JEWELRY_WHOLESALE"
    | "RESTAURANT"
    | "CONSULTANT"
    | "CA"
    | "COACH"
    | "JOB_SEEKER"
    | "DESIGNER"
    | "CREATOR"
    | "FIELD_SERVICE"
    | "SALON_SPA"
    | "EVENTS_STUDIO"
    | "REAL_ESTATE_BROKERAGE"
    | "RECRUITMENT_AGENCY"
    | "CUSTOM"

export type Goal =
    | "SELL_PRODUCTS"
    | "BOOK_TABLE"
    | "TAKE_APPOINTMENTS"
    | "HIRE_ME"
    | "SHOW_PORTFOLIO"
    | "COLLECT_LEADS"
    | "BOOK_CALL"

export type Need = {
    id: NeedId
    role: RoleTemplate
    goal: Goal
    title: string
    blurb: string
    folk: string
    headline: string
    next: string
}

export const NEEDS: Need[] = [
    { id: "sell", role: "SHOP", goal: "SELL_PRODUCTS", title: "Shopkeeper", blurb: "I sell products, in person or online.", folk: "shopkeepers", headline: "Shop now", next: "/dashboard/products" },
    { id: "jewelryRetail", role: "JEWELRY_RETAIL", goal: "SELL_PRODUCTS", title: "Jewellery store", blurb: "Gold by weight and purity, priced from today's city rate.", folk: "jewellers", headline: "See jewellery", next: "/dashboard/products" },
    { id: "goldWholesale", role: "JEWELRY_WHOLESALE", goal: "COLLECT_LEADS", title: "Gold wholesale", blurb: "Buy on touch, sell to shops, cash or udhar.", folk: "wholesalers", headline: "See stock", next: "/dashboard/products" },
    { id: "dine", role: "RESTAURANT", goal: "BOOK_TABLE", title: "Restaurant", blurb: "I run a kitchen, cafe, or bar.", folk: "restaurants", headline: "Reserve a table", next: "/dashboard/products" },
    { id: "time", role: "CONSULTANT", goal: "TAKE_APPOINTMENTS", title: "Consultant", blurb: "People book time with me.", folk: "consultants", headline: "Book a session", next: "/dashboard/services" },
    { id: "teach", role: "COACH", goal: "SELL_PRODUCTS", title: "Coach", blurb: "I teach, train, or mentor.", folk: "coaches", headline: "Learn with me", next: "/dashboard/courses" },
    { id: "ca", role: "CA", goal: "TAKE_APPOINTMENTS", title: "CA", blurb: "Filings, tax, and books.", folk: "CAs", headline: "Book a consult", next: "/dashboard/services" },
    { id: "hire", role: "JOB_SEEKER", goal: "HIRE_ME", title: "Job seeker", blurb: "I want a page that gets me hired.", folk: "job seekers", headline: "Open to work", next: "/dashboard/profile" },
    { id: "show", role: "DESIGNER", goal: "SHOW_PORTFOLIO", title: "Designer", blurb: "I show my work and take briefs.", folk: "designers", headline: "Selected work", next: "/dashboard/profile" },
    { id: "leads", role: "CREATOR", goal: "COLLECT_LEADS", title: "Creator", blurb: "I grow an audience and share files.", folk: "creators", headline: "Get the free guide", next: "/dashboard/lead-magnets" },
    // FIELD_SERVICE reuses the TAKE_APPOINTMENTS goal rather than adding a new one. A field job IS a
    // scheduled visit, and Goal is switched on in several places - inventing an eighth value to say
    // the same thing would have meant an unhandled case in each of them.
    { id: "field", role: "FIELD_SERVICE", goal: "TAKE_APPOINTMENTS", title: "Field service", blurb: "I send people out to jobs on site.", folk: "field teams", headline: "Request a visit", next: "/dashboard/services" },
    { id: "salon", role: "SALON_SPA", goal: "TAKE_APPOINTMENTS", title: "Salon or spa", blurb: "I book treatments with named staff.", folk: "salons and spas", headline: "Book a treatment", next: "/dashboard/services" },
    { id: "eventStudio", role: "EVENTS_STUDIO", goal: "COLLECT_LEADS", title: "Events studio", blurb: "I plan and deliver client events.", folk: "event studios", headline: "Plan your event", next: "/dashboard/events" },
    { id: "estate", role: "REAL_ESTATE_BROKERAGE", goal: "COLLECT_LEADS", title: "Real-estate brokerage", blurb: "I manage mandates, viewings, and deal stages.", folk: "brokerages", headline: "Discuss a property", next: "/dashboard/leads" },
    { id: "recruit", role: "RECRUITMENT_AGENCY", goal: "COLLECT_LEADS", title: "Recruitment agency", blurb: "I run vacancies from brief to placement.", folk: "recruiters", headline: "Share a hiring brief", next: "/dashboard/leads" },
    { id: "page", role: "CUSTOM", goal: "BOOK_CALL", title: "Something else", blurb: "I'll pick what I need next.", folk: "you", headline: "Let's talk", next: "/dashboard" },
]

export function needById(id: string | null | undefined) {
    return NEEDS.find((n) => n.id === id) || NEEDS[NEEDS.length - 1]
}

export function needByRole(role: string | null | undefined) {
    const aliased = role === "DEVELOPER" || role === "EDITOR" ? "DESIGNER" : role
    return NEEDS.find((n) => n.role === aliased) || NEEDS[NEEDS.length - 1]
}

export type AddonId = "leads" | "shop" | "menu" | "digital" | "services" | "calendar" | "courses" | "events" | "portfolio"

export const ADDONS: {
    id: AddonId
    label: string
    action: string
    blurb: string
    surfaces: Surface[]
    packs: FieldPack[]
}[] = [
    { id: "leads", label: "Leads", action: "Collect leads", blurb: "People who reach out from chat", surfaces: ["leads"], packs: [] },
    { id: "shop", label: "Shop", action: "Sell products", blurb: "Physical things with photos and price", surfaces: ["shop", "sales"], packs: ["shopPhysical"] },
    { id: "menu", label: "Menu", action: "Show the menu", blurb: "Dishes, diet, table booking", surfaces: ["shop", "calendar", "sales"], packs: ["menuDish", "tableBook"] },
    { id: "digital", label: "Digital files", action: "Sell files", blurb: "PDFs, downloads, guides", surfaces: ["shop", "sales"], packs: ["shopDigital"] },
    { id: "services", label: "Services", action: "Take sessions", blurb: "Calls and booked time", surfaces: ["services", "calendar", "sales"], packs: [] },
    { id: "calendar", label: "Calendar", action: "Manage bookings", blurb: "Hours people can pick", surfaces: ["calendar"], packs: [] },
    { id: "courses", label: "Courses", action: "Run courses", blurb: "Lessons people can join", surfaces: ["courses", "sales"], packs: [] },
    { id: "events", label: "Events", action: "Host events", blurb: "Workshops and rooms", surfaces: ["events"], packs: [] },
    { id: "portfolio", label: "Portfolio", action: "Show a portfolio", blurb: "Experience and projects", surfaces: [], packs: ["portfolio"] },
]

const ROLE_ADDONS: Record<string, AddonId[]> = {
    SHOP: ["shop", "digital"],
    JEWELRY_RETAIL: ["shop"],
    JEWELRY_WHOLESALE: ["shop", "leads"],
    RESTAURANT: ["menu"],
    CONSULTANT: ["leads", "services", "calendar", "portfolio"],
    CA: ["leads", "services", "calendar", "portfolio"],
    COACH: ["leads", "courses", "digital", "services", "calendar", "events", "portfolio"],
    CREATOR: ["leads", "digital"],
    DESIGNER: ["leads", "portfolio"],
    DEVELOPER: ["leads", "portfolio"],
    EDITOR: ["leads", "portfolio"],
    JOB_SEEKER: ["leads", "portfolio"],
    // Field work reuses what already exists: intake arrives as a lead, the work being sold is a
    // ServiceOffering, and a visit is scheduled. There is no field-service-only addon because there
    // is no field-service-only surface - that is the point of the shared engine.
    FIELD_SERVICE: ["leads", "services", "calendar"],
    SALON_SPA: ["services", "calendar", "shop"],
    EVENTS_STUDIO: ["leads", "services", "calendar", "events", "portfolio"],
    REAL_ESTATE_BROKERAGE: ["leads", "services", "calendar", "portfolio"],
    RECRUITMENT_AGENCY: ["leads", "services", "calendar"],
    CUSTOM: [],
}

export function suggestedAddons(role?: string | null): AddonId[] {
    return ROLE_ADDONS[role || ""] || []
}

export function extrasFromAddons(role: string, selected: AddonId[]) {
    const suggested = new Set(suggestedAddons(role))
    const surfaces: Surface[] = []
    const packs: FieldPack[] = []
    for (const id of selected) {
        if (suggested.has(id) && role !== "CUSTOM") continue
        const addon = ADDONS.find((a) => a.id === id)
        if (!addon) continue
        surfaces.push(...addon.surfaces)
        packs.push(...addon.packs)
    }
    return {
        surfaces: [...new Set(surfaces)],
        packs: [...new Set(packs)],
        addons: selected.filter((id) => role === "CUSTOM" || !suggested.has(id)),
    }
}


/**
 * Which built-in blueprint an onboarding role corresponds to.
 *
 * WHAT THIS IS NOT: an installer. This distinction USED to be easy, because nothing in this repository
 * could install a blueprint at all. That is no longer true - there is now a durable installation record
 * (`BlueprintInstallation`), a runtime, and a `POST` route that creates one - which makes the
 * distinction more important rather than less.
 *
 * So, precisely: choosing a role during onboarding installs NOTHING. This map records a CORRESPONDENCE
 * so the product can say "the business type you chose is described by this blueprint". Installing is a
 * separate, explicitly-invoked act that requires `workspace.update` - OWNER or ADMIN - and it must be
 * performed deliberately against `POST /api/platform/workspaces/{id}/blueprint`. This module has no
 * import of, and no path to, the install runtime, and `check-onboarding-blueprint-coverage.ts` asserts
 * that absence: the risk it now guards is no longer "the map overclaims", it is "signing up quietly
 * reconfigures a workspace".
 *
 * The name still says `CORRESPONDING`, not `INSTALLS`, and now it says it against a codebase where
 * installing is a real thing that something else does.
 *
 * WHY IT LIVES HERE rather than in src/lib/business-os. The blueprint registry is deliberately
 * self-contained: it describes engines and capabilities and knows nothing about onboarding. Pointing
 * it at product onboarding decisions would invert that. The coupling belongs on the onboarding side,
 * and the ids are plain strings that a harness verifies against the real registry - so a typo or a
 * renamed blueprint fails a check rather than silently producing a dead link.
 *
 * The gap this closes: `field-service-v1` was an ACTIVE blueprint with no onboarding role at all, so
 * an owner who sends people out to jobs could not say so when signing up, and the engine they would
 * have used was unreachable from the product's own front door. Every other active blueprint already
 * had a role; only this one did not.
 *
 * Roles with no blueprint are deliberate and listed rather than omitted: JOB_SEEKER, DESIGNER and
 * CREATOR are page-and-audience roles that compose no operating engine, and CUSTOM is the "I will
 * pick later" escape hatch. A harness asserts this map covers every ACTIVE blueprint, so adding a
 * blueprint without an onboarding route for it fails loudly instead of shipping unreachable.
 */
export const CORRESPONDING_BLUEPRINT: Readonly<Partial<Record<RoleTemplate, string>>> = Object.freeze({
    SHOP: "retail-storefront-v1",
    RESTAURANT: "restaurant-venue-v3",
    CONSULTANT: "consulting-agency-v1",
    CA: "ca-practice-v1",
    COACH: "coaching-studio-v2",
    FIELD_SERVICE: "field-service-v1",
    SALON_SPA: "salon-spa-v1",
    EVENTS_STUDIO: "events-studio-v1",
    REAL_ESTATE_BROKERAGE: "real-estate-brokerage-v1",
    RECRUITMENT_AGENCY: "recruitment-agency-v1",
})

/** Roles that intentionally correspond to no blueprint, stated so the absence is not a gap. */
export const ROLES_WITHOUT_BLUEPRINT: readonly RoleTemplate[] = Object.freeze([
    "JOB_SEEKER",
    "DESIGNER",
    "CREATOR",
    "CUSTOM",
    // Same commerce engines as SHOP. The coverage harness forbids two roles claiming
    // retail-storefront-v1, so this kit is unmapped on purpose and still uses SHOP surfaces.
    "JEWELRY_RETAIL",
    "JEWELRY_WHOLESALE",
])

export function correspondingBlueprintId(role: string | null | undefined): string | null {
    if (!role) return null
    const aliased = role === "DEVELOPER" || role === "EDITOR" ? "DESIGNER" : role
    return CORRESPONDING_BLUEPRINT[aliased as RoleTemplate] ?? null
}
