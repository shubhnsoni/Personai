# Security ownership foundation

This module is the server-side authorization boundary for profile-owned production data. Middleware is not an authorization boundary: every protected route handler and Server Action must call this API before reading or writing tenant data.

## Reuse and composition

1. **Server-derived authenticated user:** reused `syncUser()` from `src/lib/auth-sync.ts`; `src/lib/security/server.ts` adapts it as the only production identity source.
2. **Active or owned profile:** new `requireOwnedProfile()` composes `syncUser()`'s server-derived, active-first profile list. A caller profile id is only matched inside that owned list.
3. **Tenant-scoped lookup/write:** new `requireOwnedResource()` and `executeOwnedResourceWrite()` pass the server-owned profile id and validated resource id together to one callback.
4. **Non-enumerating refusal:** new ownership core maps both a foreign resource and a missing resource to the same immutable `FORBIDDEN` refusal.
5. **Shared API/action semantics:** new `ownershipRefusalResponse()`, `toOwnershipActionFailure()`, and `unwrapOwnershipResult()` share one 401/403 refusal contract. This preserves the existing Business OS meaning: 401 is not signed in; 403 is signed in but not allowed.

The existing `PersistedTenancy.requireAccess()` is retained for workspace-membership authorization, but it does not cover legacy Profile ownership or generic profile resources. The in-memory tenancy contracts provide vocabulary but are not a production Clerk/Prisma boundary. `requireSurface()` redirects pages and is not suitable for API or Server Action error semantics.

## Public API

Import production helpers from `@/lib/security`:

- `requireAuthenticatedUser()` returns `{ ok: true, value: { userId, profiles } }` or a typed 401 refusal. `userId` is always from `syncUser()`, never an argument.
- `requireOwnedProfile({ claimedProfileId?, entitlement? })` returns the active profile when no claim is supplied, or validates the claim against the server-derived owned profile list. Unknown, blank, malformed, foreign, and unentitled profiles return the same typed 403 refusal.
- `requireOwnedResource({ resourceId, claimedProfileId?, entitlement?, findOwned })` invokes `findOwned` once with `{ resourceId, profile, actor }`. The callback must issue one query constrained by `id: resourceId` and `profileId: profile.id`.
- `executeOwnedResourceWrite({ resourceId, claimedProfileId?, entitlement?, writeOwned })` invokes one atomic write callback with the same server-derived scope. The callback must constrain the mutation by both ids and return `null` when no row was affected. Do not pre-read and then mutate by id alone.
- `ownershipRefusalResponse(refusal)` creates the stable JSON API response.
- `toOwnershipActionFailure(refusal)` returns the same safe error envelope for a Server Action.
- `unwrapOwnershipResult(result)` throws `OwnershipRefusalError` when an existing action contract is exception-based.

No helper accepts a user id identity claim. Opaque ids must be exact non-blank strings of at most 191 characters with no whitespace or control characters.

## Exact integration patterns for lanes A-E

### Lane A — caller-supplied user ids

Call `requireAuthenticatedUser()` inside the action. On refusal, return `toOwnershipActionFailure(result.refusal)` or call `unwrapOwnershipResult(result)`. Use only `result.value.userId` in the Prisma create/connect operation. Remove or ignore the caller `userId`; never compare two caller values.

### Lane B — profile-scoped creates and synchronization

Call `requireOwnedProfile({ claimedProfileId: profileId, entitlement })`. Use only `result.value.profile.id` for every `profileId` field and filter. The optional `entitlement` callback must invoke the lane's existing surface/permission predicate and return a boolean. Do not trust the original argument after this call.

### Lane C — profile-owned reads

Call `requireOwnedResource({ resourceId, claimedProfileId, entitlement, findOwned: ({ resourceId, profile }) => prisma.<delegate>.findFirst({ where: { id: resourceId, profileId: profile.id } }) })`. A null result is already the non-enumerating 403 refusal; do not run a second unscoped lookup to distinguish missing from foreign.

### Lane D — profile-owned updates and deletes

Call `executeOwnedResourceWrite({ resourceId, claimedProfileId, entitlement, writeOwned })`. In `writeOwned`, use one `updateMany`/`deleteMany` constrained by `{ id: resourceId, profileId: profile.id }` and return a success value only when `count === 1`; otherwise return `null`. Never call `findUnique({ id })` followed by `update({ id })` or `delete({ id })`.

### Lane E — route/action adapters and entitlements

Run the relevant helper inside every handler/action even when middleware already protects the path. For a route refusal, `return ownershipRefusalResponse(result.refusal)`. For a result-returning action, `return toOwnershipActionFailure(result.refusal)`; for an exception-based action, call `unwrapOwnershipResult(result)`. Pass role/surface checks through `entitlement`; do not combine redirect/token options with role, permission, feature, plan, or reverification options in one `auth.protect()` argument object.

## Prohibited integration shortcuts

- Do not pass a caller `userId` into this module or Prisma as identity.
- Do not query a resource by id and check `profileId` afterward.
- Do not distinguish foreign and missing resources by status, message, details, logging visible to callers, or a follow-up query.
- Do not add development bypasses, environment switches, debug claims, or middleware-only authorization.
