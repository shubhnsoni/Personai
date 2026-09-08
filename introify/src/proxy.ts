import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { tenantFromHost, subdomainRoute } from "@/lib/subdomain-host";

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

// Next 16 proxy convention: named proxy (replaces deprecated middleware.ts).
function apexHostname() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname.replace(/^www\./, "")
  } catch {
    return "localhost"
  }
}

export const proxy = clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const tenant = tenantFromHost(host, apexHostname())
  if (tenant) {
    const route = subdomainRoute(req.nextUrl.pathname, tenant)
    if (route.type === "redirect") {
      const url = req.nextUrl.clone()
      url.pathname = route.pathname
      return NextResponse.redirect(url)
    }
    if (route.type === "rewrite") {
      const url = req.nextUrl.clone()
      url.pathname = route.pathname
      return NextResponse.rewrite(url)
    }
  }
  if (isProtectedRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
