import { isLocaleHomeSlug, isReservedUiLocale } from "./ui-locale"
import { isReservedSlug } from "./slugs"

/** Clerk aliases that should never be treated as profile slugs. */
export const AUTH_ALIASES: Record<string, string> = {
    "/signup": "/sign-up",
    "/signin": "/sign-in",
    "/login": "/sign-in",
}

/** Marketing pages that exist as real routes (not the [slug] profile catch-all). */
export const MARKETING_PAGE_SLUGS = [
    "about",
    "contact",
    "pricing",
    "privacy",
    "terms",
    "refund-policy",
    "delivery-policy",
    "cookie-policy",
    "acceptable-use",
    "sms-policy",
] as const

const HI_MARKETING = new RegExp(`^/hi/(${MARKETING_PAGE_SLUGS.join("|")})$`)

/** First path segments that belong to the app, not a public profile. */
export const APP_ROOT_SEGMENTS = new Set([
    ...MARKETING_PAGE_SLUGS,
    "dashboard",
    "onboarding",
    "admin",
    "sign-in",
    "sign-up",
    "api",
    "courses",
    "l",
    "library",
    "qa",
    "uploads",
    "o",
    "workspace",
    "invitations",
    "http-404",
    "_next",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    "opengraph-image",
    "twitter-image",
    "apple-icon.png",
    "icon.svg",
])

/** Reserved words with no marketing page — must HTTP 404, not a soft profile miss. */
export const DEAD_PUBLIC_PATHS = new Set([
    "/blog",
    "/docs",
    "/help",
    "/support",
    "/faq",
    "/features",
    "/legal",
    "/settings",
    "/health",
    "/status",
])

export function normalizePathname(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

export function authAliasDestination(pathname: string): string | null {
    return AUTH_ALIASES[normalizePathname(pathname).toLowerCase()] || null
}

export function hiMarketingRewrite(pathname: string): string | null {
    const match = normalizePathname(pathname).match(HI_MARKETING)
    return match ? `/${match[1]}` : null
}

export function deadPublicPath(pathname: string): boolean {
    const p = normalizePathname(pathname)
    if (DEAD_PUBLIC_PATHS.has(p)) return true
    for (const root of DEAD_PUBLIC_PATHS) {
        if (p.startsWith(`${root}/`)) return true
    }
    if (/^\/hi\/(blog|docs|help|support|faq|features|legal|settings|health|status)(\/|$)/.test(p)) return true
    return false
}

export function firstPathSegment(pathname: string): string {
    const p = normalizePathname(pathname)
    if (p === "/") return ""
    return p.slice(1).split("/")[0] || ""
}

/** True when this URL is the profile catch-all (or a nested profile surface). */
export function isProfileCatchAllPath(pathname: string): boolean {
    const slug = firstPathSegment(pathname)
    if (!slug) return false
    if (APP_ROOT_SEGMENTS.has(slug)) return false
    if (isLocaleHomeSlug(slug) && normalizePathname(pathname) === `/${slug}`) return false
    if (authAliasDestination(`/${slug}`)) return false
    return true
}

export function profileSlugFromPath(pathname: string): string | null {
    if (!isProfileCatchAllPath(pathname)) return null
    const slug = firstPathSegment(pathname)
    if (!slug || isReservedUiLocale(slug) || isReservedSlug(slug)) return null
    return slug
}
