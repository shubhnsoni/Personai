# Next action

Updated 2026-08-29, mid-run, root-serial. No worker independence claimed.

## Where things stand

- Primary: `recovered/aug20-wt-pr-32`
- Primary HEAD: **`ef17770`** — Waves C, D, E, F, **G**, **G3** and **G4** integrated green, plus the
  first P1-009 lint slice and the Wave G/G3 ledger commits
- Origin `recovered/aug20-wt-pr-32`: `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`, unchanged;
  `origin/main`: `9e8a0fffb84937d809788ee4512884289c3132b8`, unchanged
- Waves A–G complete. P2-005, P2-006, P2-008, P2-009, P2-010, **P2-011**, **P2-012**, **P2-013** are `done`.
  P1-009 is `in_progress_slice_2_done`.
- Disposable rehearsal DB `personalink_phase0_rehearsal_20260826_210704`: **fully applied**,
  17 migrations, 108 tables / 1221 columns / 292 enum labels / 35 trigger rows. Never
  mid-rehearsal.
- Live `personalink`: verified untouched — 35 tables, no `_prisma_migrations`, none of the
  thirty-one tables this run created, no `btree_gist`, `Profile` = 16.
- Gateway port 5476: **LISTENING** (pid 54756) after one bounded recovery attempt, but no
  KiroCrew MCP server is registered with the client, so no model-pinned dispatch tool is
  exposed. Recorded `ORCHESTRATION_UNAVAILABLE` at `efb843f`. Workers and crons empty. Every
  wave has been root-serial.

### Owner action that would unblock parallelism

Register the KiroCrew MCP server in `~/.kiro/settings/mcp.json` (or a workspace
`.kiro/settings/mcp.json`) and restart the Kiro client. The gateway on 5476 is already up;
the missing piece is client-side MCP registration, not the gateway process. Until then a
model-pinned worker cannot be dispatched and CLI dispatch without a model argument stays
forbidden.

### Lint inventory, measured at `dd84acc`

Repo-wide: **39 errors, 39 warnings, 78 reports** — down from 91 by P1-009 slice 2 at `2804314`. Waves F, G, G3 and G4
added no lint debt of their own; every report cleared was pre-existing. Targeted wave paths are at zero.

| Rule | Count | Why it is still open |
|---|---|---|
| `@next/next/no-img-element` | 25 | swapping `<img>` for `next/image` changes layout behaviour |
| `@typescript-eslint/no-unused-vars` | 11 | 13 cleared in slice 2; what is left is six live DOM queries in puppeteer scripts, three write-only state getters, and one webhook payload field |
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
| G variants, fulfilment, returns | `src/lib/commerce/**` | 16 routes under `/api/platform/**` | `commerce-variants-panel.tsx`, `commerce-orders-panel.tsx` |
| G3+G5 retainers | `src/lib/cases/retainers.ts` | 10 routes under `/api/platform/retainers/**` | `retainers-panel.tsx` |
| G3 course access levels | `src/lib/cohorts/access.ts` | none yet — engine and harnesses only | none yet |
| G4 field jobs (intake, dispatch) | `src/lib/fieldjobs/**` | none yet — engine and harnesses only | none yet |

**G3 and G4 shipped runtime without APIs or UI, on purpose. Retainers have since been completed end to end (`9ca772e`, `4ebaf2a`); course access levels and field jobs have not.** Their briefs asked for schema,
runtime and executable tests, and said to promote capabilities only after runtime evidence
exists. Neither asked for owner surfaces, and claiming one would have meant building it. So two of the four
capabilities promoted in G3 and G4 — `contentCohorts:accessLevels` and the two `fieldJobs` ones —
are still `available` on the strength of engines plus executable assertions alone, with no surface.
The honest next step for either is an API and a Business OS panel; `src/lib/cases/http.ts` plus
`retainers-panel.tsx` is now the closest worked example, and it shows the cheaper route: add the
methods to the domain's EXISTING api service rather than creating a second HTTP boundary.

Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`, `consulting-agency-v1`,
`ca-practice-v1`, **`retail-storefront-v1`**. Deprecated: `restaurant-venue-v1`,
`restaurant-venue-v2`, `coaching-studio-v1`. No blueprint is in draft.

Still not built, and named as such in the capability registry: `appointments:reminders`
(partial, inert provider), `appointments:deposits` (partial, inert provider), and
`fieldJobs:inspection` (planned, evidence `none`). That is the whole remaining list, and
`fieldJobs:inspection` is the **only** capability left at `planned` anywhere — see the warning in
step 1.

### What Wave G deliberately does not claim

No carrier is contacted; tracking is text the owner types. No refund is executed; a refund
payment is only referenced. No email, SMS or WhatsApp is sent. `check-capability-contract`
asserts that the blueprint summary and the three capability descriptions say so, so an active
retail storefront cannot drift into implying an integration that does not exist.

## Exact executable continuation

### Step 0 — measure, do not assume

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai"
git rev-parse HEAD                     # expect ef17770... or a ledger commit on top of it
git status --porcelain                 # expect only .codex-remote-attachments/ and P1_014_ACTION_INVENTORY.md untracked
git rev-parse origin/recovered/aug20-wt-pr-32   # expect 4b386d1...
```

Preservation is re-checkable at any time:

```powershell
node "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c\check-live-readonly.js"
# expects: 35 tables, _prisma_migrations absent, 0 wave tables leaked, btree_gist absent, Profile=16
```

### Step 1 — pick the next package

Read `INTEGRATION_QUEUE.md` → "Next in queue — revised after Wave G4".

- **`fieldJobs:inspection`** is the only unbuilt capability left in the `fieldJobs` engine, and
  the only capability at `planned` anywhere in the registry. **Read this before starting it:**
  promoting it leaves the capability-contract planned-capability negative test with nowhere to
  point. That test has already been repointed four times
  (`venueOrders:reservations` → `commerce:inventory` → `commerce:returns` →
  `fieldJobs:dispatch` → `fieldJobs:inspection`), twice within one run. It will need
  **rewriting against a synthetic engine descriptor**, not repointing. An assertion already
  exists that fails loudly and prints the surviving planned capabilities when the list empties.
- **An API and Business OS panel for course access levels or field jobs.** Retainers are done
  (`9ca772e`, `4ebaf2a`); these two are not. No schema needed, so either fits a short window.
  The retainer package is the worked example: add methods to the domain's EXISTING api service
  (a second HTTP boundary would be a second place for the envelope to drift), one route file per
  resource, then a panel, then a11y assertions in `check-business-os-a11y.ts`. For access levels
  note the extra wrinkle: there are TWO principals, and the learner path must not accept a
  workspaceId.
- **G2 appointments reminders/deposits providers is OWNER-GATED.** Wiring a real messaging or
  payment provider means real messages and real money. Do not start it without explicit
  approval. `appointments:reminders` is the target of the partial-capability negative test.
- **P1-009 slice 2** is the safe fallback when no feature wave fits the window. The inventory
  above says exactly what is left and why each item needs judgement. Pick one rule and finish
  it; do not attempt `no-img-element` or `set-state-in-effect` without reading the components
  properly, because both change behaviour.

When a capability is promoted, expect to repoint the contract harness AND to move it out of any
blueprint's planned backlog. It now carries a non-vacuity assertion naming
**`fieldJobs:inspection`** (planned) and **`appointments:reminders`** (partial), assertions
recording that `commerce:returns`, `casesProjects:retainers`, `contentCohorts:accessLevels`,
`fieldJobs:intake` and `fieldJobs:dispatch` have become available, a sweeping check that fails if
any live blueprint lists an available capability as planned, and the empty-registry warning above.
`restaurant-venue-v2` is exempted from the sweep by name because it is a deprecated historical
contract — do not "fix" it.

### Step 2 — migration sequence, if the package needs one

```powershell
$T = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-c"
node "$T\rehearse.js" backup
node "$T\rehearse.js" snapshot pre-<pkg>
# edit prisma/schema.prisma, then:
npx prisma format --schema prisma/schema.prisma
node "$T\schema-semantic-diff.js"          # must show 0 removed blocks
node "$T\run-on-rehearsal.js" -- node "$T\build-raw-diff.js"
# copy build-migration-g3.js, change OUT_DIR, header, footer and the asserted diff shape
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
count-asserted**, never applied. Nine waves have done this; the builder scripts already do.

**If a package cannot be purely additive, say so and enumerate it.** Wave G is the precedent:
`InventoryItem.variantId` made G1.1 non-additive, so the five affected statements were lifted
out of the generated diff, hand-ordered, and each one justified in the migration header. The
rule is not "never touch an existing table" — it is "never touch one silently".

### Step 3 — gates before integrating

```powershell
cd "C:\Users\shubh\Desktop\Projects\personal projects\personai\aiclone"
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx tsc --noEmit -p tsconfig.json
node "$T\verify-no-renames.js"
pwsh -File "$T\run-wave-c-gates.ps1"      # all 50 check harnesses, skips only check-order-stream
npx eslint <touched paths>
npm audit --omit=dev
npm run build
```

**Sweep-driver trap.** `run-wave-c-gates.ps1` is hardwired to the primary worktree. If your
feature branch has migrated the rehearsal database but is not merged yet, that driver runs
pre-migration harnesses against a post-migration schema and reports failures that are an
artifact of the checkout being behind the database. Use a worktree-scoped copy for pre-merge
sweeps — `run-wave-g-gates.ps1` in the same folder is the template — and the original after
merging.

## Non-obvious rules that will cost time if forgotten

1. **Harness invocation must include `-r tsconfig-paths/register`**, and
   `TS_NODE_PROJECT=scripts/tsconfig.checks.json` must be set. The rehearsal runner sets the
   latter; set it by hand for non-DB harnesses (`check-business-os-a11y`,
   `check-capability-contract`). A bare `npx ts-node script.ts` fails with
   `ERR_MODULE_NOT_FOUND`.
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
    alone — demonstrated across eight migrations, not assumed.
12. **Measure a concurrency claim concurrently.** `Promise.allSettled` over two competing
    writes, asserting exactly one winner.
13. **A fixture that violates a CHECK constraint fails in the harness, not in review.**
    `OrderLine_amounts_check` requires `lineTotalCents = qty * unitPriceCents`; seed data has
    to respect the constraints the schema already carries.
14. **Invert every important assertion once.** Every wave harness supports
    `INVERT_ASSERTION=1` and the inverted run must fail with a non-zero exit. A green harness
    that cannot go red is not evidence.

## Do not spend a run on

Gateway repair (one bounded attempt already made and recorded this run), worker-dispatch
experiments, tunnel or live preview, push/PR/deploy, live `personalink` cutover (P1-007,
owner-gated), wiring a real messaging or payment provider (owner-gated), rewriting old
orchestration history, the `check-order-stream` precondition, or the pre-existing `profileId`
FK drift unless it actually blocks a migration.

## Preservation invariants

Live `personalink` read-only. Only `personalink_phase0_rehearsal_20260826_210704` may be
mutated, and it must be left fully applied or fully rolled back — never mid-rehearsal.
Origin unchanged. Frozen worktrees and attachments untouched. `P1_014_ACTION_INVENTORY.md`
unchanged. No destructive Git operation. Preserve unrelated user changes.
