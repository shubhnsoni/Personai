# Clerk advisory record — authoritative ranges

Source of truth: the GitHub Advisory Database API, fetched 2026-08-28. This file exists because the
orchestration log previously carried an **incorrect** claim about one of these ranges. Do not restate
ranges from `npm audit` console output — its `range` column renders an exclusive upper bound in a way
that reads as inclusive, which is exactly how the earlier error was made.

Installed and verified on local primary: **`@clerk/nextjs` 6.39.6**. Do not downgrade.

---

## GHSA-vqx2-fgx2-5wq9 — CVE-2026-41248 — CRITICAL (CVSS 3.1: 9.1)

"Official Clerk JavaScript SDKs: Middleware-based route protection bypass."
CWE-436 Interpretation Conflict, CWE-863 Incorrect Authorization.
Reported 13 APR 2026, patched and disclosed 15 APR 2026.

`createRouteMatcher` can be bypassed by crafted requests, letting them skip middleware gating and
reach downstream handlers.

| Package | Vulnerable range | First patched |
|---|---|---|
| `@clerk/nextjs` 6.x | `>= 6.0.0-snapshot.vb87a27f, < 6.39.2` | **6.39.2** |
| `@clerk/nextjs` 7.x | `>= 7.0.0, < 7.2.1` | 7.2.1 |
| `@clerk/nextjs` 5.x | `>= 5.0.0, < 5.7.6` | 5.7.6 |
| `@clerk/shared` 3.x | `>= 3.0.0-canary.v20250225091530, < 3.47.4` | 3.47.4 |
| `@clerk/shared` 4.x | `>= 4.0.0, < 4.8.1` | 4.8.1 |
| `@clerk/shared` 2.x | `>= 2.20.17, < 2.22.1` | 2.22.1 |

**CORRECTION.** For `@clerk/nextjs` 6.x, the range is `< 6.39.2` and **6.39.2 IS the patched
release**. An earlier RUNLOG entry claimed the range "includes 6.39.2" and that the floor was
therefore 6.39.3. That claim was wrong and has been marked as such in place.

### Why this advisory mattered to us specifically
The advisory names the affected middleware shape explicitly, and it is the shape this repo used:

```ts
const isProtectedRoute = createRouteMatcher(['/admin(.*)']);
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) { await auth.protect(); }
});
```

It also names the shape that correctly blocks the bypass at the middleware layer — an inverted
public-route check:

```ts
const isPublicRoute = createRouteMatcher(['/docs(.*)']);
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) { await auth.protect(); }
});
```

Scope limits worth knowing: sessions are not compromised, no user can be impersonated, and
`clerkMiddleware` still authenticates the request so `auth()` reflects real state. Checks performed
**inside** route handlers, server components and server actions are unaffected. The documented
workaround is exactly that — server-side `auth()` checks as defence in depth. That is precisely what
the current security remediation lanes are building, so those lanes are hardening against this class
of bug, not merely tidying code.

---

## GHSA-w24r-5266-9c3c — CVE-2026-42349 — HIGH (CVSS 3.1: 8.1, CVSS 4.0: 7.6)

"Clerk has an authorization bypass when combining organization, billing, or reverification checks."
CWE-754, CWE-863. Reported 18 APR 2026, patched and disclosed 22 APR 2026.

`has()` / `auth.protect()` can return true when the combined result should be false.

| Package | Vulnerable range | First patched |
|---|---|---|
| `@clerk/nextjs` 6.x | `>= 6.0.0, <= 6.39.2` | **6.39.3** |
| `@clerk/nextjs` 7.x | `>= 7.0.0, <= 7.2.3` | 7.2.4 |
| `@clerk/shared` 3.x | `>= 3.0.0, <= 3.47.4` | 3.47.5 |
| `@clerk/shared` 4.x | `>= 4.0.0, <= 4.8.2` | 4.8.3 |
| `@clerk/backend` 2.x | `>= 2.0.0, <= 2.33.2` | 2.33.3 |
| `@clerk/backend` 3.x | `>= 3.0.0, <= 3.2.13` | 3.2.14 |
| `@clerk/clerk-react` | `>= 5.9.0, <= 5.61.5` | 5.61.6 |
| `@clerk/clerk-js` 5.x | `>= 5.22.0, <= 5.125.9` | 5.125.10 |

**This is the advisory that actually justifies 6.39.6 over 6.39.2.** 6.39.2 closes the critical
middleware bypass but is still inside this high-severity range; the floor here is **6.39.3**. Two
separate advisories, two separate floors — the upgrade decision was right, the earlier reasoning
recorded for it was not.

Affected call shapes: a `has()` / `auth.protect()` call combining `reverification` with any of
`role`, `permission`, `feature`, `plan`, or combining a billing check (`feature`/`plan`) with a role
or permission check. Single-condition checks are unaffected and fail closed. The callback form is
unaffected unless the callback itself uses an affected shape.

### A second bypass in this advisory that touches our own SEC-002 change — verify it
> "A second, related bypass lives in `@clerk/nextjs`: `auth.protect()` silently discarded
> authorization params (`role`, `permission`, `feature`, `plan`, `reverification`) whenever the same
> argument object also contained `unauthenticatedUrl`, `unauthorizedUrl`, or `token`."

SEC-002's dashboard-gate fix passes **`unauthenticatedUrl`** to `auth.protect()`. On any version
below 6.39.3 that argument shape would have silently dropped co-passed authorization params. We are
on 6.39.6, so it is patched — but this is a standing constraint on the codebase, not a historical
note:

- Never pair `unauthenticatedUrl` / `unauthorizedUrl` / `token` with `role`, `permission`, `feature`,
  `plan` or `reverification` in a single `auth.protect()` argument object unless a test proves the
  authorization param is still enforced.
- Prefer sequential single-condition checks, which fail closed independently.
- Any future Clerk downgrade below 6.39.3 silently re-arms this bug in our middleware.

---

## GHSA-qjx8-664m-686j — HIGH — `js-cookie`

Per-instance prototype hijack in `assign()` enabling cookie-attribute injection. Reached us only
transitively through `@clerk/shared`, and cleared by the Clerk upgrade rather than by any direct
dependency change.

---

## Verified outcome

After upgrading to `@clerk/nextjs` 6.39.6 and letting the transitive chain resolve,
`npm audit --omit=dev` reports **0 vulnerabilities** on local primary. No Clerk 7.x / Core 3 major
migration was performed, and none is required to clear these advisories.
