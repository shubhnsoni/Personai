/** App routes and product words that must never be a profile slug. */
export const RESERVED = [
    "dashboard",
    "onboarding",
    "admin",
    "sign-in",
    "sign-up",
    "api",
    "courses",
    "l",
    "login",
    "signup",
    "settings",
    "pricing",
    "blog",
    "legal",
    "health",
] as const

export type ReservedSlug = (typeof RESERVED)[number]

const RESERVED_SET = new Set<string>(RESERVED)

export function isReservedSlug(value: string): value is ReservedSlug {
    return RESERVED_SET.has(value)
}

/** Lowercase kebab-case. Empty string if nothing usable remains. */
export function slugify(input: string): string {
    return input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
}
