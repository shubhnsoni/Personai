# Next action

Updated 2026-08-30 at the close of a night-run that was RESUMED for a second time. **Read the
compaction incident below before writing a single file.** A resumed session in this run overwrote
thirteen committed files because it trusted a restored summary instead of measuring HEAD, and the only
reason that cost twenty minutes rather than hours is that the work was committed.

## Measure first — the one habit this document exists to pass on

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git log --oneline -5      # BEFORE anything else. A restored summary is a claim about the PAST.
git rev-parse --short HEAD
git status --porcelain    # `M` on a file you think you just created means it already existed
Get-Date                  # the wall clock is a fact; a summary's sense of elapsed time is not
```

A restored handover is not evidence about the present. In this run the summary was four hours stale
and described H1 as unstarted when it was complete.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`eb35b32`**
- Origin unchanged; nothing pushed.
- Waves A–G4 complete, plus surfaces, plus **H1 `fieldJobs:inspection` complete end to end**, plus the
  two gaps H1 left (**`5822aa8`** checklist authoring, **`086c835`** field service selectable during
  onboarding), plus checklist line editing and removal with the snapshot-survival claim now proven
  (**`eb35b32`**), plus the **unified daily operations view, end to end** (`dac6a23` runtime and API,
  `0387d86` panel, `d06e122` case milestones and per-domain scope, `ff50658` route harness).
- **The check sweep is now 60.**
- **The capability registry has ZERO `planned` capabilities.** Two `partial` remain, both
  owner-gated: `appointments:reminders` and `appointments:deposits`, whose provider boundaries are
  inert.
- **Every ACTIVE blueprint is reachable from onboarding**, and a harness enforces it in both
  directions, so adding a blueprint without an onboarding route fails loudly.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**, 18
  migrations, none rolled back, 113 tables. Nothing after `8b33a6a` added a migration.
- Live `personalink`: verified untouched — 35 tables, no `_prisma_migrations`, 0 wave tables leaked,
  no `btree_gist`, `Profile` = 16.
- Frozen worktrees intact: all six `kirocrew/*` still at `ea69595`.

### Measured gates at `eb35b32`

| Gate | Result |
|---|---|
| `prisma validate` | 0 |
| `tsc --noEmit` | 0 |
| check harnesses | **60 of 60 exit 0** |
| `check-fieldjob-inspection-runtime` | 112/112; inverted exit 1, 49 flipped |
| `check-operations-runtime` | 28/28; inverted exit 1, 13 flipped; restored 28/28 |
| `check-operations-routes` | 26/26; inverted exit 1, 12 flipped |
| `check-onboarding-blueprint-coverage` | 20/20; inverted exit 1, 8 flipped |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged all night |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0 |

## The compaction incident, and what it should change about how you work

A resumed session restored a summary describing HEAD as `435a5e9` with Phase H1 unstarted. The real
HEAD was `7419669` and H1 was finished. Acting on the summary, the session rewrote
`src/lib/fieldjobs/{http,inspection,runtime}.ts` and nine route files, replacing an evolved design
with an earlier-generation one, and added a stray `inspection-http.ts` for a boundary the committed
design had deliberately folded into `http.ts`.

`git status` reported those files as **modified, not untracked**. A file you believe you just created
cannot be "modified" — reading that single word is what caught it. `git checkout -- <paths>` restored
all thirteen; `git diff HEAD` then returned empty and `tsc` was 0. Nothing was lost.

31. **After a compaction, measure HEAD before writing anything.** Rule 22 — a tool pinned to the wrong
    checkout lies quietly rather than erroring — applies to a resumed *agent* just as much as to a
    script.
32. **`M` versus `??` in `git status` is a fact about the world.** It was printed twice before it was
    read.
33. **Commit at every green point.** That is the entire reason this was a twenty-minute scare instead
    of hours of lost work.

The 30 rules from the previous entry all still hold.

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
| **H1 follow-up** checklist authoring | (same runtime) | (same 5 template routes, now reachable) | `inspection-templates-panel.tsx` |

Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`, `consulting-agency-v1`,
`ca-practice-v1`, `retail-storefront-v1`, **`field-service-v1`**. Deprecated:
`restaurant-venue-v1`, `restaurant-venue-v2`, `coaching-studio-v1`. No blueprint is in draft, and
**every engine is now composed by at least one blueprint.**

Onboarding reaches all six: `SHOP`, `RESTAURANT`, `CONSULTANT`, `CA`, `COACH` and — since `086c835` —
`FIELD_SERVICE`. `check-onboarding-blueprint-coverage` enforces that in both directions, so a new
active blueprint without an onboarding route fails a check rather than shipping unreachable.

### What is NOT built, stated so nobody plans around a phantom

- **Blueprint installation.** There is no installation runtime, no durable installed-blueprint record,
  and no route that would create one. `src/lib/business-os/**` is a static registry with **zero API
  routes**. `CORRESPONDING_BLUEPRINT` records a correspondence and is named accordingly.
- **A unified daily-operations view.** Undefined in this repository. The eight domains it would
  aggregate are all already persisted, so it needs no schema.

### The one thing still honestly missing that is OWNER-GATED

**`appointments:reminders` and `appointments:deposits`** are `partial` because their provider
boundaries are inert. Wiring a real messaging or payment provider is **owner-gated**: it means real
messages and real money. Nothing else in the registry claims something that does not exist.

## Exact executable continuation

### Step 0 - measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse --short HEAD                       # expect 086c835 or later
git status --porcelain                           # expect ONLY .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\check-live-readonly.js"
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\probe-rehearsal-inspection.js"
# expect: live 35 tables / no _prisma_migrations / Profile=16, and rehearsal FULLY_APPLIED_WITH_INSPECTION
```

### Step 1 - pick the next package

Read `INTEGRATION_QUEUE.md` -> the last "Next in queue" table. In priority order:

- **Blueprint installation runtime.** The largest genuinely-missing package and the prerequisite for
  everything vertical-facing. **Read `BLUEPRINT_INSTALLATION_DESIGN.md` first** — it is an executable
  design written at the close of this run, with the starting position measured rather than assumed, the
  migration sequence, the harness plan, the four traps that have each already cost this program time,
  and the tripwire assertion your first route will turn red. It recommends landing read-only PREVIEW
  before any schema, which is useful on its own and cannot leave the rehearsal database in a bad state.
  Measured: `src/lib/business-os/**` is a static registry with **zero API routes**, so installation does
  not exist even in part. Needs durable state, therefore a migration, therefore **a fresh 3+ hour
  window** rather than the tail of one.

- **Unified daily operations runtime.** A tenant-scoped read-only view over records that already
  exist: reservations needing action, upcoming appointments and waitlist openings, case milestones and
  approvals, cohort tasks and renewals, fulfilments and returns, inventory exceptions, field-job and
  inspection exceptions, overdue durable tasks. **Needs no schema** - it aggregates eight domains that
  are all already persisted, which makes it the largest available package that cannot be blocked by a
  migration window. Inert adapters only; do not claim a scheduler exists without real execution
  evidence.

- **P1-009 slice 6 is a refusal, not a backlog item.** 43 problems and no safe mechanical slice
  remains. `no-img-element` 25 warnings each change layout, loading and remote-image configuration;
  `set-state-in-effect` 10 errors each need the effect redesigned per component;
  `preserve-manual-memoization` 3 need memoized-collection identity analysis; `exhaustive-deps` 3 need
  per-effect analysis; `no-explicit-any` 1 is the documented judgement call at
  `src/app/[slug]/page.tsx:70`; `no-unused-vars` 1 is a live DOM query in a puppeteer script.
  **Do not clear any of these to move the number.**

- **Repoint or delete the wave-c rehearsal runner.** It has now misled two separate resumes.

- **G2 appointments providers is OWNER-GATED.** Do not start without explicit approval.
- **P1-007 live cutover is OWNER-GATED.**

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
