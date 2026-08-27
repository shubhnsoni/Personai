# Persisted tenancy, contact, activity, and task adapters

## Scope

This lane wires the committed tenancy and foundation contracts to the committed Prisma models without changing `prisma/**`, generating a client, running a migration, or issuing a database-write command. Runtime writes occur only when an authenticated caller invokes a platform API.

Implemented modules:

- `src/lib/persistence/tenancy.ts`: Clerk-session identity to persisted `User` and `Membership`, deny-by-default role permissions, workspace/location scope.
- `src/lib/persistence/contacts.ts`: deterministic tenant-qualified `Contact` identity plus idempotent `ContactSourceLink` ingestion.
- `src/lib/persistence/activities.ts`: tenant-qualified, append-only, idempotent `ActivityEvent` persistence and contract ordering.
- `src/lib/persistence/tasks.ts`: durable enqueue, lease, retry/backoff, dead-letter, lease expiry, and in-flight idempotency behavior over `TaskJob`.
- `src/lib/persistence/service.ts`: framework-neutral request validation, authorization, response envelopes, and dependency-error handling.
- `src/app/api/platform/**`: thin Next.js route bindings.

## Tenant and authorization boundary

Every data operation receives a workspace identifier from the request and resolves the signed-in Clerk user to the existing application `User`, then to the exact `(workspaceId, userId)` membership. Unknown accounts, absent memberships, unknown roles, and insufficient permissions fail closed.

Read APIs require `profile.read`. Contact/activity/task writes and worker transitions require `profile.update`. A location-qualified scope is accepted only when the membership is workspace-wide or explicitly linked to that location. A membership with explicit location links is denied when a route cannot supply a location-qualified resource, preventing silent widening to workspace scope. Workspace listing is derived only from the caller's memberships.

Cross-tenant failures never return another tenant's row. Contact and activity writes verify workspace ownership. Task lookups and transitions intentionally return `NOT_FOUND` for another workspace so row existence is not disclosed.

## Contact and activity persistence

The committed foundation resolver remains authoritative for normalization and confidence. Persisted contact IDs add a workspace namespace to the resolver's deterministic ID, preventing the same normalized email in two workspaces from sharing a row. Source-link uniqueness makes replaying the same source an update/no-op rather than a duplicate; attempting to reuse an existing source link from another workspace is forbidden.

Activity IDs similarly add a workspace namespace. Append first verifies that the contact belongs to the workspace. Replaying an event returns the existing event. Reads always traverse the contact's workspace relation and preserve the foundation ordering rule: timestamp ascending, null timestamps last, then ID.

## Task persistence and schema constraint

The committed `TaskJob` model has no workspace column. The adapter therefore stores a versioned envelope in `payload` containing `workspaceId`, the caller payload, and the caller-visible idempotency key. Database idempotency keys are prefixed with the workspace identifier. Every get, lease, completion, failure, and lease-expiry transition parses and checks the envelope before returning or mutating a row.

Leasing uses a conditional `updateMany` claim (`PENDING` and due at claim time) so competing workers cannot both claim the same candidate. Lease tokens are generated per successful claim. Retry delay uses the committed foundation exponential-backoff function. Reaching `maxAttempts` dead-letters the task. Terminal transitions clear the database's unique idempotency key, preserving the foundation contract that a deliberate rerun after completion may create a new task.

Because workspace scope is encoded in the payload rather than an indexed column, leasing scans a bounded due-task candidate window and filters envelopes in application code. A future additive schema change should add `workspaceId` and an index such as `(workspaceId, state, nextAttemptAt)`; this lane does not own or alter the schema.

## API surface

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/platform/workspaces` | List caller memberships only |
| `GET` | `/api/platform/contacts?workspaceId=...` | Tenant-scoped contacts |
| `POST` | `/api/platform/contacts` | Idempotently ingest one foundation contact source |
| `GET` | `/api/platform/activities?workspaceId=...&contactId=...` | Tenant-scoped ordered activity |
| `POST` | `/api/platform/activities` | Idempotently append activity events |
| `POST` | `/api/platform/tasks` | Enqueue; returns `202` |
| `POST` | `/api/platform/tasks/lease` | Lease due tasks for one workspace |
| `POST` | `/api/platform/tasks/[taskId]/complete` | Complete with matching lease token |
| `POST` | `/api/platform/tasks/[taskId]/fail` | Retry or dead-letter with matching lease token |

All responses use either `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`. Empty collections are successful loaded states. Invalid JSON/input is `400`, unauthenticated is `401`, authorization failure is `403`, hidden/missing resources are `404`, illegal lease transitions are `409`, and unexpected persistence failures are a generic `503` without internal error details.

## Falsifiable harness

`scripts/one-off/check-persisted-adapters.ts` uses a deterministic in-memory Prisma-shaped adapter; it never opens a database connection. It covers authentication, membership authorization, tenant-qualified identity, source/activity replay, metadata round-trip, task idempotency and tenant qualification, lease-token checks, completion, dead-lettering, empty-state responses, stable API errors, and cross-tenant non-disclosure.

The normal run must pass. Setting `INVERT_ASSERTION=1` deliberately reverses the authenticated workspace-scope assertion and must exit non-zero. This demonstrates that the harness detects the isolation regression rather than only exercising code paths.

## Gates

Run from the worktree root:

1. `npx prisma validate` with a process-local placeholder only when configuration parsing requires `DATABASE_URL`; do not generate.
2. `npx tsc --noEmit --pretty false`.
3. `npx eslint src/lib/persistence src/app/api/platform scripts/one-off/check-persisted-adapters.ts`.
4. Run the harness through `ts-node/register` with a local module-resolution hook for the existing `@/` alias.
5. Run the harness once more with `INVERT_ASSERTION=1` and require non-zero exit.
6. `npm run build`.
