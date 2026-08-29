# Next action

Updated 2026-08-29, mid-run, root-serial. No worker independence claimed.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`108846e`** — Waves C, D, E and F integrated green, plus the first P1-009
  lint slice
- Origin `recovered/aug20-wt-pr-32`: `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`, unchanged;
  `origin/main`: `9e8a0fffb84937d809788ee4512884289c3132b8`, unchanged
- Waves A, B, C, D, E and F complete. P2-005, P2-006, P2-008, P2-009, P2-010 are `done`.
  P1-009 is `in_progress_slice_1_done`.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**,
  13 migrations, 85 tables / 931 columns / 190 enum labels / 14 triggers. Never
  mid-rehearsal.
- Live `personalink`: verified untouched — 35 tables, no `_prisma_migrations`, none of the
  twelve tables this run created, no `btree_gist`, `Profile` = 16.
- Gateway port 5476 absent; workers and crons empty. Every wave has been root-serial.

### Lint inventory, measured at `108846e`

Repo-wide: **39 errors, 52 warnings, 91 reports**. Targeted wave paths are at zero.

| Rule | Count | Why it is still open |
|---|---|---|
| `@next/next/no-img-element` | 25 | swapping `<img>` for `next/image` changes layout behaviour |
| `@typescript-eslint/no-unused-vars` | 24 | genuinely dead identifiers; deleting an export needs proof nobody depends on it |
| `@typescript-eslint/no-explicit-any` | 24 | needs the intended type, not a cast |
| `react-hooks/set-state-in-effect` | 10 | needs the effect redesigned |
| `react-hooks/preserve-manual-memoization` | 3 | ditto |
| `react-hooks/exhaustive-deps` | 3 | ditto |
| `react-hooks/refs` | 2 | ditto |

### What is genuinely built, by wave

| Wave | Runtime | Routes | Surface |
|---|---|---|---|
| A restaurant reservations | `src/lib/reservations/**` | `/api/platform/reservations/**` | `reservations-panel.tsx` |
| B appointments | `src/lib/appointments/**` | `/api/platform/appointments/**` | `appointments-panel.tsx` |
| C cases and projects | `src/lib/cases/**` | `/api/platform/cases/**`, `/case-intakes/**` | `cases-panel.tsx`, `case-detail-panel.tsx` |
| D cohorts | `src/lib/cohorts/**` | `/api/platform/cohorts/**`, `/course-enrollments` | `cohorts-panel.tsx`, `cohort-detail-panel.tsx` |
| F inventory | `src/lib/inventory/**` | `/api/platform/inventory/**` | `inventory-panel.tsx` |

Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`, `consulting-agency-v1`,
`ca-practice-v1`. Draft: `retail-storefront-v1`. Deprecated: `restaurant-venue-v1`,
`restaurant-venue-v2`, `coaching-studio-v1`.

Still not built, and named as such in the capability registry: `commerce:variants`
(partial), `commerce:fulfilment` (partial), `commerce:returns` (planned),
`appointments:reminders` (partial, inert provider), `appointments:deposits` (partial, inert
provider), `casesProjects:retainers` (planned), `contentCohorts:accessLevels` (planned),
all of `fieldJobs` (planned).

## Exact executable continuation

### Step 0 — measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse HEAD                     # expect 108846e... or the closing ledger commit on top of it
git status --porcelain                 # expect only .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md untracked
git rev-parse origin/recovered/aug20-wt-pr-32   # expect 4b386d1...
```

Preservation is re-checkable at any time:

```powershell
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\check-live-readonly.js"
# expects: 35 tables, _prisma_migrations absent, 0 wave tables leaked, btree_gist absent, Profile=16
```

### Step 1 — pick the next package

Read `INTEGRATION_QUEUE.md` → "Next in queue — three candidates, none started".

- **G1 commerce variants + fulfilment + returns** is the highest-value package: those three
  are the only things keeping `retail-storefront-v1` in draft. Needs schema.
- **G2 appointments reminders/deposits providers is OWNER-GATED.** Wiring a real messaging
  or payment provider means real messages and real money. Do not start it without explicit
  approval.
- **G3 retainers and access levels** are the two gaps Wave E split out of over-broad
  capability descriptions. Smaller; each needs schema plus runtime.
- **P1-009 slice 2** is the safe fallback when no feature wave fits the window. The
  inventory above says exactly what is left and why each item needs judgement. Pick one rule
  and finish it; do not attempt `no-img-element` or `set-state-in-effect` without reading the
  components properly, because both change behaviour.

When a capability is promoted, expect to repoint the contract harness the same way Wave F
did: `check-capability-contract` carries non-vacuity assertions naming
`commerce:returns` (planned) and `appointments:reminders` (partial), and they will fail on
purpose the moment either becomes real.

### Step 2 — migration sequence, if the package needs one

```powershell
$T = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c"
node "$T\rehearse.js" backup
node "$T\rehearse.js" snapshot pre-<pkg>
# edit prisma/schema.prisma, then:
npx prisma format --schema prisma/schema.prisma
node "$T\schema-semantic-diff.js"          # must show 0 removed blocks
node "$T\run-on-rehearsal.js" -- node "$T\build-raw-diff.js"
# copy build-migration-f1.js, change OUT_DIR, header, footer and the asserted diff shape
node "$T\run-on-rehearsal.js" -- npx prisma migrate deploy
node "$T\rehearse.js" snapshot post-<pkg>-apply
node "$T\run-on-rehearsal.js" -- npx prisma db execute --file "<migration dir>/down.sql" --schema prisma/schema.prisma
# then delete the _prisma_migrations row for that migration name and:
node "$T\rehearse.js" snapshot post-<pkg>-rollback
node "$T\rehearse.js" compare pre-<pkg> post-<pkg>-rollback     # must be IDENTICAL
node "$T\run-on-rehearsal.js" -- npx prisma migrate deploy
node "$T\rehearse.js" compare post-<pkg>-apply post-<pkg>-reapply
node "$T\verify-no-renames.js"                                  # must report 0 renamed
```

The five pre-existing `profileId` `DropForeignKey` statements against `ActivityEvent`,
`Contact`, `ContactSourceLink`, `WorkflowRun` and `Workspace` must be **excluded and
count-asserted**, never applied. Five waves have done this; the builder scripts already do.

### Step 3 — gates before integrating

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai\aiclone"
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx tsc --noEmit -p tsconfig.json
node "$T\verify-no-renames.js"
pwsh -File "$T\run-wave-c-gates.ps1"      # all 41 check harnesses, skips only check-order-stream
npx eslint <touched paths>
npm audit --omit=dev
npm run build
```

## Non-obvious rules that will cost time if forgotten

1. **Harness invocation must include `-r tsconfig-paths/register`**, and
   `TS_NODE_PROJECT=scripts/tsconfig.checks.json` must be set. The rehearsal runner sets the
   latter; a bare `npx ts-node script.ts` fails with `ERR_MODULE_NOT_FOUND`.
2. **Run every DB harness through a runner**, never with the ambient `DATABASE_URL`:
   `...\wave-c\run-on-rehearsal.js -- <cmd>` for the feature worktree,
   `...\wave-a-briefs\run-on-rehearsal-primary.js -- <cmd>` for primary.
3. **Git pathspecs are relative to the repo root, which is the folder *above* `aiclone`.**
   `git -C aiclone add aiclone/...` fails; run git from the worktree root. Prisma commands,
   by contrast, must run from inside `aiclone`.
4. **PowerShell has no heredoc**, and embedding double quotes inside a `node -e` string
   breaks. Long commit messages go through `git commit -F <file>`; non-trivial node scripts
   go in a file, not `-e`.
5. **Read exit codes by redirecting to a file first.** Piping into `Select-Object` yields the
   pipeline's exit code, not the command's.
6. **All time comparisons use Prisma's typed API.** Raw SQL `Date` parameters bind as local
   wall-clock against `timestamp without time zone` while Prisma writes UTC components. This
   silently disabled an overlap check in Wave A.
7. **Validate enum inputs at the HTTP boundary against the lifecycle table**, so 400
   (unknown value) stays distinct from 409 (illegal transition).
8. **Prove non-enumeration by byte-comparing whole response bodies**, not by asserting two
   403s.
9. **Let the server compute `allowedTransitions`** and have the UI render only those.
10. **`spawnSync` for `npx` on Windows needs `shell: true`**, otherwise it fails with no
    stdout and no stderr.
11. **Put hard guarantees in CHECK constraints and prove the constraint refuses a direct
    write.** Prisma's diff leaves CHECK constraints, triggers and exclusion constraints
    alone — demonstrated across five migrations, not assumed.
12. **Measure a concurrency claim concurrently.** `Promise.allSettled` over two competing
    writes, asserting exactly one winner.

## Do not spend a run on

Gateway repair, worker-dispatch experiments, tunnel or live preview, push/PR/deploy, live
`personalink` cutover (P1-007, owner-gated), wiring a real messaging or payment provider
(owner-gated), repo-wide lint cleanup (P1-009), rewriting old orchestration history, the
`check-order-stream` precondition, or the pre-existing `profileId` FK drift unless it
actually blocks a migration.

## Preservation invariants

Live `personalink` read-only. Only `personalink_phase0_rehearsal_20260826_210704` may be
mutated, and it must be left fully applied or fully rolled back — never mid-rehearsal.
Origin unchanged. Frozen worktrees and attachments untouched. `P1_014_ACTION_INVENTORY.md`
unchanged. No destructive Git operation. Preserve unrelated user changes.
