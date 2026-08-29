# Next action

Updated 2026-08-29 at the close of a seven-hour root-serial run. No worker independence claimed.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`43d0fa5`**
- Origin `recovered/aug20-wt-pr-32`: `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`, unchanged;
  `origin/main`: `9e8a0fffb84937d809788ee4512884289c3132b8`, unchanged. Nothing was pushed.
- Waves A–G4 complete, plus surfaces. Done: P2-005, P2-006, P2-008, P2-009, P2-010, P2-011,
  P2-012, P2-013, P2-014, P2-015, P2-016. P1-009 is `in_progress_slice_2_done`.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**,
  17 migrations, 108 tables / 1221 columns / 292 enum labels / 35 trigger rows /
  1120 constraints / 333 indexes. `prisma migrate status` reports up to date. Never left
  mid-rehearsal.
- Live `personalink`: verified untouched — 35 tables, no `_prisma_migrations`, none of the
  thirty-five tables this run created, no `btree_gist`, `Profile` = 16.
- Frozen worktrees intact: all six `kirocrew/*` worktrees still at `ea69595`.
- Gateway port 5476: **LISTENING** (pid 54756) after one bounded recovery attempt. No KiroCrew
  MCP server is registered with the client, so no model-pinned dispatch tool is exposed.
  Recorded `ORCHESTRATION_UNAVAILABLE` at `efb843f`. Every wave in this run was root-serial.

### Owner action that would unblock parallelism

Register the KiroCrew MCP server in `~/.kiro/settings/mcp.json` (or a workspace
`.kiro/settings/mcp.json`) and restart the Kiro client. The gateway on 5476 is already up; the
missing piece is client-side MCP registration, not the gateway process. Until then a model-pinned
worker cannot be dispatched, and CLI dispatch without a model argument stays forbidden.

### Lint inventory, measured at `43d0fa5`

Repo-wide: **39 errors, 39 warnings, 78 reports** — down from 91 at `34f8561` by P1-009 slice 2
at `2804314`. Every feature wave in this run added **zero** lint debt of its own; the 13 cleared
reports were all pre-existing. Targeted wave paths are at zero.

| Rule | Count | Why it is still open |
|---|---|---|
| `@next/next/no-img-element` | 25 | swapping `<img>` for `next/image` changes layout behaviour |
| `@typescript-eslint/no-explicit-any` | 24 | needs the intended type, not a cast — the next largest tractable rule |
| `@typescript-eslint/no-unused-vars` | 11 | six live DOM queries in puppeteer scripts, three write-only state getters, one webhook payload field. Each documented in P1-009 |
| `react-hooks/set-state-in-effect` | 10 | needs the effect redesigned |
| `react-hooks/preserve-manual-memoization` | 3 | ditto |
| `react-hooks/exhaustive-deps` | 3 | ditto |
| `react-hooks/refs` | 2 | ditto |

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
| G3 + G6 course access levels | `src/lib/cohorts/access.ts` | none — engine and enforcement only | none |
| G4 + G6 field jobs | `src/lib/fieldjobs/**` | 10 routes under `/api/platform/field-job*/**` | `fieldjobs-panel.tsx` |

Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`, `consulting-agency-v1`,
`ca-practice-v1`, `retail-storefront-v1`. Deprecated: `restaurant-venue-v1`,
`restaurant-venue-v2`, `coaching-studio-v1`. **No blueprint is in draft.**

### The three things that are still honestly missing

1. **`fieldJobs:inspection`** — asset checks, parts, completion notes, invoice handoff. Declared
   `planned` with evidence `none`. It is the **only** `planned` capability left anywhere in the
   registry, which is a trap: see the warning below.
2. **`appointments:reminders` and `appointments:deposits`** — `partial`, because their provider
   boundaries are inert. Wiring a real messaging or payment provider is **owner-gated**: it means
   real messages and real money.
3. **An owner API and panel for `contentCohorts:accessLevels`.** The engine exists and is now
   enforced where content is served, but an owner has no surface for defining tiers or granting
   entitlements — they can only be created through the engine directly.

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
git rev-parse HEAD                     # expect 43d0fa5...
git status --porcelain                 # expect only .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md untracked
git rev-parse origin/recovered/aug20-wt-pr-32   # expect 4b386d1...
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\check-live-readonly.js"
# expects: 35 tables, _prisma_migrations absent, 0 wave tables leaked, btree_gist absent, Profile=16
```

### Step 1 — pick the next package

Read `INTEGRATION_QUEUE.md` → the last "Next in queue" table.

- **An owner API and panel for `contentCohorts:accessLevels`.** No schema needed, so it fits a
  short window. Worked examples: `src/lib/cases/http.ts` plus `retainers-panel.tsx`, and
  `src/lib/fieldjobs/http.ts` plus `fieldjobs-panel.tsx`. The cheaper route is to add methods to
  the domain's **existing** api service rather than create a second HTTP boundary, because a
  second boundary is a second place for the envelope, the status map and the server-derived actor
  to drift. **The wrinkle specific to this one:** there are two principals.
  `CourseAccessService` is the owner path and composes `CohortContext`; `LearnerAccessService`
  takes no `workspaceId` at all and must not start accepting one, because that would hand a
  learner a probe for other people's tenancy. The learner identity source is also different —
  `Member` via the `pl_member` cookie, not Clerk — so it cannot reuse `PersistedTenancy`.
- **`fieldJobs:inspection`.** Read the empty-registry trap above first.
- **P1-009 slice 3.** `no-explicit-any` (24) is the next largest tractable rule. The eleven
  remaining `no-unused-vars` are documented in P1-009 as needing judgement; do not clear them
  mechanically.
- **G2 appointments providers is OWNER-GATED.** Do not start without explicit approval.

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
pwsh -File "$T\run-wave-c-gates.ps1"      # all 52 check harnesses, skips only check-order-stream
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

## Do not spend a run on

Gateway repair (one bounded attempt was made and recorded), worker-dispatch experiments, tunnel or
live preview, push/PR/deploy, live `personalink` cutover (P1-007, owner-gated), wiring a real
messaging or payment provider (owner-gated), rewriting old orchestration history, the
`check-order-stream` precondition, the pre-existing `profileId` FK drift unless it actually blocks
a migration, or "fixing" `restaurant-venue-v2`'s stale planned entry.

## Preservation invariants

Live `personalink` read-only. Only `personalink_phase0_rehearsal_20260826_210704` may be mutated,
and it must be left fully applied or fully rolled back — never mid-rehearsal. Origin unchanged.
Frozen worktrees and attachments untouched. `P1_014_ACTION_INVENTORY.md` unchanged. No destructive
Git operation. Preserve unrelated user changes.
