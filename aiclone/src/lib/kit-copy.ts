export type AboutFooterHrefKind = "menu" | "shop" | "reserve" | "book" | "guide" | "chat" | "tip"

export type AboutFooterCta = {
    hrefKind: AboutFooterHrefKind
    label: string
}

function kitRole(role?: string | null) {
    if (role === "DEVELOPER" || role === "EDITOR") return "DESIGNER"
    return role || ""
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
