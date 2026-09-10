import { cookies, headers } from "next/headers"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    DEFAULT_UI_LOCALE,
    UI_LOCALE_COOKIE,
    UI_LOCALE_HEADER,
    UI_PATHNAME_HEADER,
    localeFromPathname,
    parseUiLocale,
    resolveRequestUiLocale,
    uiLocaleCookieOptions,
    type UiLocale,
} from "./ui-locale"

export async function getRequestLocale(): Promise<UiLocale> {
    try {
        const h = await headers()
        const hinted = parseUiLocale(h.get(UI_LOCALE_HEADER))
        if (hinted) return hinted
        const fromPath = localeFromPathname(h.get(UI_PATHNAME_HEADER) || "")
        if (fromPath) return fromPath
        const jar = await cookies()
        return parseUiLocale(jar.get(UI_LOCALE_COOKIE)?.value) ?? DEFAULT_UI_LOCALE
    } catch {
        return DEFAULT_UI_LOCALE
    }
}

export function uiLocaleRequestHeaders(req: NextRequest): Headers {
    const requestHeaders = new Headers(req.headers)
    const locale = resolveRequestUiLocale(req.nextUrl.pathname, req.cookies.get(UI_LOCALE_COOKIE)?.value)
    requestHeaders.set(UI_LOCALE_HEADER, locale)
    requestHeaders.set(UI_PATHNAME_HEADER, req.nextUrl.pathname)
    return requestHeaders
}

export function persistLocaleHomeCookie(req: NextRequest, response: NextResponse): NextResponse {
    const locale = localeFromPathname(req.nextUrl.pathname)
    if (!locale) return response
    if (req.cookies.get(UI_LOCALE_COOKIE)?.value === locale) return response
    response.cookies.set(UI_LOCALE_COOKIE, locale, uiLocaleCookieOptions())
    return response
}
