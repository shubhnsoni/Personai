import { resolveKitRole } from "@/lib/role-alias"

export const RESTAURANT_IMPORT_MESSAGE = "Zomato, Swiggy and Uber Eats imports are available for restaurant and cafe businesses. Use your business website, a CSV or pasted product details instead."

export function restaurantImportsAllowed(role?: string | null) {
    return resolveKitRole(role) === "RESTAURANT"
}

export function isRestaurantImportUrl(value: string) {
    try {
        const host = new URL(value).hostname.toLowerCase().replace(/\.$/, "")
        return ["zomato.com", "swiggy.com", "ubereats.com", "uber.com"].some(domain => host === domain || host.endsWith(`.${domain}`))
    } catch { return false }
}

export function assertImportSourceAccess(role: string | null | undefined, url: string) {
    if (!restaurantImportsAllowed(role) && isRestaurantImportUrl(url)) throw new Error(RESTAURANT_IMPORT_MESSAGE)
}
