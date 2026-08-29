# Next action

Updated 2026-08-29, mid-run, root-serial. No worker independence claimed.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`862e5ef`** — Wave C fully integrated and green
- Origin `recovered/aug20-wt-pr-32`: `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`, unchanged
- Waves A, B and C complete. P2-005 and P2-006 are `done`.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**,
  not mid-rehearsal. Live `personalink` untouched.
- Gateway port 5476 absent; workers and crons empty. Every wave has been root-serial.

## Exact executable continuation — Wave D content/cohorts

Read `INTEGRATION_QUEUE.md` → "Next in queue — Wave D content/cohorts, READY" for the
package table and proof requirements.

### Step 0 — measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse HEAD                     # expect 862e5ef...
git status --porcelain                 # expect only .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md untracked
git rev-parse origin/recovered/aug20-wt-pr-32   # expect 4b386d1...
```

### Step 1 — inspect before designing

The existing content models are `Course`, `CourseModule`, `CourseLesson`,
`CourseEnrollment`, `LessonCompletion` and `Member`. Read them in
`aiclone/prisma/schema.prisma` and read `scripts/one-off/check-course-profile-actions-authz.ts`
for the authorization contract they already have. Promote these behind shared content/cohort
contracts; do not fork a coaching-only stack, and do not rename a pre-existing model or
Prisma relation field.

### Step 2 — D1 additive schema (only package here that mutates a database)

Do not start D1 with under 90 minutes of safe time. Sequence, in order:

```powershell
$T = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c"
node "$T\rehearse.js" backup
node "$T\rehearse.js" snapshot pre-d1
# edit prisma/schema.prisma, generate the migration, then:
node "$T\rehearse.js" snapshot post-d1
node "$T\rehearse.js" compare pre-d1 post-d1
node "$T\verify-no-renames.js"            # must report 0 renamed
```

Then apply → roll back with the migration's own `down.sql` → reapply, and confirm the
catalog comparison is identical across the cycle. The five pre-existing `profileId`
`DropForeignKey` statements against `ActivityEvent`, `Contact`, `ContactSourceLink`,
`WorkflowRun` and `Workspace` must be **excluded and count-asserted**, never applied.

### Step 3 — D2 runtime, then D3 APIs/UI

Follow the Wave C shape exactly; it is proven and its harnesses are the template:

- `scripts/one-off/check-case-runtime.ts` — engine harness, 67 assertions
- `scripts/one-off/check-case-routes.ts` — HTTP harness, 75 assertions
- `src/lib/cases/{lifecycle,shared,engine,workflow,http,runtime}.ts` — layering
- `src/components/business-os/{cases-panel,case-detail-panel,cases-shared}` — surface

## Non-obvious rules that will cost time if forgotten

1. **Harness invocation must include `-r tsconfig-paths/register`**, and
   `TS_NODE_PROJECT=scripts/tsconfig.checks.json` must be set. The rehearsal runner sets the
   latter; a bare `npx ts-node script.ts` fails with `ERR_MODULE_NOT_FOUND`.
2. **Run every DB harness through a runner**, never with the ambient `DATABASE_URL`:
   - `...\personalink-phase0\wave-c\run-on-rehearsal.js -- <cmd>` (Wave C worktree)
   - `...\personalink-phase0\wave-a-briefs\run-on-rehearsal-primary.js -- <cmd>` (primary)
   - The full 35-check sweep: `pwsh -File ...\wave-c\run-wave-c-gates.ps1`
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
