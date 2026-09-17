import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { tenantFromHost, subdomainRoute } from "@/lib/subdomain-host";
import { persistLocaleHomeCookie, uiLocaleRequestHeaders } from "@/lib/ui-locale-request";
import { DEFAULT_UI_LOCALE, isShippedUiLocale, localeHomePath, UI_LOCALE_COOKIE, type UiLocale, uiLocaleCookieOptions } from "@/lib/ui-locale";
import { authAliasDestination, deadPublicPath, hiMarketingRewrite, hotelRoomPathParts, profileSlugFromPath } from "@/lib/reserved-http";
import { http404Response } from "@/lib/http-404";

/**
 * Protected route patterns, exported so tests assert against the REAL patterns
 * instead of a hard-coded copy. A copy is how the auth HTTP regression harness
 * previously deadlocked: it asserted segment-safety against the old
 * "/dashboard(.*)" pattern, which by definition also matches "/dashboardfoo",
 * so the check could never pass no matter how middleware was fixed.
 *
 * Each prefix is written as an exact segment plus a descendant pattern.
 * "/dashboard(.*)" would also match "/dashboardfoo"; "/dashboard" plus
 * "/dashboard/(.*)" matches the route and its children only. No lookalike
 * top-level routes exist, so this is behaviour-preserving for real routes.
 */
export const PROTECTED_ROUTE_PATTERNS = [
  "/dashboard",
  "/dashboard/(.*)",
  "/onboarding",
  "/onboarding/(.*)",
  "/admin",
  "/admin/(.*)",
  "/qa",
  "/qa/(.*)",
] as const;

const isProtectedRoute = createRouteMatcher([...PROTECTED_ROUTE_PATTERNS]);

const publicSlugCache = new Map<string, { exists: boolean; at: number }>()
const PUBLIC_SLUG_TTL_MS = 30_000

async function publicSlugExists(origin: string, slug: string, cookie: string) {
    const cached = publicSlugCache.get(slug)
    if (cached && Date.now() - cached.at < PUBLIC_SLUG_TTL_MS) return cached.exists
    const bases: string[] = []
    const push = (v?: string | null) => {
      const t = (v || "").trim().replace(/\/$/, "")
      if (t && !bases.includes(t)) bases.push(t)
    }
    push(origin)
    push(process.env.NEXT_PUBLIC_APP_URL)
    try {
      const host = new URL(origin).hostname.replace(/^www\./, "")
      if (host === "introify.com" || host.endsWith(".introify.com")) push("https://introify.com")
    } catch { /* ignore */ }
    let lastError: unknown
    for (const base of bases) {
      try {
        const url = new URL("/api/public-slug", base)
        url.searchParams.set("slug", slug)
        const res = await fetch(url, { headers: { cookie }, cache: "no-store" })
        if (!res.ok) throw new Error(`public-slug HTTP ${res.status}`)
        const data = (await res.json()) as { exists?: boolean }
        const exists = Boolean(data.exists)
        publicSlugCache.set(slug, { exists, at: Date.now() })
        return exists
      } catch (err) {
        lastError = err
      }
    }
    throw lastError instanceof Error ? lastError : new Error("public-slug unreachable")
}
const publicHotelRoomCache = new Map<string, { exists: boolean; at: number }>()

async function publicHotelRoomExists(origin: string, slug: string, room: string, cookie: string) {
    const key = `${slug}::${room}`
    const cached = publicHotelRoomCache.get(key)
    if (cached && Date.now() - cached.at < PUBLIC_SLUG_TTL_MS) return cached.exists
    const bases: string[] = []
    const push = (v?: string | null) => {
      const t = (v || "").trim().replace(/\/$/, "")
      if (t && !bases.includes(t)) bases.push(t)
    }
    push(origin)
    push(process.env.NEXT_PUBLIC_APP_URL)
    try {
      const host = new URL(origin).hostname.replace(/^www\./, "")
      if (host === "introify.com" || host.endsWith(".introify.com")) push("https://introify.com")
    } catch { /* ignore */ }
    let lastError: unknown
    for (const base of bases) {
      try {
        const url = new URL("/api/public-hotel-room", base)
        url.searchParams.set("slug", slug)
        url.searchParams.set("room", room)
        const res = await fetch(url, { headers: { cookie }, cache: "no-store" })
        if (!res.ok) throw new Error(`public-hotel-room HTTP ${res.status}`)
        const data = (await res.json()) as { exists?: boolean }
        const exists = Boolean(data.exists)
        publicHotelRoomCache.set(key, { exists, at: Date.now() })
        return exists
      } catch (err) {
        lastError = err
      }
    }
    throw lastError instanceof Error ? lastError : new Error("public-hotel-room unreachable")
}


// Next 16 proxy convention: named proxy (replaces deprecated middleware.ts).
function apexHostname() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname.replace(/^www\./, "")
  } catch {
    return "localhost"
  }
}

function browserLocaleFromAcceptLanguage(acceptLanguage: string | null): UiLocale | null {
  if (!acceptLanguage) return null
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase()
  if (!first) return null
  const code = first.split(/[-_]/)[0]
  return isShippedUiLocale(code) ? code : null
}

export const proxy = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname
  if (pathname.startsWith("/api/public-slug") || pathname.startsWith("/api/public-hotel-room") || pathname.startsWith("/http-404")) {
    return persistLocaleHomeCookie(req, NextResponse.next({ request: { headers: uiLocaleRequestHeaders(req) } }))
  }

  const alias = authAliasDestination(pathname)
  if (alias) {
    const url = req.nextUrl.clone()
    url.pathname = alias
    return persistLocaleHomeCookie(req, NextResponse.redirect(url, 301))
  }

  if (deadPublicPath(pathname)) {
    return persistLocaleHomeCookie(req, http404Response(req.method))
  }

  const hiPage = hiMarketingRewrite(pathname)
  if (hiPage) {
    const requestHeaders = uiLocaleRequestHeaders(req)
    requestHeaders.set("x-ui-locale", "hi")
    const url = req.nextUrl.clone()
    url.pathname = hiPage
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    response.cookies.set(UI_LOCALE_COOKIE, "hi", uiLocaleCookieOptions())
    return response
  }

  const slug = profileSlugFromPath(pathname)
  if (slug) {
    const gated = req.cookies.get("introify-slug-gate")?.value
    if (gated === slug) {
      const res = NextResponse.next({ request: { headers: uiLocaleRequestHeaders(req) } })
      res.cookies.set("introify-slug-gate", "", { path: "/", maxAge: 0 })
      return persistLocaleHomeCookie(req, res)
    }
    try {
      const exists = await publicSlugExists(req.nextUrl.origin, slug, req.headers.get("cookie") || "")
      if (!exists) return persistLocaleHomeCookie(req, http404Response(req.method))
    } catch {
      // Hostinger edge often cannot self-fetch /api/public-slug; [slug] notFound()
      // then renders as HTTP 200 soft-404 behind hcdn. Rewrite to /http-404?slug=
      // (Node + Prisma). Real profiles get a short-lived gate cookie + redirect back.
      const url = req.nextUrl.clone()
      url.pathname = "/http-404"
      url.search = ""
      url.searchParams.set("slug", slug)
      url.searchParams.set("from", pathname)
      return persistLocaleHomeCookie(req, NextResponse.rewrite(url))
    }
  }

  const hotelRoom = hotelRoomPathParts(pathname)
  if (hotelRoom) {
    try {
      const roomOk = await publicHotelRoomExists(
        req.nextUrl.origin,
        hotelRoom.slug,
        hotelRoom.room,
        req.headers.get("cookie") || "",
      )
      if (!roomOk) return persistLocaleHomeCookie(req, http404Response(req.method))
    } catch {
      const url = req.nextUrl.clone()
      url.pathname = "/http-404"
      url.search = ""
      url.searchParams.set("slug", hotelRoom.slug)
      url.searchParams.set("room", hotelRoom.room)
      url.searchParams.set("from", pathname)
      return persistLocaleHomeCookie(req, NextResponse.rewrite(url))
    }
  }
  const requestHeaders = uiLocaleRequestHeaders(req)
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const tenant = tenantFromHost(host, apexHostname())
  if (tenant) {
    const route = subdomainRoute(req.nextUrl.pathname, tenant)
    if (route.type === "redirect") {
      const url = req.nextUrl.clone()
      url.pathname = route.pathname
      return persistLocaleHomeCookie(req, NextResponse.redirect(url))
    }
    if (route.type === "rewrite") {
      const url = req.nextUrl.clone()
      url.pathname = route.pathname
      return persistLocaleHomeCookie(req, NextResponse.rewrite(url, { request: { headers: requestHeaders } }))
    }
  }

  const localeFromBrowser = browserLocaleFromAcceptLanguage(req.headers.get("accept-language"))
  if (req.nextUrl.pathname === "/" || req.nextUrl.pathname === "") {
    const target = localeHomePath(localeFromBrowser ?? DEFAULT_UI_LOCALE)
    if (target !== "/") {
      const url = req.nextUrl.clone()
      url.pathname = target
      const response = NextResponse.redirect(url)
      return persistLocaleHomeCookie(req, response)
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }
  return persistLocaleHomeCookie(req, NextResponse.next({ request: { headers: requestHeaders } }))
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
