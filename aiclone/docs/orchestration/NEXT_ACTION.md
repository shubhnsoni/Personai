# Next action

Updated 2026-08-29, later the same day, at the close of a root-serial run that began by measuring
orchestration rather than assuming it. Worker dispatch is exposed but broken; no worker
independence is claimed.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`2b76c3e`**
- Origin `recovered/aug20-wt-pr-32`: `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`, unchanged;
  `origin/main`: `9e8a0fffb84937d809788ee4512884289c3132b8`, unchanged. Nothing was pushed.
- Waves A–G4 complete, plus surfaces. Done: P2-005, P2-006, P2-008 through P2-016, and the
  access-level owner surface (`4ad49f3`, `3891e8b`). P1-009 is `in_progress_slice_3_done`.
- **The check sweep is now 53, not 52.** `check-course-access-api.ts` is matched by the
  `check-*.ts` glob in `run-wave-c-gates.ps1`, so the driver's own count moved.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**,
  17 migrations, `prisma migrate status` up to date. This run added no migration, so the
  rehearsal state is exactly where the previous run left it. Never left mid-rehearsal.
- Live `personalink`: verified untouched again at the end of this run — 35 tables, no
  `_prisma_migrations`, 0 wave tables leaked, no `btree_gist`, `Profile` = 16.
- Frozen worktrees intact: all six `kirocrew/*` worktrees still at `ea69595`, re-verified.
- Gateway port 5476: **LISTENING** (pid 54756), untouched by this run and verified still listening
  after it. The KiroCrew MCP servers ARE now registered client-side and every dispatch tool
  responds — but dispatch itself does not work. See the orchestration section below.

### Orchestration: the tools are exposed now, and dispatch still does not work

The previous run's blocker is gone: the MCP servers are registered and `spawn_run`, `spawn_list`,
`spawn_status`, `spawn_continue`, `resource_status`, `cron_add` and `cron_list` all respond. So
`ORCHESTRATION_UNAVAILABLE` is no longer the right label, and the reason has moved one layer down.

A read-only control worker was dispatched before any product work — requested `gpt-5.6-terra`,
`keep: true`, cwd = repo root, whose entire task was three `git rev-parse` calls. It never executed
a turn:

- `spawn_run` warned `parent_session UNRESOLVED`, so completion events cannot be delivered.
- The OS process was real: `kiro-cli.exe acp --agent kirocrew`, PID 28588, child of gateway 54756.
  It froze at **1.6 s CPU over six minutes** while `spawn_list` kept reporting `[running]`. Elapsed
  time in that readout is not evidence of work.
- `spawn_status` returned no transcript; no result directory was ever created.
- `spawn_release` refused with `conversation_busy` — a hollow run cannot be released.
- `spawn_steer` gave the diagnosis: `session_starting: the run is alive but its session has not
  registered within 15.0s`.
- The launch command carries **no `--model` argument**. Even a working worker could not have its
  observed model proved, which is disqualifying for a model-pinned run specifically.

Root cause: the process starts, its ACP session never registers, so no turn runs, no model binds and
the run can never be released. Repair stopped at 6.5 of a 15-minute budget. The hollow process was
terminated and the gateway was left alone and re-verified. **No parallelism was claimed or used.**

Also worth knowing: `resource_status` reports a concurrent sub-agent cap of **3**, and reports host
memory as unmeasurable on this machine (`Posture: UNKNOWN`), so any plan that assumes four
simultaneous workers is already wrong on this host.

### Owner action that would unblock parallelism

Client-side registration is done; do not redo it. What remains is inside the gateway: the identity
plumbing that leaves `parent_session` unresolved and the ACP session unregistered
(`KIROCREW_HOST_PID` / `session_pid` / claim-push), and the missing `--model` argument on the
subagent launch. Neither is reachable from inside a session, so do not spend another run on it.

### Lint inventory, measured at `2b76c3e`

Repo-wide: **16 errors, 39 warnings, 55 reports** — down from 78 at `43d0fa5` by P1-009 slice 3 at
`2b76c3e`. The two access-level feature commits added **zero** lint debt of their own; the seven
`react-hooks/exhaustive-deps` warnings the panel's first draft introduced were fixed with `useMemo`
before commit rather than banked. Targeted wave paths are at zero.

Slice 3 cleared **23 of the 24** `no-explicit-any`. Every one was the same stale claim: the casts
carried comments like "until types are generated", but the client HAS been generated and every field
they reached for exists on the model, so the fix was to delete the cast rather than write a better
one. Typing them properly then surfaced **seven latent bugs the `any` had been hiding** — nullable
columns being passed straight into `defaultValue` on `Input`/`Textarea`, where React does not accept
null.

| Rule | Count | Why it is still open |
|---|---|---|
| `@next/next/no-img-element` | 25 | swapping `<img>` for `next/image` changes layout behaviour. Now the largest rule |
| `@typescript-eslint/no-unused-vars` | 11 | six live DOM queries in puppeteer scripts, three write-only state getters, one webhook payload field. Each documented in P1-009 |
| `react-hooks/set-state-in-effect` | 10 | needs the effect redesigned |
| `react-hooks/preserve-manual-memoization` | 3 | ditto |
| `react-hooks/exhaustive-deps` | 3 | ditto |
| `react-hooks/refs` | 2 | ditto |
| `@typescript-eslint/no-explicit-any` | 1 | `src/app/[slug]/page.tsx:70`. A judgement call, not an oversight: `ProfileViewProps.profile` is a hand-written structural type and the page's query is a deep nested include, so making them agree is design work, and forcing it would only move the cast |

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
| G4 + G6 field jobs | `src/lib/fieldjobs/**` | 10 routes under `/api/platform/field-job*/**` | `fieldjobs-panel.tsx` |

Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`, `consulting-agency-v1`,
`ca-practice-v1`, `retail-storefront-v1`. Deprecated: `restaurant-venue-v1`,
`restaurant-venue-v2`, `coaching-studio-v1`. **No blueprint is in draft.**

### The two things that are still honestly missing

1. **`fieldJobs:inspection`** — asset checks, parts, completion notes, invoice handoff. Declared
   `planned` with evidence `none`. It is the **only** `planned` capability left anywhere in the
   registry, which is a trap: see the warning below. It was deliberately **not started** in the
   root-serial run that shipped access levels, because it needs a migration and a half-finished
   rehearsal would leave the disposable database mid-rehearsal, which the preservation invariants
   forbid. Budget a full rehearsal cycle for it or do not begin.
2. **`appointments:reminders` and `appointments:deposits`** — `partial`, because their provider
   boundaries are inert. Wiring a real messaging or payment provider is **owner-gated**: it means
   real messages and real money.

An owner API and panel for `contentCohorts:accessLevels` used to be the third item here. It is now
built — `4ad49f3` (10 routes, 14 api methods) and `3891e8b` (panel, plus two read-only console
endpoints). Two decisions in it are worth carrying forward:

- It went into the **existing** `CohortApiService`, not a second HTTP boundary. The earlier plan said
  "two route trees, one per principal"; that was wrong. The learner path was already in the right
  place — the library page with its `pl_member` cookie — and the property "two trees" was meant to
  buy is bought instead by an assertion that the boundary never imports or constructs
  `LearnerAccessService`.
- Two read-only endpoints were unavoidable and are worth understanding before touching them.
  `/course-access/courses` exists because there was no tenant-scoped course list anywhere under
  `/api/platform`. `/course-access/console` exists because `listLessonRules` returns ONLY lessons
  that already carry a rule — right for reporting, useless for an editor, since an owner could never
  add the first rule. The console read returns the null-rule lessons too, and the harness measures
  exactly that rather than trusting it.

Nothing else in the registry claims something that does not exist.

### The empty-registry trap, read this before promoting anything

The capability-contract planned-capability negative test has been repointed **four times**:
`venueOrders:reservations` → `commerce:inventory` → `commerce:returns` → `fieldJobs:dispatch` →
`fieldJobs:inspection`. Twice in this run alone.

`fieldJobs:inspection` is the last `planned` capability in the registry. Promoting it leaves that
test **nowhere to point**, and it will need **rewriting against a synthetic engine descriptor**
rather than repointing. An assertion already exists that fails loudly and prints the surviving
planned capabilities when the list empties, so the day it happens the harness will say exactly
why.

## Exact executable continuation

### Step 0 — measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse HEAD                     # expect 2b76c3e...
git status --porcelain                 # expect only .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md untracked
git rev-parse origin/recovered/aug20-wt-pr-32   # expect 4b386d1...
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\check-live-readonly.js"
# expects: 35 tables, _prisma_migrations absent, 0 wave tables leaked, btree_gist absent, Profile=16
```

### Step 1 — pick the next package

Read `INTEGRATION_QUEUE.md` → the last "Next in queue" table.

- **`fieldJobs:inspection`.** The last genuinely large package, and the last `planned` capability.
  Read the empty-registry trap below **before** starting. It needs a migration, so it needs a full
  rehearsal cycle — apply, rollback, compare, reapply — and it must not be started unless that can
  be finished, because a half-done rehearsal leaves the disposable database mid-rehearsal.
- **P1-009 slice 4.** `no-img-element` (25) is now the largest rule, and every one of them changes
  layout behaviour, so this is no longer a cheap slice. `no-explicit-any` is down to 1 and that one
  is a documented judgement call. The eleven remaining `no-unused-vars` need judgement; do not clear
  them mechanically.
- **G2 appointments providers is OWNER-GATED.** Do not start without explicit approval.
- **Worker dispatch repair is NOT a package.** It was measured this run and the failure is inside
  the gateway. See the orchestration section above.

When a capability is promoted, expect to do **three** things, not one: repoint the contract
harness, move the capability out of any blueprint's planned backlog, and check the sweeping
false-backlog assertion still passes. `restaurant-venue-v2` is exempted from that sweep by name
because it is a deprecated historical contract — **do not "fix" it**.

### Step 2 — migration sequence, if the package needs one

```powershell
$T = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c"
node "$T\rehearse.js" backup
node "$T\rehearse.js" snapshot pre-<pkg>
# edit prisma/schema.prisma, then:
npx prisma format --schema prisma/schema.prisma
node "$T\schema-semantic-diff.js"          # must show 0 removed blocks
node "$T\run-on-rehearsal.js" -- node "$T\build-raw-diff.js"
# copy build-migration-g4.js (the strictest of the builders), change OUT_DIR, header, footer
# and the asserted diff shape
node "$T\run-on-rehearsal.js" -- npx prisma migrate deploy
node "$T\rehearse.js" snapshot post-<pkg>-apply
node "$T\run-on-rehearsal.js" -- npx prisma db execute --file "<migration dir>/down.sql" --schema prisma/schema.prisma
# then delete the _prisma_migrations row for that migration name and:
node "$T\rehearse.js" snapshot post-<pkg>-rollback
node "$T\rehearse.js" compare pre-<pkg> post-<pkg>-rollback     # must be IDENTICAL
node "$T\run-on-rehearsal.js" -- npx prisma migrate deploy
node "$T\rehearse.js" compare post-<pkg>-apply post-<pkg>-reapply
node "$T\run-on-rehearsal.js" -- node "$T\build-raw-diff.js"    # must show ONLY the 5 profileId drops
node "$T\verify-no-renames.js"                                  # must report 0 renamed
```

The five pre-existing `profileId` `DropForeignKey` statements against `ActivityEvent`, `Contact`,
`ContactSourceLink`, `WorkflowRun` and `Workspace` must be **excluded and count-asserted**, never
applied. **Nine waves** have done this; the builder scripts already do.

**If a package cannot be purely additive, say so and enumerate it.** Wave G is the precedent for a
column change (`InventoryItem.variantId`); Wave G3 is the precedent for an enum change
(`CaseEventKind` gained `RETAINER`). The rule is not "never touch an existing object" — it is
"never touch one silently". And note the G3 lesson specifically: **Postgres cannot remove an enum
value**, so a rollback has to recreate the type, and `ADD VALUE` must name its position with
`BEFORE`/`AFTER` or the database order will permanently differ from `schema.prisma`.

**If you notice a gap while implementing, write it into `INTEGRATION_QUEUE.md` even if you cannot
close it.** P2-016 exists because the access-level enforcement gap was recorded before it was
fixed. A gap that is written down is findable; one that is only noticed is not.

### Step 3 — gates before integrating

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai\aiclone"
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx tsc --noEmit -p tsconfig.json
node "$T\verify-no-renames.js"
pwsh -File "$T\run-wave-c-gates.ps1"      # all 53 check harnesses, skips only check-order-stream
npx eslint <touched paths>
npx eslint .                              # repo-wide count must not increase
npm audit --omit=dev
npm run build
```

**Sweep-driver trap.** `run-wave-c-gates.ps1` is hardwired to the primary worktree. If a feature
branch has migrated the rehearsal database but is not merged yet, that driver runs pre-migration
harnesses against a post-migration schema and reports failures that are an artifact of the
checkout being behind the database. Use a worktree-scoped copy for pre-merge sweeps —
`run-wave-g-gates.ps1` in the same folder is the template — and the original after merging.

## Non-obvious rules that will cost time if forgotten

1. **Harness invocation must include `-r tsconfig-paths/register`**, and
   `TS_NODE_PROJECT=scripts/tsconfig.checks.json` must be set. The rehearsal runner sets the
   latter; set it by hand for non-DB harnesses (`check-business-os-a11y`,
   `check-capability-contract`). A bare `npx ts-node script.ts` fails with
   `ERR_MODULE_NOT_FOUND`.
2. **Run every DB harness through a runner**, never with the ambient `DATABASE_URL`:
   `...\wave-c\run-on-rehearsal.js -- <cmd>` for the feature worktree,
   `...\wave-a-briefs\run-on-rehearsal-primary.js -- <cmd>` for primary.
3. **Git pathspecs are relative to the repo root, which is the folder *above* `aiclone`.** Run git
   from the worktree root. Prisma commands must run from inside `aiclone`.
4. **PowerShell has no heredoc**, and embedding double quotes inside a `node -e` string breaks.
   Long commit messages go through `git commit -F <file>`; non-trivial node scripts go in a file.
   `Set-Content -NoNewline` inside a loop over a hashtable silently failed for nested paths in
   this run — use a file-writing tool for multiple files rather than a shell loop.
5. **Read exit codes by redirecting to a file first.** Piping into `Select-Object` yields the
   pipeline's exit code, not the command's.
6. **`Select-String -Path` with `**` globs does not recurse.** It silently reports zero matches,
   which is worse than an error. Use `Get-ChildItem -Recurse` and pipe the paths, or a dedicated
   search tool. This nearly invalidated a P1-009 verification step.
7. **All time comparisons use Prisma's typed API.** Raw SQL `Date` parameters bind as local
   wall-clock against `timestamp without time zone` while Prisma writes UTC components. This
   silently disabled an overlap check in Wave A. Raw SQL is for `FOR UPDATE` locking only.
8. **Validate enum inputs at the HTTP boundary against the lifecycle table**, so 400 (unknown
   value) stays distinct from 409 (illegal transition). Prove both on the same field.
9. **Prove non-enumeration by byte-comparing whole serialized responses**, not by asserting two
   403s.
10. **Let the server compute `allowedTransitions`** and have the UI render only those.
11. **`spawnSync` for `npx` on Windows needs `shell: true`**, otherwise it fails with no stdout
    and no stderr.
12. **Put hard guarantees in CHECK constraints and prove the constraint refuses a direct write.**
    Prisma's diff leaves CHECK constraints, triggers and exclusion constraints alone —
    demonstrated across nine migrations, not assumed.
13. **A cross-row rule Prisma cannot express goes in a trigger, not a composite foreign key.**
    There are now six such rules. A composite FK would be dropped by every future generated
    migration; a trigger is invisible to the diff.
14. **Measure a concurrency claim concurrently — and know which answer you want.** Inventory wants
    exactly one winner because stock is finite. The retainer ledger wants **both** writers to land
    because consumption is additive. Copying the inventory assertion into the retainer harness
    would have asserted the opposite of the requirement.
15. **A fixture that violates a CHECK constraint fails in the harness, not in review.**
    `OrderLine_amounts_check` requires `lineTotalCents = qty * unitPriceCents`;
    `CourseAccessGrant_expiry_after_grant` requires `expiresAt > grantedAt`. Both caught fixture
    bugs in this run.
16. **Invert every important assertion once.** Every wave harness supports `INVERT_ASSERTION=1`
    and the inverted run must fail with a non-zero exit. A green harness that cannot go red is not
    evidence.
17. **An assertion that can never fail is worse than no assertion.** `.every(async ...)` is always
    truthy; an assertion on the absence of a string the honesty copy itself uses fails on the
    thing it protects. Both happened in this run and both were rewritten rather than deleted.
18. **A ban on a STRING is not a ban on a BEHAVIOUR, and the difference bites both ways.** An
    assertion that `http.ts` must not contain `LearnerAccessService` failed the moment the file
    grew a comment explaining why the learner service is excluded — the documentation that
    protects the property tripped the check that guards it. The fix is to ban the construction and
    the import (`new LearnerAccessService`, `import ... LearnerAccessService`), not the word.
19. **Elapsed time in `spawn_list` is not evidence of work.** A hollow subagent reported
    `[running] 349s` while its process sat at 1.6 s of CPU. Judge a worker by CPU consumed, a
    transcript, or a result file — never by the orchestrator's own clock.
20. **Typing an `any` properly will find bugs, so budget for them.** Slice 3 removed 23 casts and
    immediately surfaced seven places where a nullable column was being handed to `defaultValue`.
    Those are the point of the exercise, not a reason to put the cast back.
21. **Check the generated client before believing a cast's comment.** Every `as any` cleared in
    slice 3 was justified in-code by "until types are generated". The types had been generated;
    the comments were years of copy-paste. Grep the schema for the field before writing a type.

## Do not spend a run on

Gateway repair and worker-dispatch experiments (both were measured properly this run; the failure is
inside the gateway's identity plumbing and the missing `--model` argument, neither reachable from a
session), tunnel or live preview, push/PR/deploy, live `personalink` cutover (P1-007, owner-gated),
wiring a real messaging or payment provider (owner-gated), rewriting old orchestration history, the
`check-order-stream` precondition, the pre-existing `profileId` FK drift unless it actually blocks
a migration, or "fixing" `restaurant-venue-v2`'s stale planned entry.

## Preservation invariants

Live `personalink` read-only. Only `personalink_phase0_rehearsal_20260826_210704` may be mutated,
and it must be left fully applied or fully rolled back — never mid-rehearsal. Origin unchanged.
Frozen worktrees and attachments untouched. `P1_014_ACTION_INVENTORY.md` unchanged. No destructive
Git operation. Preserve unrelated user changes.
