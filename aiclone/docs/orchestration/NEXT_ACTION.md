# NEXT_ACTION — executable resume checkpoint

Written 2026-08-29 00:20 +05:30 by root (claude-opus-5).

`TASKS.json`, Git, worktrees and actual processes are authoritative. This file is a
resume aid, not a source of truth. Re-measure before trusting any line of it.

## Where things stand

| Fact | Value |
|---|---|
| Primary branch | `recovered/aug20-wt-pr-32` |
| Primary HEAD | see `git rev-parse HEAD` — was `e1372a3` + ledger commit at last update |
| Origin (MUST NOT CHANGE) | `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827` |
| Wave A merge | `79abb14716000726276743b5a77098f349f10a0c` |
| Wave B B1-B2 merge | `e1372a3d764d1daa92e44211bfe58039880d6f6d` |
| Wave B B3-B4 merge | `ce6348c62d1f9c17a7b72eb26b2b3e551f73b34d` |
| Preserved untracked | `.codex-remote-attachments/`, `aiclone/docs/orchestration/P1_014_ACTION_INVENTORY.md` |

Integrated and green: P2-003 (`64ec987`), Wave A reservations (`79abb14`), **Wave B shared
appointments engine COMPLETE** (`e1372a3` + `ce6348c`). `P1-006` and `P2-005` are both
`done`.

**NEXT READY WORK: Wave C cases/projects.** Scope, required proof and the list of existing
models that must be REUSED rather than duplicated are tabulated in `INTEGRATION_QUEUE.md`.
Needs a fresh isolated worktree with real `node_modules`.

## The single most important thing to know before writing another overlap check

Do **not** pass JS `Date` objects as raw-SQL parameters against
`timestamp without time zone` columns. Prisma writes a `Date` by its UTC components but
binds a `Date` parameter as **local wall-clock**, so on this UTC+05:30 host the comparison
is silently wrong. Wave A shipped this defect and its application-level overlap check was
inert for a full wave, with only the exclusion constraint preventing double-booking. Use
the typed query API (`count({ where: ... })`), or bind explicit naive-UTC strings with a
`::timestamp` cast.

Both engines now record which layer refused, and both harnesses assert an
application-detected conflict. Keep those assertions.

## Infrastructure reality — read before planning any dispatch

**No model-pinning worker dispatch is available.** Verified twice this session:

- MCP `cron_add` is not exposed. MCP `cron_list`/`spawn_list` worked early in the session
  then disappeared.
- CLI `kirocrew cron add --help` and `kirocrew spawn run --help` both accept **zero**
  model arguments.
- By the end of the session the gateway was fully down:
  `Error: gateway not running (cannot reach dashboard on port 5476)`.
- `~/.kiro/crew/autonudge.json` is `{"version": 1, "loops": []}`, so **no supervisor is
  armed** and none should be claimed.

The model policy forbids dispatching without naming a model, so Wave A was done
root-serial. Do the same for Wave B unless the gateway and MCP `cron_add` are both back,
and never describe root's own work as independent worker review.

## Environment preconditions

PostgreSQL 17 is already listening on `127.0.0.1:5432`. The Windows service handle
`postgresql-x64-17` reports `Stopped` and cannot be started without elevation, so the
running instance was **not** started by this work and must be left as found.

Ports 3000 and 3100 have 0 listeners. `cloudflared` count is 0. Keep it that way: no
tunnel, no dev server unless a harness genuinely needs one.

## The exact safe invocation pattern

Two runners live OUTSIDE the repo, deliberately, so they are never committed:

```
C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-a-briefs\run-on-rehearsal.js          # Wave A worktree
C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-a-briefs\run-on-rehearsal-primary.js  # primary worktree
C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-a-briefs\rehearse.js                  # backup / snapshot / compare
```

They load `.env`, replace ONLY the URL pathname with the disposable target in process
memory, and never print the URL.

Run any DB-backed harness like this, from the app directory:

```powershell
$env:TS_NODE_PROJECT="scripts/tsconfig.checks.json"
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-a-briefs\run-on-rehearsal-primary.js" -- `
  npx ts-node -r tsconfig-paths/register scripts/one-off/<harness>.ts
```

`-r tsconfig-paths/register` is **required** for any harness importing from `src/**`, or
`@/` aliases fail to resolve at runtime. This is documented in `HANDOFF.md` and cost a
cycle to rediscover.

Non-DB harnesses need only the `TS_NODE_PROJECT` line.

## Hard rules that must not be relaxed

- Live `personalink` is FORBIDDEN. Only `personalink_phase0_rehearsal_20260826_210704`.
  Call `assertDisposableTarget` before constructing every migration command.
- Verified untouched at checkpoint time: 35 public tables, `_prisma_migrations` absent,
  no `Reservation`/`ReservationEvent`, no `btree_gist`, `Profile`=16,
  `ProductPurchase`=8.
- Never gate on full `npx tsc -p scripts/tsconfig.checks.json` — `scripts/test-import.ts`
  carries pre-existing TS5097/TS1343. Gate on app `npx tsc --noEmit --pretty false` plus
  actual harness execution.
- A harness that cannot compile exits 1 in normal, inverted AND restored runs alike. That
  `1/1/1` signature is a compile error masquerading as an assertion failure. `import.meta`
  is a compile error under the CommonJS checks config — use `createRequire(__filename)`.
- Never lint the whole `src/app/actions` directory; `bookings.ts`, `courses.ts`,
  `import.ts`, `profile.ts` carry inherited baseline errors. Lint exact changed paths.
- No push, PR, deploy, tunnel. Never modify the six frozen evidence worktrees
  (`ea695956cfc8237bbbe32865723a2b8a80466db8`, dirty 4/3/4/1/0/1). Never touch the two
  preserved untracked paths.
- P1-007 live cutover is NOT executed.

## Next READY package: Wave B — appointments engine

Must **wrap** the existing `Booking`, `AvailabilitySchedule`, `CalendarOverride` and
`ServiceOffering` models. Do NOT fork a parallel industry-specific booking system.

Resume with:

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git worktree add -b feature/wave-b-appointments `
  "C:\Users\shubh\Desktop\Projects\personal projects\personai-wave-b-appointments-wt" 1659f29eff96e4fff5c2d96cf9cf6898a43e7ea1
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai-wave-b-appointments-wt\aiclone"
npm ci --no-audit --no-fund
Copy-Item "C:\Users\shubh\Desktop\Projects\personal projects\personai\aiclone\.env" ".env"
npx prisma validate
```

Then B1 → B2 → B3 → B4, integrating one package at a time with `--no-ff` and re-running
combined gates after each.

### Patterns proven in Wave A that Wave B should reuse rather than reinvent

1. **Row-lock-then-predicate for conflict prevention.** Inside one transaction,
   `SELECT … FOR UPDATE` the parent resource row, then test overlap, then insert. Proven
   sufficient on its own by dropping the exclusion constraint and re-racing.
2. **Partial exclusion constraint as defense-in-depth.** `btree_gist` IS available on the
   rehearsal target. Use half-open `tsrange(start, end, '[)')` so an appointment ending
   exactly when the next starts does not conflict, and restrict the constraint with a
   `WHERE` clause to non-terminal statuses.
3. **Keep the occupying-status list in ONE place.** Wave A's `OCCUPYING_STATUSES` must stay
   in step with the constraint's `WHERE` predicate; if they drift, the database and
   application disagree about what a conflict is. Wave B has the same hazard.
4. **Error mapping must read all Prisma error shapes.** Raw queries expose SQLSTATE in the
   message; Prisma Client methods wrap it in `meta` or only name the constraint. Wave A
   initially mis-reported a real conflict as an unexpected error because it checked only
   one shape.
5. **`down.sql` + `p2-guarded-sql.ts`** is the rollback mechanism. The guarded executor
   requires a non-empty `.dump` in
   `C:\Users\shubh\AppData\Local\Temp\personalink-p2-rehearsal-backup`, so take a fresh
   `pg_dump` first via `rehearse.js backup`. `pg_dump` is at
   `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe` and is NOT on PATH.
6. **Catalog comparison needs OID normalization** for implicit NOT NULL constraint names,
   because drop-and-recreate reallocates table OIDs. `rehearse.js compare` already does
   this and relaxes nothing else.
7. **Reuse `reject_append_only_mutation()`** for any new append-only ledger rather than
   defining a second copy. Remember the consequence: a parent that cascades onto an
   append-only child cannot be deleted while the trigger is armed.
8. **No real provider calls.** B3 covers deposits and reminders: stub Stripe, email and
   SMS, and assert the provider was NOT invoked on refusal.

## Open items carried forward, none blocking

1. **`commerce.inventory` is still `planned`** — one nullable `stock` column.
   `INTEGRATION_QUEUE` blocker 5 is only half closed, and retail/social commerce cannot
   honestly leave `draft` until real inventory exists.
2. **Pre-existing `profileId` FK drift.** `prisma migrate diff` wants to drop the
   `profileId` FKs on `ActivityEvent`, `Contact`, `ContactSourceLink`, `WorkflowRun` and
   `Workspace`, because `schema.prisma` declares those columns without relation fields
   while `20260827140000_phase0_foundations` created real constraints. Wave A excluded
   those statements deliberately. **Any future migration diff will re-emit them — exclude
   them again** until this gets its own decision.
3. **`check-order-stream` needs a running dev server** and exits 1 with `fetch failed`
   otherwise. Confirmed pre-existing: it fails identically at the pre-Wave-A source. Needs
   a documented precondition or an in-process transport stub.
4. **Repo-wide lint** baseline remains 124 problems / 63 errors (P1-009).

## Do not repeat these mistakes

- Running `npx tsc`/`npx eslint` from the worktree ROOT instead of the `aiclone` app
  directory silently does nothing useful (`"This is not the tsc command you are looking
  for"`). Always run gates from `aiclone`.
- Passing complex inline `node -e` through PowerShell mangles `$` and quotes, and once
  created a junk file named `{console.error('ERR`. Write a real script file instead.
- Do not add a vacuous assertion to pad a harness. One was caught and removed in A3.
- When promoting a capability's maturity, check whether any harness uses that capability as
  the SUBJECT of a negative test. A5 nearly turned the maturity-enforcement safety check
  into a free pass.
