import { RESERVED } from "./slugs"

export const RESERVED_USERNAMES = new Set([
    ...RESERVED,
    "www",
    "api",
    "app",
    "admin",
    "dashboard",
    "onboarding",
    "sign-in",
    "signin",
    "sign-up",
    "signup",
    "qa",
    "library",
    "static",
    "assets",
    "cdn",
    "mail",
    "ftp",
    "ns1",
    "ns2",
    "l",
    "o",
    "demo",
    "try",
    "personalink",
    "introify",
    "persona",
    "support",
    "help",
    "status",
    "blog",
    "docs",
])

export function normalizeUsername(raw: string) {
    return raw
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
}

export function suggestedUsername(displayName: string) {
    return normalizeUsername(displayName) || "shop"
}

export function usernameError(slug: string): string | null {
    if (slug.length < 3) return "Use at least 3 characters"
    if (slug.length > 40) return "Keep it under 40 characters"
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Use letters, numbers, and dashes"
    if (RESERVED_USERNAMES.has(slug)) return "That name is reserved"
    if (slug.startsWith("try-")) return "That prefix is reserved"
    return null
}
