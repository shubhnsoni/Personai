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
    switch (kitRole(role)) {
        case "RESTAURANT":
            return `A table at ${name}`
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

export function bookChip(role?: string | null) {
    switch (kitRole(role)) {
        case "RESTAURANT":
            return "Reserve a table"
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

export function aboutFooterCtas(role?: string | null): AboutFooterCta[] {
    switch (kitRole(role)) {
        case "RESTAURANT":
            return [
                { hrefKind: "menu", label: "Menu" },
                { hrefKind: "reserve", label: "A table" },
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
        case "SHOP":
            return {
                headline: "Neighbourhood shop",
                bio: `${shop} sells real stock you can pick up or have delivered. Open the shop to see what’s in.`,
            }
        default:
            return { headline: "", bio: "" }
    }
}
