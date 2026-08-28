# Lane I — Import and Library Server Action Authorization

## Verdict

**PASS — ready for independent root inspection and serial integration.**

Branch `security/actions-import-library-authz` was cut from `05ead37ed39a7a926786419f4fc0e108d9a440b9`. The package changes only:

- `src/app/actions/import.ts`
- `src/app/actions/library.ts`
- `src/components/dashboard/import-studio.tsx` (required signature call site)
- `scripts/one-off/check-import-library-actions-authz.ts`
- this report

No `prisma/**`, package manifest, shared security helper, origin, live database, tunnel, or frozen evidence path was changed.

## Remediation

### Import

`ingestText`, `ingestUrl`, and `ingestFile` now require a claimed profile identifier and call `requireOwnedProfile` before text parsing, URL normalization/fetch, file access, model extraction, or dynamic menu work. `ImportStudio` supplies its existing profile identifier; identity remains server-derived and the claim is only matched against that identity.

`applyImportBundle` now calls `requireOwnedProfile` before sanitizing or interpreting client-returned items and replaces the caller claim with the server-derived owned profile ID for every read and write.

### Library

`requestLibraryLink` remains an intentional anonymous, non-enumerating email capability. Existing and missing member addresses return the same `{ ok: true }` response; missing addresses create no row, link, or email.

`logoutLibrary` remains an intentional public self-cookie operation and accesses no tenant resource.

`resendLibraryLink` is now authenticated and ownership-scoped. A single profile-rooted query binds the normalized recipient email to any server-derived owned profile through the dashboard's legitimate sources:

- product purchases;
- course enrollments;
- event registrations;
- community memberships;
- bookings;
- conversations;
- visitor leads;
- restaurant orders.

Only after that query succeeds may the action upsert a member, create a library link, and call the email provider. Foreign and nonexistent recipients return the same 403 refusal and have zero side effects.

## Executable evidence

Harness: `scripts/one-off/check-import-library-actions-authz.ts`

It transpiles and invokes the real production action modules with injected identity and transaction-scoped Prisma. Parser, model, fetch, file-read, nested-write, member, link, cookie, redirect, and email boundaries are deterministic counters/stubs; no real network or email provider is called. The runtime export sets are verified exactly.

Against only `personalink_phase0_rehearsal_20260826_210704`:

| Run | Exit | Result |
|---|---:|---|
| Normal | 0 | PASS |
| `INVERT_ASSERTION=1` | 1 | Intended falsification; central anonymous-refusal assertion fails |
| Restored | 0 | PASS |

Measured normal/restored evidence:

- 60 assertions.
- All seven exported actions executed.
- Protected import/resend actions: anonymous 401, foreign 403, missing 403, valid-owner success.
- Foreign and missing refusal shapes are identical.
- Refusals leave database and every parser/fetch/file/model/provider counter unchanged.
- Owner ingestion invokes only deterministic parser/model/fetch/file stubs after authorization.
- Owner apply persists only to the server-derived profile before rollback.
- Anonymous library request remains response-indistinguishable for existing/missing recipients.
- Authenticated owner resend succeeds; foreign/missing resend creates no member/link/email.
- Real external calls: 0.
- Transaction rollback restored fixture users and members to 0.

## Independent gates

| Gate | Exit / result |
|---|---|
| `npm ci --ignore-scripts` | 0; 482 packages installed from lockfile |
| `npx prisma validate` | 0 |
| `npx prisma generate` | 0 |
| `npx tsc --noEmit --pretty false` | 0 |
| Targeted ESLint | 0 errors; two unchanged inherited warnings (`htmlToText`, existing `run` hook dependency) |
| Import/library harness normal/inverted/restored | `0/1/0` |
| `check-ownership-foundation.ts` | 0 |
| `check-auth-authz.ts` | 0 |
| `check-tenant-isolation.ts` | 0 |
| `check-actions-authz.ts` | 0; 117 assertions, rollback 0 |
| `check-resource-authz.ts` | 0; 32 assertions |
| `npm audit --omit=dev` | 0; 0 vulnerabilities |
| `npm run build` | 0 |
| `git diff --check` | 0 |

`npm ci` reported five advisories in the full development tree (1 low, 4 high); the required production-only audit reports zero vulnerabilities.

## Safety

The database URL was derived command-locally from the primary environment, with only its pathname replaced by `personalink_phase0_rehearsal_20260826_210704`; no environment value was printed. The harness calls `assertDisposableTarget` and refuses any other database name. All fixtures and action writes run inside one transaction and are deliberately rolled back.
