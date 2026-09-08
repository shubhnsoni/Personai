# Wave A — restaurant reservations (P1-006)

Base `64ec987e1935c99460dc7b1261829bcaf39877b7`. Branch
`feature/wave-a-restaurant-reservations`. Worktree `../personai-wave-a-reservations-wt`
with its own real `node_modules` from `npm ci`, so Prisma generation could not collide
with any other worktree through a shared junction.

**Root implemented, gated and reviewed every package in this wave. No worker
independence is claimed anywhere in it.** The reason is recorded in `RUNLOG.md`: the
only model-pinning dispatch tool (MCP `cron_add`) was not exposed in the session, and
both CLI fallbacks (`kirocrew cron add`, `kirocrew spawn run`) accept no model
argument, which the model policy forbids. The gateway itself was reachable; this was
not a connection refusal, and it is not recorded as one.

## What this closes

`INTEGRATION_QUEUE.md` blocker 5 said two active-blueprint capabilities overstated
reality. This wave closes **one half of it**:

- `venueOrders.reservations` was a JSON blob on a generic `Booking` with no relation to
  `RestaurantTable`. It is now a real, persisted, tenant-isolated model.
- `commerce.inventory` is untouched and stays `planned`. It remains a single nullable
  `stock` column. Nothing here claims otherwise.

## Design decisions that were verified rather than assumed

### Tenancy: profileId, bridged from workspace membership

The restaurant domain (`RestaurantTable`, `Order`, `OrderCounter`) is `profileId`-scoped,
while `/api/platform/*` is `workspaceId`-scoped through `PersistedTenancy`.
`Workspace.profileId` was already `String? @unique`, so the engine resolves the caller's
workspace to that profileId and requires every table and reservation it touches to carry
the same one. **Venue isolation is therefore built from tenancy that already existed; no
second tenant key was introduced.**

### Capacity is fail-closed because `seats` is nullable

`RestaurantTable.seats` is `Int?`. A table with no configured seat count cannot have its
capacity validated, so it **refuses reservations** rather than silently skipping the
check. Party sizes above the seat count are refused. Both are proven by harness.

### Overlap prevention has two layers, and both were tested independently

1. **Application row lock (primary).** Inside one transaction, `SELECT … FOR UPDATE` on
   the parent `RestaurantTable`, then a half-open overlap test, then insert.
2. **Partial Postgres exclusion constraint (defense-in-depth).**
   `EXCLUDE USING gist ("tableId" WITH =, tsrange("startAt","endAt",'[)') WITH &&)
   WHERE status IN (REQUESTED, HELD, CONFIRMED, SEATED)`.

`btree_gist` availability was **probed** on the rehearsal target before the constraint
was written (`pg_available_extensions` reported it available, `pg_extension` reported it
not yet installed). It was not assumed.

Both layers were verified separately, which matters because the first concurrent test
was caught by the constraint rather than the lock, and that could have meant the lock was
useless:

| Experiment | Result |
|---|---|
| Two concurrent overlapping bookings, both layers armed | exactly one winner, loser gets `CONFLICT`, exactly one row persists |
| Same race with `Reservation_no_overlap` **temporarily dropped** | exactly one winner, loser gets `APP_CONFLICT`, one row — so **the row lock alone is sufficient** |

The constraint was restored immediately and its presence re-asserted. Which layer fires
depends on interleaving timing; either way exactly one row persists and the caller
receives a clean `CONFLICT`.

Range bounds are half-open on purpose: a booking that ends exactly when the next begins
does **not** conflict, which is the correct table-turnover semantic. Terminal statuses
(`COMPLETED`, `CANCELLED`, `NO_SHOW`) never block a slot.

### Lifecycle is a pure module

Transitions live in `src/lib/reservations/lifecycle.ts` with no Prisma or I/O import, so
they are exhaustively testable. `OCCUPYING_STATUSES` is documented as needing to stay in
step with the exclusion constraint's `WHERE` predicate; if they drift, the database and
the application would disagree about what a conflict is.

Permitted transitions, and nothing else:
`REQUESTED → HELD|CONFIRMED|CANCELLED`, `HELD → CONFIRMED|CANCELLED`,
`CONFIRMED → SEATED|CANCELLED|NO_SHOW`, `SEATED → COMPLETED`. `COMPLETED`, `CANCELLED`
and `NO_SHOW` are terminal.

### Append-only ledger reuses the existing function

`ReservationEvent` UPDATE and DELETE are refused by trigger, reusing
`reject_append_only_mutation()` created by `20260827140000_phase0_foundations` rather
than defining a second copy. Observed refusals carry SQLSTATE `55000`.

**Consequence worth knowing:** because `Reservation` cascades onto `ReservationEvent` and
the trigger blocks DELETE, a reservation that has history cannot be deleted while the
trigger is armed. That is correct for an audit ledger. Harness teardown briefly disables
the trigger, then re-arms it and asserts it is armed again.

## Migration rehearsal — disposable target only

Target: `personalink_phase0_rehearsal_20260826_210704`, and only ever that.
`assertDisposableTarget` was called before every command, and the guard was proven to
refuse live by name: *"personalink is a protected live database and is never a valid
schema target."*

A fresh external `pg_dump` was taken before any mutation
(`wave-a-pre-migration-2026-08-28T17-52-33-136Z.dump`, 190590 bytes,
sha256 `e164414d…9682`).

| Step | tables | columns | constraints | indexes | enum labels | triggers | extensions | exclusion |
|---|---|---|---|---|---|---|---|---|
| before apply | 56 | 606 | 537 | 134 | 41 | 4 | 1 | 0 |
| after apply | 58 | 637 | 559 | 142 | 54 | 6 | 2 | 1 |
| after rollback | 56 | 606 | 537 | 134 | 41 | 4 | 1 | 0 |
| after reapply | 58 | 637 | 559 | 142 | 54 | 6 | 2 | 1 |

- **rollback vs before apply: byte-identical**, raw sha256 `c454c0ec…` on both.
- **reapply vs apply: structurally identical**, normalized sha256 `85debc41…`.

The reapply comparison required normalization, and the reason is recorded rather than
hidden: Postgres names implicit NOT NULL check constraints after the table OID
(`2200_35879_3_not_null`), and a drop-and-recreate necessarily allocates new OIDs. Only
those names differed — 17 versus 17, same tables, same types. The comparator normalizes
that one pattern and nothing else.

Live `personalink` was never targeted, and no migration command was ever constructed
against it.

### One statement group deliberately omitted from the migration

`prisma migrate diff` also emitted five `DropForeignKey` statements:

```
ActivityEvent_profileId_fkey   Contact_profileId_fkey
ContactSourceLink_profileId_fkey   WorkflowRun_profileId_fkey
Workspace_profileId_fkey
```

These were **excluded**. They are pre-existing drift between `schema.prisma` (which
declares `profileId String?` on those models with no relation field) and the phase0
migration (which created real FK constraints). Shipping them would strip referential
integrity from five existing tables, which is outside this migration's additive scope and
unrelated to reservations. **This drift is reported, not fixed here**, and remains open.

## Gates

| Gate | Result |
|---|---|
| `prisma validate` / `prisma generate` | 0 / 0 |
| `tsc --noEmit --pretty false` | 0 |
| targeted `eslint` on all 20 changed paths | 0 errors, 0 warnings |
| `check-reservation-schema-invariants` | **0 / 1 / 0**, 21 assertions |
| `check-reservation-authz` (engine) | **0 / 1 / 0**, 34 assertions |
| `check-reservation-routes` (HTTP) | **0 / 1 / 0**, 36 assertions |
| `check-capability-contract` | **0 / 1 / 0** — inversion control added, see below |
| 13 no-DB regressions | all 0 |
| `check-restaurant-phase0-behavior` | **0** — existing restaurant vertical unbroken |
| `check-restaurant-order-transaction` | 0 |
| `check-schema-invariants`, `check-actions-authz`, `check-resource-authz`, `check-conversation-authz`, `check-persisted-adapters`, `check-business-os-p2-e2e` | all 0 |
| `check-auth-http-regressions` | 0, `portCleared=true` |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | 0, all three reservation routes dynamic |
| secret scan of the whole diff | 0 hits |
| allowed-path audit | 20/20 files in scope, 0 forbidden |

### `check-order-stream` exits 1, and it is NOT a Wave A regression

It fails with `fetch failed` against `http://127.0.0.1:3000` because it requires a
running dev server, and ports 3000/3100 are deliberately clear. Its in-process
assertions pass (fan-out delivered, subscribers torn down to zero, nothing delivered
after unsubscribe).

This was confirmed rather than assumed: the same harness fails **identically** at the
pre-Wave-A source in the primary worktree, where no reservations code exists at all. It
is a pre-existing environmental precondition.

## Two harness corrections worth surfacing

**1. A safety assertion would have become vacuous.**
`check-capability-contract` used `venueOrders.reservations` as the subject of its
maturity-enforcement negative test — "an active blueprint may not require a `planned`
capability". Promoting reservations to `available` would have made that test pass for
free, silently losing the property. It is repointed at `commerce.inventory`, which is
genuinely still `planned`, and now reports *"Active blueprint requires
commerce:inventory, but its maturity is planned"*.

**2. That harness had no inversion control at all.** It exited 0 with
`INVERT_ASSERTION=1` set, meaning it could not be shown to fail. A hook was added over
the maturity-enforcement assertion, giving it `0 / 1 / 0` for the first time.

**3. `check-business-os-a11y` covered only pre-existing UI.** The new panel would have
been exercised only incidentally by the shell render. Ten explicit assertions were added
covering mounting, decorative-icon hiding, the `aria-live`/`aria-busy` contract, the
screen-reader label, skeleton usage, the 401/403/409/503 split, no-sample-data wording,
absence of any hardcoded booking, and the terminal-state explanation.

## Owner-facing behaviour now usable

A venue owner can view, create, hold, confirm, seat, complete, cancel and mark-no-show
reservations against real tables from the Business OS console. Action buttons are driven
by the engine's `allowedTransitions`, so the UI cannot offer a transition the lifecycle
forbids, and a terminal booking shows an explanation instead of dead controls.

Refusals are actionable: capacity and overlap conflicts are surfaced verbatim because
they tell the owner what to change. A dependency failure says only that nothing was
changed, and leaks no internal detail — proven by a harness that injects a throwing
dependency whose message contains a fake connection string and asserts it never reaches
the response.

**No sample or placeholder reservation exists anywhere in the UI.** An empty venue
renders an empty state that says so.

## Commits

| Package | Commit | Scope |
|---|---|---|
| A1 schema | `d4cfe40` | `prisma/**` (exclusive), invariant harness |
| A2 engine | `1a306b6` | `src/lib/reservations/**`, engine harness |
| A3 API | `7456491` | `src/app/api/platform/reservations/**`, route harness |
| A5 blueprint | `4972424` | `business-os/{engines,blueprints}.ts`, capability harness |
| A4 UI | `8da2294` | `business-os/reservations-panel.tsx`, shell mount, a11y harness |

A5 landed before A4 because it depends only on A2.

## Still open after this wave

- `commerce.inventory` remains `planned`; retail/social commerce cannot honestly leave
  `draft` until real inventory exists.
- The five pre-existing `profileId` FK drift statements described above.
- `check-order-stream` needs a documented dev-server precondition, or an in-process
  transport stub, so it stops looking like a failure.
