/** Cookie and path codes for the product UI. Independent of Profile.language (shop AI / Places). */
export const UI_LOCALE_COOKIE = "pl-ui-lang"
export const UI_LOCALE_HEADER = "x-ui-locale"
export const UI_PATHNAME_HEADER = "x-introify-pathname"
export const UI_LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const DEFAULT_UI_LOCALE = "en" as const

/** Shipped UI catalogs. Switcher lists only these. */
export const SHIPPED_UI_LOCALES = ["en", "hi"] as const

/**
 * Path codes reserved so they can never become shop slugs.
 * Wave 2 catalogs (bn, te, mr, ta, gu, kn, ml, pa) stay reserved until copy is complete.
 */
export const RESERVED_UI_LOCALES = ["en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "ml", "pa"] as const

export type UiLocale = (typeof SHIPPED_UI_LOCALES)[number]
export type ReservedUiLocale = (typeof RESERVED_UI_LOCALES)[number]

export const UI_LOCALE_NATIVE_NAME: Record<UiLocale, string> = {
    en: "English",
    hi: "हिन्दी",
}

const SHIPPED = new Set<string>(SHIPPED_UI_LOCALES)
const RESERVED = new Set<string>(RESERVED_UI_LOCALES)

export function isShippedUiLocale(value: string): value is UiLocale {
    return SHIPPED.has(value)
}

export function isReservedUiLocale(value: string): value is ReservedUiLocale {
    return RESERVED.has(value)
}

/** Hindi (and later Indic) homepages live at /{code}. English stays at /. */
export function isLocaleHomeSlug(value: string): value is Exclude<UiLocale, "en"> {
    return isShippedUiLocale(value) && value !== "en"
}

export function parseUiLocale(value: string | null | undefined): UiLocale | null {
    if (!value) return null
    const code = value.trim().toLowerCase().split(/[-_]/)[0]
    return isShippedUiLocale(code) ? code : null
}

export function htmlLang(locale: UiLocale): "en" | "hi-IN" {
    return locale === "hi" ? "hi-IN" : "en"
}

export function localeHomePath(locale: UiLocale): "/" | `/${Exclude<UiLocale, "en">}` {
    return locale === "en" ? "/" : `/${locale}`
}

/** Exact /hi (no nested /hi/shop). */
export function localeFromPathname(pathname: string): UiLocale | null {
    const trimmed = pathname.replace(/\/+$/, "") || "/"
    if (trimmed === "/") return null
    if (trimmed.includes("/", 1)) return null
    const segment = trimmed.slice(1)
    if (isLocaleHomeSlug(segment)) return segment
    return null
}

/**
 * Document locale: `/` is always English, `/hi` is Hindi.
 * Other routes follow the cookie so /pricing can remember the homepage choice.
 * Never auto-redirect `/` → `/hi`.
 */
export function resolveRequestUiLocale(pathname: string, cookie?: string | null): UiLocale {
    if (pathname === "/" || pathname === "") return DEFAULT_UI_LOCALE
    const fromPath = localeFromPathname(pathname)
    if (fromPath) return fromPath
    return parseUiLocale(cookie) ?? DEFAULT_UI_LOCALE
}

export function homeHash(locale: UiLocale, id: string): string {
    const hash = id.startsWith("#") ? id : `#${id}`
    return locale === "en" ? `/${hash}` : `/${locale}${hash}`
}

export function sanitizeAppPath(value: string): string {
    try {
        const url = new URL(value, "https://introify.com")
        if (url.origin !== "https://introify.com") return "/"
        if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return "/"
        return `${url.pathname}${url.search}`
    } catch {
        return "/"
    }
}

export function localeSwitchPath(current: string, locale: UiLocale): string {
    const path = sanitizeAppPath(current)
    const pathname = (path.split("?")[0] || "/").replace(/\/+$/, "") || "/"
    const segment = pathname.slice(1)
    if (pathname === "/" || isLocaleHomeSlug(segment) || segment === "en") {
        return localeHomePath(locale)
    }
    return path
}

export function uiLocaleCookieOptions() {
    return {
        path: "/",
        maxAge: UI_LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax" as const,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }
}

export function fill(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""))
}
