import { resolveKitRole } from "@/lib/role-alias"

export type AboutFooterHrefKind = "menu" | "shop" | "reserve" | "book" | "guide" | "chat" | "tip"

export type AboutFooterCta = {
    hrefKind: AboutFooterHrefKind
    label: string
}

function kitRole(role?: string | null) {
    return resolveKitRole(role)
}

export function waPrefill(role?: string | null, name = "") {
    const raw = (role || "").trim().toUpperCase()
    switch (raw) {
        case "CLINIC":
            return `An appointment at ${name}`
        case "GYM":
            return `A session at ${name}`
        case "YOGA":
            return `A class at ${name}`
        case "BARBER":
        case "PET_GROOMING":
            return `A treatment at ${name}`
        case "EVENTS_STUDIO":
        case "PHOTOGRAPHER":
        case "CATERER":
        case "TRAVEL":
            return `A call with ${name}`
        case "REAL_ESTATE_BROKERAGE":
            return `A call with ${name}`
        case "RECRUITMENT_AGENCY":
            return `A call with ${name}`
    }
    switch (kitRole(role)) {
        case "RESTAURANT":
            return `A table at ${name}`
        case "HOTEL":
            return `A stay at ${name}`
        case "SHOP":
            return `An order from ${name}`
        case "JEWELRY_RETAIL":
            return `Hi, I want to see jewellery at ${name}`
        case "JEWELRY_WHOLESALE":
            return `Hi, I supply shops. Asking about stock from ${name}`
        case "DISTRIBUTOR":
            return `Hi, placing a dealer order with ${name}`
        case "PHARMACY":
            return `Hi, I need a medicine from ${name}`
        case "AUTO_PARTS":
            return `Hi, I need a part from ${name}`
        case "CREATOR":
            return `Hi, I want the guide from ${name}`
        case "CONSULTANT":
        case "CA":
        case "COACH":
            return `A booking with ${name}`
        case "SALON_SPA":
            return `A treatment at ${name}`
        case "FIELD_SERVICE":
            return `A visit with ${name}`
        default:
            return `Hi ${name}`
    }
}

/** Guest Book CTA — flavor-aware before kit alias (GYM/YOGA/BARBER → SALON_SPA kit). */
export function bookChip(role?: string | null) {
    const raw = (role || "").trim().toUpperCase()
    // Keep salon kit surfaces; honest nouns per flavor roleTemplate.
    switch (raw) {
        case "CLINIC":
            return "Book an appointment"
        case "GYM":
            return "Book a session"
        case "YOGA":
            return "Book a class"
        case "BARBER":
        case "PET_GROOMING":
            return "Book a treatment"
        case "EVENTS_STUDIO":
        case "PHOTOGRAPHER":
        case "CATERER":
        case "TRAVEL":
            return "Book a call"
        case "REAL_ESTATE_BROKERAGE":
            return "Book a call"
        case "RECRUITMENT_AGENCY":
            return "Book a call"
    }
    switch (kitRole(role)) {
        case "RESTAURANT":
            return "Reserve a table"
        case "HOTEL":
            return "Ask the concierge"
        case "CA":
            return "Book a consult"
        case "SALON_SPA":
            return "Book a treatment"
        case "FIELD_SERVICE":
            return "Request a visit"
        case "CONSULTANT":
        case "COACH":
            return "Book a session"
        default:
            return "Book a call"
    }
}

/** Guest home Book CTA for TAKE_APPOINTMENTS / salon-spa kits lands on /book. */
export function appointmentBookHref(slug: string, role?: string | null, goal?: string | null) {
    if (!slug) return null
    if (goal === "TAKE_APPOINTMENTS" || kitRole(role) === "SALON_SPA") {
        return `/${slug}/book`
    }
    return null
}

export function aboutFooterCtas(role?: string | null): AboutFooterCta[] {
    switch (kitRole(role)) {
        case "RESTAURANT":
            return [
                { hrefKind: "menu", label: "Menu" },
                { hrefKind: "reserve", label: "A table" },
            ]
        case "HOTEL":
            return [
                { hrefKind: "chat", label: "Concierge" },
                { hrefKind: "book", label: "Reception" },
            ]
        case "SHOP":
            return [
                { hrefKind: "shop", label: "Shop" },
                { hrefKind: "chat", label: "WhatsApp" },
            ]
        case "JEWELRY_RETAIL":
            return [
                { hrefKind: "shop", label: "Jewellery" },
                { hrefKind: "chat", label: "WhatsApp" },
            ]
        case "JEWELRY_WHOLESALE":
            return [
                { hrefKind: "shop", label: "Stock" },
                { hrefKind: "chat", label: "WhatsApp" },
            ]
        case "DISTRIBUTOR":
            return [
                { hrefKind: "shop", label: "Inventory" },
                { hrefKind: "chat", label: "WhatsApp" },
            ]
        case "PHARMACY":
            return [
                { hrefKind: "shop", label: "Medicines" },
                { hrefKind: "chat", label: "WhatsApp" },
            ]
        case "AUTO_PARTS":
            return [
                { hrefKind: "shop", label: "Parts" },
                { hrefKind: "chat", label: "WhatsApp" },
            ]
        case "CREATOR":
            return [
                { hrefKind: "guide", label: "Get the guide" },
                { hrefKind: "shop", label: "Shop" },
            ]
        case "CONSULTANT":
        case "CA":
        case "COACH":
        case "SALON_SPA":
        case "FIELD_SERVICE":
            return [
                { hrefKind: "book", label: bookChip(role) },
                { hrefKind: "chat", label: "Chat" },
            ]
        case "DESIGNER":
        case "JOB_SEEKER":
            return [{ hrefKind: "chat", label: "See work" }]
        default:
            return [{ hrefKind: "chat", label: "Chat" }]
    }
}

export function catalogArCta(role?: string | null) {
    return kitRole(role) === "RESTAURANT" ? "View on table" : "View in your space"
}

export function zomatoAllowed(role?: string | null) {
    return kitRole(role) === "RESTAURANT"
}

/** Headline + about copy for a kit when the profile has not filled them yet. */
export function kitAbout(role?: string | null, name = ""): { headline: string; bio: string } {
    const shop = name.trim() || "This shop"
    switch (kitRole(role)) {
        case "PHARMACY":
            return {
                headline: "Neighbourhood pharmacy",
                bio: `${shop} is a neighbourhood pharmacy for everyday fever, cold, and prescription medicines.\n\nEverything on the shelf is a physical item — tablets, syrups, and other OTC or Rx stock with batch and expiry. Nothing here is a digital download.\n\nAsk about a medicine, check what’s in stock, or order for pickup at the counter.`,
            }
        case "AUTO_PARTS":
            return {
                headline: "Parts that fit",
                bio: `${shop} stocks auto parts by make, model, and year. Parts are physical counter items, not downloads. Ask for a fitment or open the catalogue.`,
            }
        case "JEWELRY_RETAIL":
            return {
                headline: "Gold by weight",
                bio: `${shop} prices jewellery from today’s city gold board — weight, purity, and making. Pieces are in the showroom, not digital files.`,
            }
        case "RESTAURANT":
            return {
                headline: "Kitchen and tables",
                bio: `${shop} is a neighbourhood kitchen. See the menu, ask what’s on today, or reserve a table.`,
            }
        case "HOTEL":
            return {
                headline: "Ask the concierge",
                bio: `${shop} is a stay. Scan a room QR, ask for towels or Wi-Fi, or talk to reception. Connected restaurants keep their own menus.`,
            }
        case "SHOP":
            return {
                headline: "Neighbourhood shop",
                bio: `${shop} sells real stock you can pick up or have delivered. Open the shop to see what’s in.`,
            }
        default:
            return { headline: "", bio: "" }
    }
}

/** Guest /book empty copy — flavor-before-kit; never leak gym "sessions" onto pharmacy/clinic. */
export function guestBookEmptyCopy(role?: string | null, primaryGoal?: string | null): string {
    const raw = (role || "").trim().toUpperCase()
    // Food / reserve kits
    if (kitRole(role) === "RESTAURANT") {
        return "Reservations are not open yet."
    }
    // Flavor roles before kit alias (CLINIC→CONSULTANT, GYM→SALON_SPA, …)
    switch (raw) {
        case "CLINIC":
            return "No appointments to book."
        case "GYM":
            return "No sessions to book."
        case "YOGA":
            return "No classes to book."
        case "BARBER":
        case "PET_GROOMING":
            return "No treatments to book."
        case "EVENTS_STUDIO":
        case "PHOTOGRAPHER":
        case "CATERER":
        case "TRAVEL":
            return "No calls to book."
        case "REAL_ESTATE_BROKERAGE":
            return "No calls to book."
        case "RECRUITMENT_AGENCY":
            return "No calls to book."
        case "FIELD_SERVICE":
        case "PLUMBER":
        case "ELECTRICIAN":
        case "AC_REPAIR":
        case "GARAGE":
            return "No visits to book."
        case "PHARMACY":
            return "This shop sells medicines — browse MEDICINES."
    }
    // Sell-products kits must never show appointment/session empty chrome
    if (primaryGoal === "SELL_PRODUCTS") {
        switch (kitRole(role)) {
            case "PHARMACY":
                return "This shop sells medicines — browse MEDICINES."
            case "AUTO_PARTS":
                return "This shop sells parts — browse the catalogue."
            case "JEWELRY_RETAIL":
            case "JEWELRY_WHOLESALE":
            case "DISTRIBUTOR":
            case "SHOP":
                return "Nothing to book online — browse the shop."
            default:
                return "Nothing to book online — browse the shop."
        }
    }
    switch (kitRole(role)) {
        case "PHARMACY":
            return "This shop sells medicines — browse MEDICINES."
        case "SALON_SPA":
            return "No treatments to book."
        case "CONSULTANT":
        case "CA":
            return "No appointments to book."
        case "FIELD_SERVICE":
            return "No visits to book."
        case "COACH":
            return "No sessions to book."
        default:
            return "No sessions to book."
    }
}
