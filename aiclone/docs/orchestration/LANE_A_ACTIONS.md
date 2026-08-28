# Lane A tenant-owned Server Actions

## Identity and refusal contract

Owner/admin Server Actions derive identity only through `src/lib/security`. Caller-supplied profile or resource ids are claims to validate, never identity. Anonymous calls throw the shared `UNAUTHORIZED` (401, `Authentication required`) refusal. Foreign and missing ids throw the same `FORBIDDEN` (403, `Access denied`) refusal.

Creates use the profile returned by `requireOwnedProfile`. Updates and deletes use `executeOwnedResourceWrite` and a single `updateMany` or `deleteMany` predicate containing both the resource id and server-owned profile id. Order confirmation keeps all reads and writes tenant-scoped inside one transaction.

## Onboarding API for P2-003

Canonical safe call shape:

```ts
createProfile(data)
```

Exact exported signature:

```ts
createProfile(
  dataOrClaimedUserId: CreateProfileData | string,
  legacyData?: CreateProfileData,
): Promise<CreateProfileResult>
```

`CreateProfileResult` is `{ slug: string; next: string }`. When the first argument is `CreateProfileData`, no identity claim is accepted; the database `userId` always comes from `requireAuthenticatedUser()`.

The string-first shape remains temporarily for the existing onboarding caller. That compatibility value is compared with the server-derived actor and is never written or used as identity. A mismatch receives the same non-enumerating 403 refusal. P2-003 must call `createProfile(data)`.

## Protected actions

- `createProfile`
- `addContent`, `updateContent`, `syncKnowledgeFromChats`, `deleteContent`
- `createProduct`, `updateProduct`, `deleteProduct`, `setProductActive`, `confirmProductOrder`
- `createShortLink`, `updateShortLink`, `deleteShortLink`

## Intentionally public visitor flows

The following actions remain callable without a signed-in owner because they are visitor-facing commerce interactions on public products/profiles:

- `placeManualOrder`
- `placeCartOrder`
- `placeTip`
- `addProductReview`

Their anonymous, authenticated-foreign-profile, and owner behavior is exercised by the executable authorization harness.

## Executable proof

Run:

```powershell
npx tsx 'scripts/one-off/check-actions-authz.ts'
$env:INVERT_ASSERTION = '1'; npx tsx 'scripts/one-off/check-actions-authz.ts'; Remove-Item Env:INVERT_ASSERTION
```

The harness compiles and invokes the actual action exports, injects the real ownership foundation with deterministic identities, executes Prisma operations only inside a forced-rollback transaction against the approved disposable target, stubs external revalidation/cookie/embedding effects, compares foreign and missing refusal shapes, and verifies zero fixture rows remain after rollback.
