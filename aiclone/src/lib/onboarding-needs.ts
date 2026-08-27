import type { FieldPack, Surface } from "@/lib/surfaces"

export type NeedId = "sell" | "dine" | "time" | "teach" | "ca" | "hire" | "show" | "leads" | "page"

export type RoleTemplate =
    | "SHOP"
    | "RESTAURANT"
    | "CONSULTANT"
    | "CA"
    | "COACH"
    | "JOB_SEEKER"
    | "DESIGNER"
    | "CREATOR"
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
    { id: "dine", role: "RESTAURANT", goal: "BOOK_TABLE", title: "Restaurant", blurb: "I run a kitchen, cafe, or bar.", folk: "restaurants", headline: "Reserve a table", next: "/dashboard/products" },
    { id: "time", role: "CONSULTANT", goal: "TAKE_APPOINTMENTS", title: "Consultant", blurb: "People book time with me.", folk: "consultants", headline: "Book a session", next: "/dashboard/services" },
    { id: "teach", role: "COACH", goal: "SELL_PRODUCTS", title: "Coach", blurb: "I teach, train, or mentor.", folk: "coaches", headline: "Learn with me", next: "/dashboard/courses" },
    { id: "ca", role: "CA", goal: "TAKE_APPOINTMENTS", title: "CA", blurb: "Filings, tax, and books.", folk: "CAs", headline: "Book a consult", next: "/dashboard/services" },
    { id: "hire", role: "JOB_SEEKER", goal: "HIRE_ME", title: "Job seeker", blurb: "I want a page that gets me hired.", folk: "job seekers", headline: "Open to work", next: "/dashboard/profile" },
    { id: "show", role: "DESIGNER", goal: "SHOW_PORTFOLIO", title: "Designer", blurb: "I show my work and take briefs.", folk: "designers", headline: "Selected work", next: "/dashboard/profile" },
    { id: "leads", role: "CREATOR", goal: "COLLECT_LEADS", title: "Creator", blurb: "I grow an audience and share files.", folk: "creators", headline: "Get the free guide", next: "/dashboard/lead-magnets" },
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
    RESTAURANT: ["menu"],
    CONSULTANT: ["leads", "services", "calendar", "portfolio"],
    CA: ["leads", "services", "calendar", "portfolio"],
    COACH: ["leads", "courses", "digital", "services", "calendar", "events", "portfolio"],
    CREATOR: ["leads", "digital"],
    DESIGNER: ["leads", "portfolio"],
    DEVELOPER: ["leads", "portfolio"],
    EDITOR: ["leads", "portfolio"],
    JOB_SEEKER: ["leads", "portfolio"],
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
