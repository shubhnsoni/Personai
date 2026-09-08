# Lane H — Course and Profile Server Action Authorization

## Verdict

**PASS — ready for independent root inspection and serial integration.**

Branch `security/actions-course-profile-authz` was cut from `05ead37ed39a7a926786419f4fc0e108d9a440b9`. The package changes only:

- `src/app/actions/courses.ts`
- `src/app/actions/profile.ts`
- `scripts/one-off/check-course-profile-actions-authz.ts`
- this report

No `prisma/**`, package manifest, shared security helper, origin, live database, tunnel, or frozen evidence path was changed.

## Remediation

All 20 exported mutations now derive identity on the server and bind writes to the authenticated profile:

- Course: create, update, delete, publish.
- Module: create, update, delete, move.
- Lesson: create, update, delete, move.
- Curriculum: import modules and lessons.
- Profile: update.
- Work experience: create, update, delete.
- Project: create, update, delete.

Creates require an owned profile or an owned parent resource. Updates and deletes use `executeOwnedResourceWrite` with the resource identifier and authenticated profile predicate in the same `updateMany`/`deleteMany` operation. Module and lesson moves run inside scoped transactions; both swap writes repeat the owner relation predicate. Course recounts are also constrained by `courseId + profileId`.

`updateProfile` validates the claimed profile against the server-derived profile list and writes with `id + userId`. Foreign and nonexistent identifiers therefore return the same `OwnershipRefusalError` shape without disclosing existence.

## Executable evidence

Harness: `scripts/one-off/check-course-profile-actions-authz.ts`

It transpiles and invokes the real production action modules with injected identity, transaction-scoped Prisma, and observable `revalidatePath`/curriculum-parser counters. It executes every runtime-exported mutation and verifies the export set exactly.

Against only `personalink_phase0_rehearsal_20260826_210704`:

| Run | Exit | Result |
|---|---:|---|
| Normal | 0 | PASS |
| `INVERT_ASSERTION=1` | 1 | Intended falsification; central anonymous-refusal assertion fails |
| Restored | 0 | PASS |

Measured normal/restored evidence:

- 183 assertions.
- 20 protected production mutations executed.
- Anonymous requests: 401 `UNAUTHORIZED`.
- Foreign-tenant requests: 403 `FORBIDDEN`.
- Missing and foreign identifiers: byte-identical normalized error shape.
- Every refusal: database snapshot, revalidation count, and curriculum-parser count unchanged.
- Every valid owner mutation: persisted expected state before rollback.
- Import parsing occurs only after ownership succeeds.
- External provider calls: 0.
- Transaction rollback restored fixture rows to 0.

## Independent gates

| Gate | Exit / result |
|---|---|
| `npm ci --ignore-scripts` | 0; 482 packages installed from lockfile |
| `npx prisma validate` | 0 |
| `npx prisma generate` | 0 |
| `npx tsc --noEmit --pretty false` | 0 |
| Targeted ESLint over both actions and harness | 0 |
| Course/profile harness normal/inverted/restored | `0/1/0` |
| `check-ownership-foundation.ts` | 0 |
| `check-auth-authz.ts` | 0 |
| `check-tenant-isolation.ts` | 0 |
| `check-actions-authz.ts` | 0; 117 assertions, rollback 0 |
| `check-resource-authz.ts` | 0; 32 assertions |
| `npm audit --omit=dev` | 0; 0 vulnerabilities |
| `npm run build` | 0 |
| `git diff --check` | 0 |

`npm ci` reported five advisories in the full development tree (1 low, 4 high); the required production-only audit reports zero vulnerabilities.

The catalog harness is not present on this branch because catalog remediation was independently integrated after this branch's `05ead37` base. It must be rerun on the combined primary after this commit is cherry-picked; its absence here is not represented as a pass.

## Safety

The database URL was derived command-locally from the primary environment, with only its pathname replaced by `personalink_phase0_rehearsal_20260826_210704`; no environment value was printed. The harness calls `assertDisposableTarget` and refuses any other database name. All fixture changes run in one transaction and are deliberately rolled back.
