# P2-001 — Additive schema rehearsal report

Sole Prisma writer. Rehearsed end to end against the authorized disposable database only. The live
`personalink` database was never targeted and remains untouched.

## Authorized target and guard protocol

Target: `personalink_phase0_rehearsal_20260826_210704` (disposable).

Every destructive command went through `scripts/one-off/p2-guarded-sql.ts`, which enforces a
five-step preflight and has no bypass flag:

1. parse the connection target and print **only** the redacted name;
2. `assertDisposableTarget` must accept it;
3. the parsed name must equal the authorized target **exactly**;
4. the external backup must still exist, and its SHA-256 is recorded;
5. abort otherwise.

It additionally re-asserts `select current_database()` **after connecting**, so the database the
session is actually attached to is proven — not merely what the URL claimed.

Backup: `pre-migration-2026-08-27T13-52-27-343Z.dump`, 149,270 bytes,
SHA-256 `77c6eeb27b065b84fdab1cd0e77f820540ff5c1e53ac54dc6da286ab1fb4cc69`, stored outside the
repository. Never deleted.

### Guard negative tests (all correctly refused, nothing executed)

| Target attempted | Outcome |
|---|---|
| `personalink` | ABORT — `assertDisposableTarget` refused |
| `PersonaLink` | ABORT — refused (case-insensitive) |
| `PERSONALINK` | ABORT — refused (case-insensitive) |
| `personalink_phase0_clean_20260826_221845` | ABORT — disposable, but **not the authorized target** |

After all four attempts the rehearsal database was still at 56 tables with the enum and function
intact, proving nothing ran.

## Migration

`20260827140000_phase0_foundations` — additive only. 14 new tables, 38 indexes, 1 enum
(`MembershipRole`), 1 function and 2 append-only triggers. **Zero** `DROP`, `TRUNCATE`,
`DELETE FROM` or `RENAME` against pre-existing objects; all 26 `ALTER TABLE` statements target only
the new tables for FK wiring.

New tables: `Workspace`, `Location`, `Membership`, `MembershipLocation`, `Contact`,
`ContactSourceLink`, `ActivityEvent`, `TaskJob`, `WorkflowRun`, `AgentRun`, `WorkflowStep`,
`ToolCall`, `Approval`, `CopilotAuditEvent`.

## Rollback rehearsal

`down.sql` is documented and is never run automatically by Prisma. Its drop order is **topological,
derived from the live catalog rather than assumed**: a hand-ordered first attempt failed with
`2BP01 cannot drop table "WorkflowStep" because ... "Approval" depends on it` and **rolled back
atomically** (56 tables still present afterwards, proving transactional safety). The FK graph among
the new tables was then queried and the order recomputed, children strictly before parents, so no
`CASCADE` is needed. `CASCADE` is deliberately avoided because it could silently drop constraints on
pre-existing tables.

Rollback result — **zero residue**:

| Check | Result |
|---|---|
| new tables remaining | 0 of 14 |
| `MembershipRole` enum | dropped |
| `reject_append_only_mutation` function | dropped |
| append-only triggers | 0 remaining |
| migration ledger row | removed |

Catalog diff after rollback, versus the pre-rollback snapshot minus the 14 new tables:

| Metric | Result |
|---|---|
| tables | 42 present / 42 expected |
| missing tables | none |
| unexpected tables | none |
| missing columns | 0 |
| unexpected columns | 0 |
| pre-existing row counts | all unchanged except `_prisma_migrations` 8 -> 7, which is the intended ledger removal |

Restore from backup was therefore **not required**: the down migration alone returned the schema to
its exact prior shape. The backup remains available and its hash is recorded above.

## Reapply

`prisma migrate deploy` re-applied cleanly: 8 migrations found, `20260827140000_phase0_foundations`
applied, all 8 `finished_at` non-null. Post-reapply state: 56 tables, 14/14 new tables, enum
restored, and all four append-only triggers restored.

## Invariants — `scripts/one-off/check-schema-invariants.ts`

18/18 pass, exit 0. Every write happens inside a transaction that is deliberately rolled back, so
the harness leaves the database exactly as it found it (verified: zero residue rows).

| Invariant | Evidence |
|---|---|
| all 14 new tables present | 14/14 |
| `MembershipRole` enum present | count=1 |
| append-only function present | count=1 |
| legacy FKs nullable | `Workspace/Contact/ContactSourceLink/ActivityEvent/WorkflowRun.profileId` all `is_nullable=YES` |
| triggers registered | `ActivityEvent` and `CopilotAuditEvent`, for UPDATE **and** DELETE |
| append-only actually enforced | `ERROR: ActivityEvent is append-only; UPDATE is forbidden` and `... DELETE is forbidden` (SQLSTATE 55000) |
| backfill projects every Profile | profiles=16, projected=16 |
| backfill replay idempotent | first=16, second=16 — replay is a no-op |
| harness residue | 0 rows |
| `Profile` count stable | 16 -> 16 |

Enforcement was additionally confirmed **outside** the harness, unmutated row and all: a seeded row
survived both a rejected UPDATE and a rejected DELETE, and cleanup left residue 0/0/0 with the
trigger re-enabled (`tgenabled='O'`).

**Failure-mode proof.** `INVERT_ASSERTION=1` flips the nullability expectation: the harness drops to
13/18 and exits **1**; restored, it returns to 18/18 and exit **0**. It fails loudly rather than
passing vacuously.

An earlier revision of this harness reported `ActivityEvent refuses UPDATE (no error raised)` while
still passing, because Prisma error messages begin with a blank line and the first line was empty.
That was a misleading-evidence bug in the harness, not in the schema; it now extracts the meaningful
error line and asserts the message is non-empty.

## Gates

| Gate | Exit |
|---|---|
| `npx prisma validate` | 0 |
| `npx prisma generate` | 0 |
| `npx tsc --noEmit --pretty false` | 0 |
| targeted `npx eslint` | 0 |
| `npm run build` | 0 (`BUILD_ID 5Xo0g1n2wz3nBIXHkOSDU`) |
| `check-schema-invariants` | 0 |
| `check-tenancy-contracts` | 0 |
| `check-foundation-contracts` | 0 |
| `check-copilot-runtime` | 0 |
| `check-capability-contract` | 0 |
| `check-business-os-surface` / `-render` / `-a11y` | 0 / 0 / 0 |
| `check-auth-authz` | 0 |
| `check-tenant-isolation` | 0 |
| `check-disposable-db-guard` | 0 |
| `check-order-stream` | 0 (needed a temporary local server, run against the disposable DB, stopped afterwards) |
| `check-restaurant-order-transaction` | 0 (writes orders; disposable DB only) |

Targeted lint initially failed with `@typescript-eslint/no-require-imports` on the guarded runner.
That was a real defect in new code and was fixed by importing `readdirSync` properly, not suppressed.

## Live database safety

`personalink` verified untouched throughout: 35 public tables, `_prisma_migrations` **absent** (0
migrations applied), none of the 14 new tables present, `Profile`=16. No migration, backfill, cutover
or destructive statement was ever aimed at it, and the guard demonstrably refuses it in every casing.

No cutover was performed. No push. No deployment.
