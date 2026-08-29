# Next action

Updated 2026-08-29, mid-run, root-serial. No worker independence claimed.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`c516703`** — Wave D fully integrated and green
- Origin `recovered/aug20-wt-pr-32`: `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`, unchanged
- Waves A, B, C and D complete. P2-005, P2-006 and P2-008 are `done`.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**
  at 82 tables, not mid-rehearsal. Live `personalink` untouched.
- Gateway port 5476 absent; workers and crons empty. Every wave has been root-serial.

## Exact executable continuation — Wave E truthful vertical activation

Read `INTEGRATION_QUEUE.md` → "Next in queue — Wave E truthful vertical activation, READY".

### Step 0 — measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse HEAD                     # expect c516703...
git status --porcelain                 # expect only .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md untracked
git rev-parse origin/recovered/aug20-wt-pr-32   # expect 4b386d1...
```

### Step 1 — enumerate claims before changing any flag

For restaurant, coaching, consulting and CA, list every capability the blueprint claims, then
find the runtime and the route or surface for each one. Activate only the blueprints whose
claims are all met; a blueprint with one unmet capability stays draft.

What genuinely exists now, by wave:

| Wave | Runtime | Routes | Surface |
|---|---|---|---|
| A restaurant reservations | `src/lib/reservations/**` | `/api/platform/reservations/**` | `reservations-panel.tsx` |
| B appointments | `src/lib/appointments/**` | `/api/platform/appointments/**` | `appointments-panel.tsx` |
| C cases and projects | `src/lib/cases/**` | `/api/platform/cases/**`, `/case-intakes/**` | `cases-panel.tsx`, `case-detail-panel.tsx` |
| D cohorts | `src/lib/cohorts/**` | `/api/platform/cohorts/**`, `/course-enrollments` | `cohorts-panel.tsx`, `cohort-detail-panel.tsx` |

`commerce.inventory` is still **planned, not built**. Retail therefore stays draft. Do not
activate it to make a table look complete.

### Step 2 — make the contract harness falsifiable

`check-capability-contract` must FAIL if a blueprint is marked active while any capability it
claims has no runtime. Prove that by inverting it, exactly as every other harness in this
repo does.

### Step 3 — after Wave E

Commerce inventory hardening. It touches schema, so do not start it with under 90 minutes
remaining; follow the D1 migration sequence below.

## Migration sequence, if a package needs one

```powershell
$T = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c"
node "$T\rehearse.js" backup
node "$T\rehearse.js" snapshot pre-<pkg>
# edit prisma/schema.prisma, then:
npx prisma format --schema prisma/schema.prisma
node "$T\schema-semantic-diff.js"          # must show 0 removed blocks
node "$T\run-on-rehearsal.js" -- node "$T\build-raw-diff.js"
# copy build-migration-d1.js, change OUT_DIR, header and the allowed ADD COLUMN set
node "$T\run-on-rehearsal.js" -- npx prisma migrate deploy
node "$T\rehearse.js" snapshot post-<pkg>-apply
node "$T\run-on-rehearsal.js" -- npx prisma db execute --file "<migration dir>/down.sql" --schema prisma/schema.prisma
node "$T\run-on-rehearsal.js" -- npx prisma db execute --file "$T\forget-d1-migration.sql" --schema prisma/schema.prisma
node "$T\rehearse.js" snapshot post-<pkg>-rollback
node "$T\rehearse.js" compare pre-<pkg> post-<pkg>-rollback     # must be IDENTICAL
node "$T\run-on-rehearsal.js" -- npx prisma migrate deploy
node "$T\rehearse.js" compare post-<pkg>-apply post-<pkg>-reapply
node "$T\verify-no-renames.js"                                  # must report 0 renamed
```

The five pre-existing `profileId` `DropForeignKey` statements against `ActivityEvent`,
`Contact`, `ContactSourceLink`, `WorkflowRun` and `Workspace` must be **excluded and
count-asserted**, never applied.

## Non-obvious rules that will cost time if forgotten

1. **Harness invocation must include `-r tsconfig-paths/register`**, and
   `TS_NODE_PROJECT=scripts/tsconfig.checks.json` must be set. The rehearsal runner sets the
   latter; a bare `npx ts-node script.ts` fails with `ERR_MODULE_NOT_FOUND`.
2. **Run every DB harness through a runner**, never with the ambient `DATABASE_URL`:
   - `...\wave-c\run-on-rehearsal.js -- <cmd>` (the cases/cohorts worktree)
   - `...\wave-a-briefs\run-on-rehearsal-primary.js -- <cmd>` (primary)
   - Full sweep of all 38 checks: `pwsh -File ...\wave-c\run-wave-c-gates.ps1`
     (it globs `check-*.ts` and skips only `check-order-stream`)
3. **Git pathspecs are relative to the repo root, which is the folder *above* `aiclone`.**
   `git -C aiclone add aiclone/...` fails; run git from the worktree root.
4. **PowerShell has no heredoc.** Long commit messages go through `git commit -F <file>`.
5. **Read exit codes by redirecting to a file first.** Piping into `Select-Object` yields the
   pipeline's exit code, not the command's.
6. **All time comparisons use Prisma's typed API.** Raw SQL `Date` parameters bind as local
   wall-clock against `timestamp without time zone` while Prisma writes UTC components. This
   silently disabled an overlap check in Wave A.
7. **Validate enum inputs at the HTTP boundary against the lifecycle table**, so 400 (unknown
   value) stays distinct from 409 (illegal transition).
8. **Prove non-enumeration by byte-comparing whole response bodies**, not by asserting two
   403s.
9. **Let the server compute `allowedTransitions`** and have the UI render only those, so a
   client cannot offer a move the write boundary refuses.
10. **`spawnSync` for `npx` on Windows needs `shell: true`**, otherwise it fails with no
    stdout and no stderr.

## Do not spend a run on

Gateway repair, worker-dispatch experiments, tunnel or live preview, push/PR/deploy, live
`personalink` cutover (P1-007, owner-gated), repo-wide lint cleanup (P1-009), rewriting old
orchestration history, the `check-order-stream` precondition, or the pre-existing `profileId`
FK drift unless it actually blocks a migration.

## Preservation invariants

Live `personalink` read-only. Only `personalink_phase0_rehearsal_20260826_210704` may be
mutated, and it must be left fully applied or fully rolled back — never mid-rehearsal. Origin
unchanged. Frozen worktrees and attachments untouched. `P1_014_ACTION_INVENTORY.md`
unchanged. No destructive Git operation. Preserve unrelated user changes.
