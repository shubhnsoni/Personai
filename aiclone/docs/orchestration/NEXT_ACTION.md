# Next action

Updated 2026-08-30, at the close of a night-run that was RESUMED after the previous one died
mid-flight. The resume began by measuring inherited state rather than trusting the handover, and that
is the single most useful habit this document can pass on: **three separate statements in the
inherited description were wrong, and each would have caused real damage if believed.** See "What the
last resume found wrong" below before acting on anything here.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`f8ee611`** plus the docs commit carrying the closing sections
- The three gaps this run recorded were then CLOSED in the same run: `a5906ab` (server-computed
  `canRecord`), `eea2f7b` (the `invoiced` ban rewritten to target behaviour), `f8ee611` (the
  inspection/inventory join asserted from the inventory side), plus a migration-drift guard on the
  wave-c rehearsal runner.
- Origin unchanged; nothing was pushed.
- Waves A-G4 complete, plus surfaces, plus **H1: `fieldJobs:inspection` is complete end to end** -
  schema, migration, runtime, 13 routes, an owner panel that is mounted and reachable, a promotion
  with a real evidence file, and the first blueprint to install the engine.
- **The check sweep is now 57.**
- **The capability registry has ZERO `planned` capabilities.** Two `partial` remain, both
  owner-gated: `appointments:reminders` and `appointments:deposits`, whose provider boundaries are
  inert.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**, 18
  migrations, none rolled back, 113 tables. This run added no migration.
- Live `personalink`: verified untouched at the start and end - 35 tables, no `_prisma_migrations`,
  0 wave tables leaked, no `btree_gist`, `Profile` = 16.
- Frozen worktrees intact: all six `kirocrew/*` still at `ea69595`.

### Measured gates at `f8ee611`

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 |
| check harnesses | 57 of 57 exit 0 |
| `check-fieldjob-inspection-runtime` | 100/100; inverted exit 1, 41 flipped |
| `check-fieldjob-inspection-routes` | 59/59; inverted exit 1, 29 flipped |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0 |

## What the last resume found wrong, and what it cost

Read this before trusting any handover, including this one.

1. **"The rehearsal is in progress" was false.** The inspection migration had already landed in
   `8b33a6a` and the disposable database was **fully applied**. Re-running the rehearsal would have
   re-applied an applied migration. Verified by querying `_prisma_migrations` directly.
2. **A stale runner made a healthy database look broken.**
   `<temp>\personalink-phase0\wave-c\run-on-rehearsal.js` hardcodes `APP_DIR` to the
   `personai-wave-c-cases-wt` worktree, which is 12 commits behind. `prisma migrate status` through it
   reports "17 migrations found" while the repo and the database both have 18 - indistinguishable
   from a missing migration. **Use `wave-a-briefs\run-on-rehearsal-primary.js` for anything primary.**
   Repointing or deleting the wave-c runner is in the queue.
3. **Half the migration's rollback evidence was worthless.** Snapshot `h0-rollback` is byte-identical
   to `h0-post`, so that rollback was a no-op. Only the second cycle proves anything:
   `h0-rollback2` == `h0-pre` exactly, and `h0-reapply2` == `h0-post` except for 39 OID-derived
   internal NOT NULL constraint names on the recreated tables. **Two snapshots with the same hash
   either side of a rollback mean the rollback did not run.**
4. **Inherited gate logs were not a baseline.** All 55 predated the commit they described. A fresh
   sweep was run instead. Check timestamps against the commit before believing a log.

## What is genuinely built

| Wave | Runtime | Routes | Surface |
|---|---|---|---|
| A restaurant reservations | `src/lib/reservations/**` | `/api/platform/reservations/**` | `reservations-panel.tsx` |
| B appointments | `src/lib/appointments/**` | `/api/platform/appointments/**` | `appointments-panel.tsx` |
| C cases and projects | `src/lib/cases/**` | `/api/platform/cases/**`, `/case-intakes/**` | `cases-panel.tsx`, `case-detail-panel.tsx` |
| D cohorts | `src/lib/cohorts/**` | `/api/platform/cohorts/**` | `cohorts-panel.tsx`, `cohort-detail-panel.tsx` |
| F inventory | `src/lib/inventory/**` | `/api/platform/inventory/**` | `inventory-panel.tsx` |
| G variants, fulfilment, returns | `src/lib/commerce/**` | 16 routes | `commerce-variants-panel.tsx`, `commerce-orders-panel.tsx` |
| G3 + G5 retainers | `src/lib/cases/retainers.ts` | 10 routes under `/api/platform/retainers/**` | `retainers-panel.tsx` |
| G3 + G6 course access levels | `src/lib/cohorts/access.ts` | 12 routes under `/api/platform/course-access/**` | `access-levels-panel.tsx` |
| G4 + G6 field jobs | `src/lib/fieldjobs/engine.ts` | 10 routes under `/api/platform/field-job*/**` | `fieldjobs-panel.tsx` |
| **H1 field-job inspection** | `src/lib/fieldjobs/inspection.ts` | **13 routes** under `/api/platform/inspections/**` and `/inspection-templates/**` | `inspection-panel.tsx` |

Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`, `consulting-agency-v1`,
`ca-practice-v1`, `retail-storefront-v1`, **`field-service-v1`**. Deprecated:
`restaurant-venue-v1`, `restaurant-venue-v2`, `coaching-studio-v1`. No blueprint is in draft, and
**every engine is now composed by at least one blueprint.**

### The one thing still honestly missing

**`appointments:reminders` and `appointments:deposits`** are `partial` because their provider
boundaries are inert. Wiring a real messaging or payment provider is **owner-gated**: it means real
messages and real money. Nothing else in the registry claims something that does not exist.

## Exact executable continuation

### Step 0 - measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse --short HEAD                       # expect 7b15cd3 or a later docs commit
git status --porcelain                           # expect ONLY .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\check-live-readonly.js"
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\probe-rehearsal-inspection.js"
# expect: live 35 tables / no _prisma_migrations / Profile=16, and rehearsal FULLY_APPLIED_WITH_INSPECTION
```

### Step 1 - pick the next package

Read `INTEGRATION_QUEUE.md` -> the last "Next in queue" table. In priority order:

- **Template-authoring UI.** The five `/inspection-templates/**` endpoints have **no owner surface**,
  so a checklist can currently only be created through the API. This is the honest remaining gap in
  the H1 package and it is a real one: an owner cannot author a checklist from the product. The
  inspection panel deliberately does not do it, and W4's brief never asked for it.
- **An onboarding surface for `field-service-v1`.** The blueprint is active and selectable by the
  registry, but nothing walks an owner through choosing it. Note that the critical `createProfile`
  identity defect `HANDOFF.md` records is **already fixed** - it derives the actor from
  `requireAuthenticatedUser()` and no longer accepts a caller-supplied `userId`.
- **P1-009 slice 6.** 43 problems, and **there is no SAFE slice left** - treat this as a refusal, not
  a backlog item to grind. `no-img-element` 25 warnings each change layout, loading and remote-image
  configuration; `set-state-in-effect` 10 errors each need the effect redesigned per component;
  `preserve-manual-memoization` 3 need memoized-collection identity analysis; `exhaustive-deps` 3 need
  per-effect analysis; `no-explicit-any` 1 is the documented judgement call at
  `src/app/[slug]/page.tsx:70`; `no-unused-vars` 1 is a live DOM query in a puppeteer script.
  **Do not clear any of these to move the number.**
- **G2 appointments providers is OWNER-GATED.** Do not start without explicit approval.
- **P1-007 live cutover is OWNER-GATED.**

**`HANDOFF.md` is stale - do not plan from it.** All four defects in its critical/high table are
closed, and its "next steps" list still describes P2-003 as blocked, which it has not been for several
waves.

### Step 2 - migration sequence, if the package needs one

Unchanged from the previous eleven waves, with one addition learned this run: **after the rollback,
hash the snapshot against the pre snapshot AND against the post snapshot.** If it matches post, the
rollback did not run, and the reapply comparison that follows will be meaningless.

```powershell
$T = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c"
node "$T\rehearse.js" backup
node "$T\rehearse.js" snapshot pre-<pkg>
# edit prisma/schema.prisma, then:
npx prisma format --schema prisma/schema.prisma
node "$T\schema-semantic-diff.js"          # must show 0 removed blocks
# build the migration from build-migration-g4.js, the strictest builder
node "$T\rehearse.js" snapshot post-<pkg>-apply
# apply down.sql, delete the _prisma_migrations row, then:
node "$T\rehearse.js" snapshot post-<pkg>-rollback
node "$T\rehearse.js" compare pre-<pkg> post-<pkg>-rollback     # must be IDENTICAL
# and confirm post-<pkg>-rollback is NOT identical to post-<pkg>-apply
node "$T\verify-no-renames.js"                                  # must report 0 renamed
```

The five pre-existing `profileId` `DropForeignKey` statements against `ActivityEvent`, `Contact`,
`ContactSourceLink`, `WorkflowRun` and `Workspace` must be **excluded and count-asserted**, never
applied.

### Step 3 - gates before integrating

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai\aiclone"
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx tsc --noEmit -p tsconfig.json
pwsh -File "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\night-run\run-h0-gates.ps1"
npx eslint .                              # repo-wide count must not increase; DIFF it, do not compare totals
npm audit --omit=dev
npm run build
```

**Use `run-h0-gates.ps1`**, which is primary-scoped. `run-wave-c-gates.ps1` and
`run-wave-g-gates.ps1` are both hardwired to the wave-c worktree.

## Non-obvious rules that will cost time if forgotten

The 21 rules from the previous entry all still hold. These were added or sharpened this run:

22. **A driver or runner pinned to the wrong checkout does not error, it lies quietly.** This has now
    bitten twice - once as `run-wave-c-gates.ps1` against a migrated database, once as
    `run-on-rehearsal.js` reporting 17 migrations where there are 18. Before believing a tool's
    verdict about state, check which directory it runs in.
23. **Invertibility evidence is only as good as the snapshot taken AFTER the rollback ran.** Hash the
    rollback snapshot against BOTH the pre and the post snapshot. Equal to post means the rollback was
    a no-op and every downstream comparison is vacuous.
24. **Diff lint output line by line, never compare totals.** A total can hide a swap - one warning
    fixed and one introduced reads as no change.
25. **Widening a constructor is a repo-wide change even when `tsc -p tsconfig.json` says nothing**,
    because `scripts/**` compiles under `scripts/tsconfig.checks.json`. Search for every construction
    site. `FieldJobApiService` going from 2 to 4 arguments broke a harness the app typecheck could not
    see.
26. **An assertion that encodes today's shortcomings will fail the day they are fixed.** Third
    instance now, after the "ETA" string ban and the `.every(async ...)` vacuity: `marks unused
    engines honestly` asserted the word "unused" appears, and went red the moment every engine got a
    blueprint. Prove the BEHAVIOUR by reproducing the condition deliberately, do not rely on a
    standing gap.
27. **Check a CHECK constraint before designing a write path, not after.**
    `FieldJobInspectionItem_asset_has_identity` requires every ASSET row to name its equipment from
    insert, which forced ASSET template lines to seed `assetLabel` at snapshot time. Reading the
    migration first turned a would-be runtime failure into a design decision.
28. **When two engines cannot share a transaction, choose which half-done state a human would rather
    find.** The inspection part writes its row first and moves stock second, so a crash leaves a
    visible part with no movement rather than stock that vanished. Deriving the movement's idempotency
    key from the part id makes the retry safe.
29. **Compose an engine by obeying its rules, not by working around them.** `applyMovement` refuses
    CONSUME because CONSUME belongs to reservations; the inspection part therefore deducts with a
    negative ADJUSTMENT rather than reaching past the engine.
30. **Worker parallelism on this host works through the SHELL path, not MCP `spawn_run`.** Five
    workers produced five clean branches in five worktrees. The cost is that the shell path exposes no
    `--model` argument, so a worker's model cannot be proved - one worker reported a real PID and
    model, another could report neither and said so. **Record the difference; do not level it up.**

## Do not spend a run on

MCP `spawn_run` repair (the failure is inside the gateway's identity plumbing and is not reachable
from a session; the shell worker path works and is the one to use), tunnel or live preview, push/PR/
deploy, live `personalink` cutover (P1-007, owner-gated), wiring a real messaging or payment provider
(owner-gated), rewriting old orchestration history, the `check-order-stream` precondition, the
pre-existing `profileId` FK drift unless it actually blocks a migration, or "fixing"
`restaurant-venue-v2`'s stale planned entry - it is a deprecated historical contract and is exempted
from the false-backlog sweep by name.

## Preservation invariants

Live `personalink` read-only. Only `personalink_phase0_rehearsal_20260826_210704` may be mutated, and
it must be left fully applied or fully rolled back - never mid-rehearsal. Origin unchanged. Frozen
worktrees and attachments untouched. `P1_014_ACTION_INVENTORY.md` unchanged. No destructive Git
operation. Preserve unrelated user changes.
