# Tenancy contracts (P1-011)

## Status and boundary

This wave adds pure TypeScript contracts only. It does not change Prisma, query a database, rename data, drop data, or backfill data. `Profile.id` is the compatibility workspace key for today's rows; `Booking.profileId` and `Order.profileId` therefore project into the same workspace without mutation.

The module lives in `src/lib/tenancy` and has no dependency on Prisma, Clerk, restaurant runtime, or shared auth. It provides:

- branded IDs for workspaces, locations, memberships, roles, and permissions;
- immutable workspace, location, membership, role, and permission contracts;
- a total role resolver with an explicit empty permission closure for malformed or unknown input;
- a branded tenant-scope capability required by scoped row readers;
- an explicit cross-tenant bypass that cannot be created without synchronously emitting an audit event; and
- read-only compatibility adapters for current Profile, Booking, and Order-era rows.

## Compatibility projection

Until a later schema owner persists tenancy:

| Existing source | Contract projection |
| --- | --- |
| `Profile.id` | `Workspace.id` (same value, branded) |
| `Profile.displayName` | `Workspace.name` |
| `Profile.userId` | deterministic owner `Membership` |
| Profile | deterministic `legacy-profile:<profileId>:default` location |
| `Booking.profileId` | workspace plus deterministic default location |
| `Order.profileId` | workspace plus deterministic default location |

The deterministic location and membership identifiers are bridge identifiers, not writes. Adapters return frozen values and accept structural read-only inputs so callers do not need to import generated Prisma types.

## Deny-by-default RBAC

Roles are `OWNER`, `ADMIN`, `MANAGER`, `STAFF`, and `VIEWER`. Matching is case-insensitive after trimming. Unknown values, non-strings, `null`, `undefined`, and empty strings resolve to `role: null`, `permissions: []`, and `deniedByDefault: true`.

Legend: **Y** granted; **-** denied.

| Permission | OWNER | ADMIN | MANAGER | STAFF | VIEWER |
| --- | :---: | :---: | :---: | :---: | :---: |
| workspace.read | Y | Y | Y | Y | Y |
| workspace.update | Y | Y | - | - | - |
| workspace.delete | Y | - | - | - | - |
| location.read | Y | Y | Y | Y | Y |
| location.create | Y | Y | - | - | - |
| location.update | Y | Y | Y | - | - |
| location.delete | Y | Y | - | - | - |
| membership.read | Y | Y | Y | Y | - |
| membership.invite | Y | Y | Y | - | - |
| membership.update | Y | Y | Y | - | - |
| membership.remove | Y | Y | - | - | - |
| profile.read | Y | Y | Y | Y | Y |
| profile.update | Y | Y | Y | - | - |
| booking.read | Y | Y | Y | Y | Y |
| booking.manage | Y | Y | Y | Y | - |
| order.read | Y | Y | Y | Y | Y |
| order.manage | Y | Y | Y | Y | - |
| audit.read | Y | Y | Y | - | - |
| unknown / null / empty role | - | - | - | - | - |

## Isolation contract

`requireTenantScope` compares the actor scope to the requested workspace and location. Missing scope, another workspace, or an impermissible location throws a typed `TenantScopeError`. On success it returns `RequiredTenantScope`, a branded capability. `selectTenantRows` only accepts that capability, so an accidental unscoped call fails TypeScript compilation; `withTenantScope` combines checking and use.

A workspace-wide actor may narrow to a location. A location-bound actor cannot widen to all locations or switch location. Filtering always applies workspace equality and, when present, location equality.

Cross-tenant operational access is intentionally separate: `createAuditedTenantBypass` requires actor, reason, ticket, and timestamp and synchronously writes `tenant.read.bypass` to a supplied audit sink. Only the returned branded capability is accepted by `readAcrossTenants`. Type assertions can defeat any TypeScript contract, so code review and lint policy should treat casts to these capability types as security-sensitive.

## Additive-only schema proposal for the later single-owner wave

Nothing in this proposal is renamed, dropped, or backfilled. Existing `Profile`, `Booking`, `Order`, relations, columns, and indexes remain intact while new tenancy data is introduced alongside them.

### New tables

1. **Workspace**: `id`, `name`, `slug`, `createdAt`, `updatedAt`; unique index on `slug`.
2. **Location**: `id`, `workspaceId`, `name`, `timezone`, `createdAt`, `updatedAt`; indexes on `workspaceId` and unique `(workspaceId, name)`.
3. **Membership**: `id`, `workspaceId`, `userId`, `role`, `createdAt`, `updatedAt`; unique `(workspaceId, userId)` plus indexes on `userId` and `(workspaceId, role)`.
4. **MembershipLocation**: `membershipId`, `locationId`; composite primary key plus index on `locationId`.
5. **TenantAuditEvent**: `id`, `workspaceId` nullable for cross-workspace events, `locationId` nullable, `actorUserId`, `actorMembershipId` nullable, `action`, `reason`, `ticket`, `metadata`, `createdAt`; indexes on `(workspaceId, createdAt)`, `(actorUserId, createdAt)`, and `(action, createdAt)`.

Persist `Membership.role` as an enum containing `OWNER`, `ADMIN`, `MANAGER`, `STAFF`, and `VIEWER`. Permissions remain an application-owned versioned contract in this phase; a later need for custom roles could add `RoleDefinition` and `RolePermission` tables without changing the built-in role semantics.

### New nullable columns and indexes

Add nullable `workspaceId` and `locationId` foreign keys to `Profile`, `Booking`, and `Order`, with indexes `(workspaceId, id)`, `(workspaceId, locationId, id)`, and workload-specific tenant indexes such as `(workspaceId, status)` and `(workspaceId, placedAt)`. Nullable rollout allows dual-read verification before enforcement. No existing `profileId` relation is removed or repurposed.

### Later rollout sequence (not executed here)

1. Add new tables, nullable columns, foreign keys, and indexes.
2. Dual-write new records while keeping current `profileId` behavior authoritative.
3. Run a separately approved, restartable backfill with reconciliation reports.
4. Switch reads to mandatory tenant predicates after parity checks.
5. Consider non-null constraints only in a later reviewed migration.

Every step is additive. This wave performs none of them.

## Verification

`scripts/one-off/check-tenancy-contracts.ts` is deterministic, in-memory, and performs no network or database access. It verifies every role closure, deny-by-default inputs, runtime cross-tenant refusal, scoped filtering, synchronous bypass auditing, and legacy adapter consistency.
