# P1-008 Test Strategy: Mocked Auth, Authorization, and Tenant Isolation

## Scope

This package provides deterministic, in-memory checks for the Business OS access boundary. It does not need Clerk keys, a database, network access, HTTP, or a running development server.

Covered by `src/lib/testing/auth-fakes.ts` and the two one-off checks:

- An unauthenticated request receives the Business OS `401` `UNAUTHORIZED` JSON envelope.
- An authenticated session without the `businessOs` surface receives `403` `FORBIDDEN`, not `401`.
- `CUSTOM`, unknown, `null`, and empty-string roles are all denied Business OS by default.
- `businessOs` is not in `ALL_SURFACES`; the only successful case is explicit `extras.surfaces` opt-in.
- A blank required approval reason is rejected by the production blueprint validator.
- The in-memory tenant boundary derives scope from its tenant context rather than a caller-supplied filter. Cross-tenant read, overwrite, and forged-tenant write attempts are all refused with `403` `FORBIDDEN` and do not mutate the foreign record.

The request harness uses the production Business OS JSON response factory and the production surface/blueprint validation predicates. Session data, surface entitlement provider, tenant context, and tenant store are intentionally mocked and seeded in memory.

## Required Runtime Seams Not Changed

`requireBusinessOsAccess()` imports and calls the concrete Clerk/Prisma-backed `syncUser()` directly. It has no dependency-injection seam, so a deterministic check cannot invoke that exact function with fake sessions without module-loader interception or a production-code change. The harness therefore proves the request-boundary status/envelope policy against the production response and authorization predicates, not the closed Clerk/Prisma integration.

No `src/lib/tenancy/**` runtime boundary exists at this base commit. The tenant-isolation check proves the required default-deny contract with the in-memory boundary fake, but cannot prove a production tenant repository until the tenancy implementation exposes a route/service boundary that accepts a context provider.

Real Clerk validation, Clerk-to-user synchronization, active-profile cookie ordering, Prisma query correctness, database constraints, and framework-level URL parsing remain unproven because this package intentionally uses no credentials, database, network, or HTTP server.

## Malformed Percent-Encoded URL Behavior

The parser unit test remains useful for values that reach `parseBlueprintId`, but malformed URL behavior has two distinct cases:

- `/api/business-os/blueprints/%E0%A4%A` is literally malformed. Next.js rejects it at the framework level as **HTTP 400 with a `text/html` body before the route executes**. It does **not** return the Business OS JSON envelope.
- `/api/business-os/blueprints/%25E0%25A4%25A` is double-encoded, so the route receives a literal string. It reaches the handler and returns the **401 Business OS JSON envelope** when unauthenticated.

## Commands and Observed Exit Codes

All commands run from `C:\Users\shubh\Desktop\Projects\personal projects\personai-w5-evals-wt\aiclone`.

```powershell
npx prisma validate                                      # 0
# npx prisma generate                                   # skipped-by-root-order
npx tsc --noEmit --pretty false                          # 0
npx eslint src/lib/testing scripts/one-off/check-auth-authz.ts scripts/one-off/check-tenant-isolation.ts  # 0
npm run build                                            # 0
$env:TS_NODE_PROJECT='scripts/tsconfig.checks.json'; npx ts-node -r tsconfig-paths/register scripts/one-off/check-auth-authz.ts       # 0
$env:TS_NODE_PROJECT='scripts/tsconfig.checks.json'; npx ts-node -r tsconfig-paths/register scripts/one-off/check-tenant-isolation.ts # 0
```

`prisma generate` is intentionally not run: all wave worktrees share a `node_modules` junction and root performs the single integration-time generation. The checks also prove failure behavior by setting `INVERT_ASSERTION=1`; the auth/authz and tenant-isolation harnesses each exit `1` after inverting a real assertion, then both exit `0` after restoration.
