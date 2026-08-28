import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
