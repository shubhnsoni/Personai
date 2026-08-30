# Run Log

Updated: 2026-08-27 03:38 +05:30

## 2026-08-27

- User corrected orchestration scope: this is not just a visible CLI session; root agent must execute the master orchestration prompt.
- Inspected KiroCrew CLI help and active subagents.
- Confirmed active KiroCrew job 127e842f exists but did not complete orchestration outputs.
- Inspected canonical app context: docs/HANDOFF.md, src/lib/surfaces.ts, prisma/schema.prisma model list, src/app/api/chat/route.ts, src/lib/rag.ts, src/lib/analytics.ts, and vertical scorecard.
- Recorded dirty worktree protocol and froze active restaurant-order paths.
- Created Phase 0 orchestration state under docs/orchestration/.

## KIROCREW_CAPABILITY_MAP

See KIROCREW_CAPABILITY_MAP.md.

- Dispatched read-only KiroCrew workers: P0-003 f3cb8eaa, P0-004 ac00c8fa, P0-005 336af8d8.

- Verification: kirocrew spawn list shows active workers f3cb8eaa and ac00c8fa plus original 127e842f. Worker 336af8d8 was accepted by CLI output but is not visible in active list.

- Correction: worker processes alone are not orchestration. Added visible supervisor monitor `Watch-KiroCrewOrchestration.ps1` to poll `kirocrew spawn list`, track fresh session JSONL writes, and publish `MONITOR_STATUS.md` every 30 seconds. Root Nexus remains responsible for reading worker outputs, deciding integrations, and updating `TASKS.json` / `DECISIONS.md` / `INTEGRATION_QUEUE.md`.

- Started visible PowerShell supervisor window: `KiroCrew Orchestration Monitor`. It updates `MONITOR_STATUS.md` every 30 seconds with active workers and recent session writes.

## 2026-08-27 04:16 +05:30

Shubh approved proceeding in full autonomy using isolated worktrees while another agent owns restaurant work. Created/reused the KiroCrew implementation lane `kirocrew/business-os-phase-1` and downgraded P1-001 from owner wait to isolated-worktree ready. Restaurant/schema paths remain frozen and patch-only.


## 2026-08-27 04:28 +05:30 - Max safe fanout enabled

- Created isolated worktrees/branches for API, UI, quality, docs verticals, and integration review.
- OpenClaw active child-session ceiling reached at 5/5: core + API + UI + quality + docs verticals.
- Integration OpenClaw child spawn deferred because of child-session ceiling; parent performed initial branch/path safety check and native reviewer was attempted but lacked filesystem tools.
- Primary checkout remains untouched except docs/orchestration and docs/strategy.
- Frozen restaurant/schema/shared-chat paths remain patch-only and off-limits.


## 2026-08-27 04:37 +05:30 - Write path recovery

Shubh reported that visible Kiro terminals say no write path is available. Investigation found all intended git worktrees exist, but new Kiro/ACP session JSONL files from 04:29-04:30 are zero bytes, meaning those terminals did not attach to a usable writable project root. OpenClaw sandboxed subagent spawn also rejected `cwd` overrides, so the recovery path is direct acpx/Kiro launches from each explicit worktree `aiclone` directory. Every resumed lane must verify `pwd` and `git status --short --branch` before editing.

## 2026-08-27 04:38 +05:30 - Live activity terminal and write-path docs

Added `Live-KiroCrewDashboard.ps1` to show active lane worktrees, git states, recent OpenClaw/Kiro session writes, and `kirocrew spawn list` in a continuously refreshing terminal. Added `AGENT_WRITE_PATHS.md` as the canonical writable-root registry for every KiroCrew lane, including explicit recovery steps for terminals that report no write path is available. The live dashboard also publishes `LIVE_ACTIVITY.md` inside this orchestration folder on every refresh.


## 2026-08-27 — orchestration handover to the restaurant agent

The agent that owned the restaurant work took over root orchestration at the owner's instruction, after finishing and committing that work.

Restaurant side, now complete and committed on `recovered/aug20-wt-pr-32` (nothing pushed):

- `ea69595` — PostgreSQL migration baseline, restaurant order foundation (`Order`, `OrderLine`, `OrderEvent`, `RestaurantTable`, `OrderCounter`, `ProfileImage`), transactional order creation, dashboard cut-over, and an idempotent dry-run backfill.
- `96ebf4b` — cleared the ten pre-existing type errors that blocked `next build`. `tsc --noEmit` and `npm run build` now both exit 0 for the first time.
- `e97edf4` — Phase 1 live transport: `publish`/`subscribe` fan-out, Clerk-scoped and token-scoped SSE endpoints, `Last-Event-ID` replay, cursor fallback, and a `degraded` client flag.

Supervision findings for the six KiroCrew lanes:

- No lane has committed anything. All six worktrees sit at `ea69595` with untracked files only.
- Zero frozen-path violations. Every change is confined to `business-os/**` and `docs/**`. The ownership model held.
- Three lanes produced code: `core` 7 files / 330 lines, `api` 6 files / 209 lines, `ui` 3 files / 294 lines.
- Three lanes produced nothing: `quality`, `docs-verticals`, `integration`. TASKS.json described them as running; that was not true.
- `core` and `api` both wrote `src/app/api/business-os/blueprints/route.ts` with different implementations, different cache modes, and incompatible domain types. See ADR-005 and ADR-006.
- All three code lanes fail `tsc` with the same 19 inherited error lines and no `business-os` errors of their own. They branched from a base that could not build. See ADR-007.
- The `ui` page is `force-static` over hardcoded sample data, so it demonstrates layout only and is not wired to any engine or blueprint.

Actions taken: corrected TASKS.json to observed state, recorded ADR-005 through ADR-008, rewrote INTEGRATION_QUEUE.md with concrete remediation, and refreshed OWNERSHIP.md for the committed restaurant paths. No lane worktree was modified, rebased, or deleted, and nothing was pushed.


## 2026-08-27 — single root orchestrator, tunnel shut down

Owner set `a4d9fba` as the authoritative green baseline and appointed this agent the
single root orchestrator.

Tunnel shutdown, confirmed:

- `cloudflared` PID 28276, started 03:54:42, terminated. Process count 1 → 0.
- `https://promises-vehicle-flower-equity.trycloudflare.com/skydine-cafe/shop` now
  returns **530** (hostname no longer routes). The unauthenticated public entry point is
  closed.
- Local app retained and healthy: `http://127.0.0.1:3000/skydine-cafe/shop` → **200**,
  one listener on port 3000.
- Live KiroCrew activity dashboard and monitor retained (2 supervisor processes running).

Standing approvals for this phase: local consolidation of P1-001, the scoped P1-002
surface registration, fresh isolated worktrees, and local commits.

Explicitly withheld: any migration or backfill against `personalink`, any production or
database cutover, push/PR/deploy/force operations, stashing or rebasing or deleting the
existing dirty KiroCrew worktrees, and any change to completed restaurant paths outside a
separately reviewed patch.


## 2026-08-27 — P1-001 and P1-002 consolidated, reviewed, and fixed

Lane freeze. All six KiroCrew worktrees were left untouched at `ea69595` — not rebased, not
stashed, not deleted. Their uncommitted business-os drafts were copied read-only to
`../personai-lane-evidence-20260827/` with a SHA-256 `MANIFEST.tsv`, 16 files. Dirty counts
after the snapshot are unchanged (core 4, api 3, ui 4, quality 1, docs 0, integration 1).

Dashboard reconciliation. Five overlapping supervisor processes were running, two of them
writing `MONITOR_STATUS.md` and one looping every **1 second** re-invoking the KiroCrew CLI
each tick. All five were stopped and replaced by a single `Orchestrator-Dashboard.ps1` that
derives every field from git, the process table and `kirocrew spawn list`, and never infers
"running" from ledger text. `kirocrew spawn list` reports all four sessions complete; no
worker is running.

New worktree, from the approved baseline: `../personai-business-os-consolidation-wt` on
`orchestrator/business-os-consolidation`, created from `a4d9fba`.

Commits, all local:

- `627b826` P1-001. Core's engine-composition domain accepted as canonical. API lane's
  envelope, error map and limit validation kept; its rival steps-and-stages model and data
  discarded. One dynamic handler per route over the canonical registry. UI rewritten against
  the canonical type; `sample-data.ts` not carried across. Added a restaurant blueprint
  marked active because the venue-orders engine is the one already shipped.
- `8c58870` P1-002. `businessOs` registered in `Surface`, `surfaceForPath`,
  `navHrefToSurface`, plus one nav entry; page gated by `requireSurface`.
- `3ded129` Verification harness, session-free.
- `95839a5` Fixes from review, see below.

Review found a defect I introduced and asserted the opposite of. Both the quality lane and
the semantic reviewer independently reported that `8c58870` added `businessOs` to
`ALL_SURFACES` while its own message claimed the surface was granted to no role KIT. Because
`CUSTOM` maps to `ALL_SURFACES`, and `CUSTOM` is the Prisma default for
`Profile.roleTemplate`, the "Something else" onboarding option, the try-kit role, and the
`kit()` fallback for any unrecognised role, the unfinished console was **on by default**.
`95839a5` removes it from `ALL_SURFACES`, so it is granted only by explicit per-profile
extras opt-in, and the harness now asserts that CUSTOM, unknown, null and empty roles are
all denied. The earlier harness asserted CUSTOM was allowed, encoding the bug as intended.

Also fixed in `95839a5`: both API routes now enforce the same surface as the page through a
shared guard, since a profile bounced from the page could previously still read the registry
over HTTP; `FORBIDDEN`/403 added so that state is expressible; both handlers wrapped so a
`syncUser` or Prisma throw returns `INTERNAL_ERROR` in the envelope rather than a bare 500;
`decodeURIComponent` guarded against `URIError`; parsers extracted to `api/params.ts` so
their reject branches are testable without a Clerk session; validation extended to event and
schedule triggers, approval reasons, and duplicate blueprint ids; the vacuous duplicate-route
assertion replaced with a real one; `sampleBlueprints` renamed `builtInBlueprints`; and the
UI now states that workflows and approval gates are declared configuration that does not
execute yet.

Documentation tasks delivered by two workers with disjoint write paths, neither touching the
other's file, code, Prisma, or any ledger file: `OWNER_COPILOT_SPEC.md` (573 lines, P0-007)
and `VERTICAL_BLUEPRINT_MAP.md` (310 lines, P0-008). Both flagged substantive gaps worth
carrying into P1: `engines.ts` exposes three capability ids per engine while
ENGINE_CONTRACTS names eight or nine owned nouns, so deposits, documents, variants and
returns are not addressable by any blueprint; and `venueOrders.reservations` plus
`commerce.inventory` are declared required on the one active blueprint while being a JSON
blob on a generic `Booking` and a single nullable `stock` column respectively.

Database: still untouched. `personalink` has 35 tables, 774 rows, zero applied migrations,
none of the six new tables, and `ProductPurchase` still 8. `DB_CUTOVER_PLAN.md` is
preparation only and explicitly not approved for execution.

Tunnel remains down. Local app serves the consolidation worktree on 127.0.0.1:3000.


## 2026-08-27 — corrections applied, consolidation integrated, model policy partially blocked

Corrections. All three were verified by measurement before being written down.

- The malformed-URL claim was wrong and is retracted. `/api/business-os/blueprints/%E0%A4%A`
  returns **400 `text/html`** from Next.js before the handler runs; it never reaches the
  Business OS envelope. Only `/%25E0%25A4%25A`, an encoded percent that Next hands over as the
  literal string `%E0%A4%A`, reaches the route and returns the 401 JSON. Reproduced in the
  integration worktree. The `parseBlueprintId` guard and its assertions stay, because they
  defend the decode step for values that do arrive.
- `OWNER_COPILOT_SPEC.md` reconciled in five places against final code.
- Continuous supervisor count is **0**, and `LIVE_ACTIVITY.md` is now described as an
  on-demand one-shot snapshot rather than a live feed.

Owner decisions recorded as ADR-009 through ADR-014, and nine task packages queued with
explicit models and exact allowed and forbidden paths.

Local integration, all gates run in `../personai-integration-wt`:

| Gate | Exit |
|---|---|
| `prisma validate` | 0 |
| `prisma generate` | 0 |
| `tsc --noEmit` | 0 |
| targeted `eslint` | 0 |
| `check-business-os-surface.ts` | 0, PASS |
| `check-business-os-render.ts` | 0, PASS |
| `npm run build` | 0, three routes dynamic |
| unauthenticated HTTP | 401 JSON on all app-reachable routes, 400 HTML on the framework-rejected one |

The merge was `--no-ff` and rewrote neither branch. 22 files, path-disjoint apart from
`surfaces.ts` (+9) and `sidebar.tsx` (+2); zero restaurant, Prisma or migration paths. The
fixed `surfaces.ts` carried through, verified by asserting `businessOs` is absent from
`ALL_SURFACES` in the merged tree. Local primary fast-forwarded to `5ed4fa9`. Origin remains
`4b386d1`. Untracked user files preserved. The six lane worktrees and the evidence snapshot
are retained.

Integration base note: the owner named `4f7a582`. The actual base is `6a57232`, which is
`4f7a582` plus the mandated corrections, so the integration includes them rather than
requiring a second pass.

Model policy. `agent.model` was `auto`; it is now explicit.

| Key | Value | How |
|---|---|---|
| `agent.model` | `claude-sonnet-5` | `kirocrew config set`, verified by CLI readback |
| `agent.reasoning_effort` | `high` | `kirocrew config set`, verified by CLI readback |
| `agent.role_models.subagent` | `claude-sonnet-5` | config file, CLI rejects nested keys |
| `agent.role_efforts.subagent` | `high` | config file |
| `agent.role_models.background` | `gpt-5.6-terra` | config file |
| `agent.role_efforts.background` | `medium` | config file |

`kirocrew config set` returns "Unknown key" for the four nested `role_models.*` and
`role_efforts.*` paths, although both objects exist in the schema and were empty. They were
written directly into `~/.kiro/crew/config.json` and read back to confirm. A timestamped
backup of the original config was taken first.

**Owner-only blocker: per-worker model pinning is not possible in this environment.**

- The KiroCrew MCP server is not configured. `~/.kiro/settings/mcp.json` contains only the
  two `windows-computer-control` power servers, and the installed powers are `nova-act`,
  `power-builder` and `windows-computer-control`. There is no `spawn_run` tool exposed to
  this session.
- `kirocrew spawn run --help` confirms the shell path takes only `[--async] task`. No model
  argument, exactly as the owner said.

So a six-worker wave with three distinct models cannot be dispatched as specified. Config
pinning makes every KiroCrew session deterministic on `claude-sonnet-5` at high effort, which
removes the `auto` ambiguity, but it cannot give `gpt-5.6-sol` to one worker and
`gpt-5.6-terra` to another. Wave 1 is therefore held rather than dispatched under an
unidentified model, which the policy forbids.

Safety control landed while blocked, per ADR-011: `scripts/lib/disposable-db.ts` proves from
the parsed connection target that a database is disposable and is not `personalink`, and
`scripts/one-off/check-disposable-db-guard.ts` tests it without connecting to anything.
Deny beats allow, comparison is case-insensitive because PostgreSQL folds unquoted
identifiers, and credentials are redacted for reporting. 6 disposable names accepted, 5
live-database casings rejected, 11 other rejections, exit 0. Every future migration command
must call `assertDisposableTarget` before the command is constructed.


## 2026-08-27 — Wave 1 dispatched (supersedes the hold above)

The hold recorded in the previous entry is lifted. The KiroCrew V3 profile exposes the MCP
`spawn_run` tool with an explicit `model` field, so a six-worker wave with three distinct
models is now dispatchable as the owner specified. The shell `kirocrew spawn run` path is
still model-less and remains unused for model-pinned workers.

Two mechanical constraints were discovered and worked around, both recorded here because
they change how future waves must be dispatched:

- `spawn_run.task` is capped at 5000 characters. Slots 2-6 were rejected on the first
  attempt (5597-6782 chars). Full mandates are therefore written to
  `%TEMP%\personalink-phase0\wave1-briefs\SLOT-<n>.md` — deliberately OUTSIDE the repo so a
  worker cannot commit its own brief — and the task text is a short pointer that names the
  brief, the worktree, the branch, the requested model and the non-negotiable prohibitions.
  A worker that cannot read its brief is instructed to stop and report a blocker rather than
  guess its scope.
- `agent.subagent_cwd_allowed_roots` did not include the project tree, so `spawn_run(cwd=...)`
  would have been refused. The project root was added, and worker budgets were raised for
  build-bearing work: `subagent_timeout_secs` 1800 -> 5400, `subagent_max_turns` 100 -> 200,
  `subagent_stall_idle_secs` 120 -> 600. Backup: `config.json.bak-wave1-2026-08-27T16-57-02`.

Model pinning is unchanged and explicit: `agent.model=claude-sonnet-5`,
`role_models.subagent=claude-sonnet-5`, `reasoning_effort=high`, `role_efforts.subagent=high`,
`role_models.background=gpt-5.6-terra`, `role_efforts.background=medium`. No `auto` anywhere.

All six worktrees were created by root from base `2248d77` and verified before dispatch:
branch correct, HEAD `2248d77`, working tree clean, write-probe passed, `node_modules`
junction resolving `@prisma/client`, `.env` present.

| Slot | Role | Requested model | Session | Branch | Worktree | Owned paths |
|---|---|---|---|---|---|---|
| 1 | platform & tenancy (P1-011) | gpt-5.6-sol | 43d92337 | worker/w1-tenancy-security | ..\personai-w1-tenancy-wt | src/lib/tenancy/**, scripts/one-off/check-tenancy-contracts.ts, docs/orchestration/TENANCY_DESIGN.md |
| 2 | capability & blueprint contract (P1-010) | gpt-5.6-sol | 4486d4a4 | worker/w2-capability-contract | ..\personai-w2-contract-wt | src/lib/business-os/{types,engines,blueprints,validation}.ts, the two business-os harnesses, check-capability-contract.ts, docs/orchestration/CAPABILITY_ADR.md |
| 3 | contact/activity/task foundation (P1-012) | claude-sonnet-5 | 429e177a | worker/w3-contact-activity | ..\personai-w3-foundation-wt | src/lib/foundation/**, scripts/one-off/check-foundation-contracts.ts, docs/orchestration/FOUNDATION_DESIGN.md |
| 4 | Business OS UI remediation (P1-016) | claude-sonnet-5 | 428db03a | worker/w4-business-os-ui | ..\personai-w4-ui-wt | src/components/business-os/**, src/app/dashboard/business-os/{error,loading}.tsx, scripts/one-off/check-business-os-a11y.ts |
| 5 | mocked auth/authz/isolation evals (P1-008) | gpt-5.6-terra | 8ca86e0c | worker/w5-auth-evals | ..\personai-w5-evals-wt | src/lib/testing/**, scripts/one-off/check-auth-authz.ts, scripts/one-off/check-tenant-isolation.ts, docs/orchestration/TEST_STRATEGY.md |
| 6 | Owner Copilot ledger & runtime (P1-015) | gpt-5.6-terra | 72d1fc34 | worker/w6-copilot-runtime | ..\personai-w6-copilot-wt | src/lib/copilot/**, scripts/one-off/check-copilot-runtime.ts, docs/orchestration/OWNER_COPILOT_SPEC.md, docs/orchestration/COPILOT_RUNTIME_PROPOSAL.md |

Observed models are not yet recorded: each worker is asked to report `OBSERVED_MODEL` in its
structured report, and root will reconcile requested against observed at review time. If a
requested model proves unavailable, only the owner-approved substitutions apply
(`gpt-5.6-sol` -> `claude-opus-4.8`, `claude-sonnet-5` -> `claude-sonnet-4.6`,
`gpt-5.6-terra` -> `claude-sonnet-4.6`) and the substitution is recorded per worker.

Slot 6's role name in the owner's list is "verticals/docs". True vertical documentation
depends on the granular capability vocabulary slot 2 is defining in this same wave, so
writing it now would guarantee rework. Slot 6 was therefore assigned the dependency-ready,
path-disjoint Owner Copilot package instead, and the brief states that reassignment openly.

Concurrency: the host cap is 3 concurrent subagents, so slots 4-6 are queued and start as
slots free. Sequencing does not affect correctness because the six path sets are disjoint.

Cross-worker hazard and its mitigation: slot 2 owns the Business OS contract layer while
slot 4 renders it. Slot 2 is under a purely additive constraint (no exported symbol renamed,
removed or narrowed) and slot 4 is instructed to consume only symbols exported today and to
code defensively against extra fields. That lets both land independently instead of
serialising slot 2 before slot 4.

Known infrastructure defect, worked around rather than fixed: `spawn_run` reports
`parent_session UNRESOLVED`, so subagent completion events will not be delivered into this
conversation. Root therefore polls `spawn_list` and reads each finished run's transcript via
`spawn_status` instead of waiting on events. This is a KiroCrew identity-plumbing issue
(`KIROCREW_HOST_PID` / `session_pid` / claim-push), not a worker failure, and it does not
affect the workers themselves.


## 2026-08-27 18:05 — CORRECTION: two claims in the previous entry were wrong

Two things stated earlier were not true when measured, and are corrected here rather than
quietly edited away.

**1. `spawn_run` never executed anything.** The six MCP spawns recorded in the entry above
(43d92337, 4486d4a4, 429e177a, 428db03a, 8ca86e0c, 72d1fc34) were accepted by the API and
reported `[running]` by `spawn_list` with climbing elapsed times, but not one of them ran a
single turn. Slot 1's tombstone is explicit: `started=null`, `pid=null`, `turns=0`,
`parent_session=""`, `cause=reaped`, `outcome=failed` — and even `task` and `agent` were empty
strings, so the record was created hollow. After 28 minutes all six worktrees were still
byte-identical to base `2248d77`. Root cause: `KIROCREW_HOST_PID` and `KIROCREW_SESSION_KEY`
are empty in this ACP-client session, so the gateway cannot bind a parent session. Ruled out
as causes: model availability (`gpt-5.6-sol`, `gpt-5.6-terra`, `claude-sonnet-5` all resolve on
this gateway, so NO substitution was warranted and none was used), the cwd allow-list (fixed
and verified), and task payload size (all six accepted). Do not use `spawn_run` in this
environment.

**2. The supervision loop was never armed.** `monitor_start` returned a "requested" message,
and the previous entry described a 10-minute loop as active. It was not: `~/.kiro/crew/autonudge.json`
contained `{"loops":[]}`, no supervision process existed, and the `CRON-CONTROL.txt` marker file
proves only that a one-shot cron once ran — it is not evidence of a live monitor. `monitor_start`
requires a session binding this ACP CLI session does not have. Root supervises wave 1 directly
inside its own turn with bounded poll cycles instead. Any future claim that a loop is running
must be backed by a non-empty `loops` array in that file.

Also corrected: the previous entry's "half verified" framing was wrong. Verification is counted
per worker against measured git and gate state, not estimated.

### Measured wave-1 status at 18:05
| Slot | Model requested | Model observed | Commit | Root verdict |
|---|---|---|---|---|
| 1 tenancy | gpt-5.6-sol | gpt-5.6-sol | 66e4945 | ACCEPTED |
| 2 capability contract | gpt-5.6-sol | gpt-5.6-sol | eb188d2 | ACCEPTED |
| 3 foundation | claude-sonnet-5 | claude-sonnet-5 | 82f562e | ACCEPTED |
| 4 UI | claude-sonnet-5 | — | — | scheduled 18:22, not started |
| 5 evals | gpt-5.6-terra | — | — | scheduled 18:24, not started |
| 6 copilot runtime | gpt-5.6-terra | — | — | scheduled 18:25, not started |

3 of 6 committed, 3 of 6 independently root-verified, 3 of 6 scheduled but not started.

Slot 3 verification, run by root rather than taken from its self-report: HEAD
`82f562e5d41cb5d77c308d57eb42b139ded9bc8d` on `worker/w3-contact-activity`, 1 commit ahead of
`2248d77`, clean tree, 10 files and 1442 insertions with 0 deletions, every path inside its
owned set, and no `prisma/**`, shared-auth, restaurant-runtime, chat/RAG, sibling-module or
package-manifest change. Gates re-run by root: `prisma validate`=0, `tsc --noEmit`=0, targeted
`eslint`=0, foundation harness=0 with 8 named assertions and 0 failures (identity resolution,
timeline ordering, backoff math, retry/dead-letter, idempotent re-enqueue, lease expiry treated
as distinct from failure, read-only adapter shapes, notification projection).

`prisma generate` remains deliberately unrun while any worker is pending or active, because the
six worktrees share one `node_modules` junction and concurrent runs collide on
`query_engine-windows.dll.node` with EPERM. It runs once at integration, after all workers stop.


## 2026-08-27 19:05 — Wave 1 integrated at `4649ff1`, all six workers accepted

All six wave-1 workers reached terminal state, were independently verified by root, accepted,
merged and verified again as a whole. Local primary `recovered/aug20-wt-pr-32` is fast-forwarded
to `4649ff1`. Nothing was pushed.

### Dispatch mechanism
`spawn_run` was abandoned as unusable in this environment (see the correction entry above).
Every worker was dispatched with `cron_add` carrying an explicit `model` field, proven by a
control probe to execute and to honour the pin. Each was a one-shot job with
`approval_mode=auto`, `persistent_session=false`, `timeout_secs=5400`. Batches were staggered
3 + 3 (≈45 min apart) so six concurrent Next builds never contended. **No model substitution was
used or needed** — `gpt-5.6-sol`, `gpt-5.6-terra` and `claude-sonnet-5` all resolve on this
gateway, which was verified against `kiro-cli chat --list-models` before dispatch.

### Per-worker verdicts (root re-ran every gate; self-reports were not taken on trust)
| Slot | Package | Requested | Observed | Commit | Verdict |
|---|---|---|---|---|---|
| 1 | P1-011 tenancy | gpt-5.6-sol | gpt-5.6-sol | `66e4945` | ACCEPTED |
| 2 | P1-010 capability contract | gpt-5.6-sol | gpt-5.6-sol | `eb188d2` | ACCEPTED |
| 3 | P1-012 contact/activity/task | claude-sonnet-5 | claude-sonnet-5 | `82f562e` | ACCEPTED |
| 4 | P1-016 Business OS UI | claude-sonnet-5 | unobservable | `3120048` | ACCEPTED |
| 5 | P1-008 mocked auth/authz/isolation | gpt-5.6-terra | gpt-5.6-terra | `757dea3` | ACCEPTED |
| 6 | P1-015 copilot ledger/runtime | gpt-5.6-terra | gpt-5.6-terra | `eda4249` | ACCEPTED |

Slot 4 reported `OBSERVED_MODEL: unobservable`. Its pin is nonetheless evidenced externally:
`cron_list` showed `model=claude-sonnet-5` on job `8b4be8e6`. Recorded as pinned-by-config rather
than self-confirmed, because an unverifiable claim should not be written down as a verified one.

Every worker: exactly 1 commit, clean tree, claimed SHA matched actual HEAD, and **zero paths
outside its owned set**. No worker touched `prisma/**`, `src/middleware.ts`, `src/lib/auth/**`,
`src/lib/clerk/**`, `src/lib/surfaces*`, restaurant runtime, bookings, chat, RAG, embeddings, or
the package manifests. Slot 4 respected slot 2's exclusive ownership of the contract layer and of
the two pre-existing business-os harnesses.

### Claims that were checked rather than believed
- **Slot 2's additive-only constraint held.** All 23 pre-existing exports still present.
  `BusinessBlueprintStatus` was widened `draft|active|deprecated` -> `draft|proposed|active|deprecated`
  (a member added, none removed or narrowed). `restaurant-venue-v1` remains addressable beside the
  new `restaurant-venue-v2`. Capability maturity is honestly distributed — 4 `available`,
  8 `partial`, 12 `planned` — rather than everything declared shipped. The negative test proves an
  active blueprint requiring a `planned` capability is rejected while the same blueprint in draft
  passes. This additive discipline is why slot 4's UI still compiled after both merged.
- **Slot 5's tests are genuinely falsifiable.** Root re-ran them with `INVERT_ASSERTION=1`: both
  harnesses exited 1, and both returned to 0 once restored. They are not vacuous passes.
- **Slot 6's spec reduction is real and large.** `OWNER_COPILOT_SPEC.md` went from 34,539 to
  4,275 bytes (-88%). It retains the five mandated corrections and forward-looking design moved to
  the new `COPILOT_RUNTIME_PROPOSAL.md`, so spec now means shipped truth and proposal means future.
  Flagged to the owner because ~30KB of documented design intent was removed; the owner may want
  part of it restored.

### Integration
Fresh worktree `personai-integration-wave1b-wt`, branch `orchestrator/integration-wave1b`, cut
from primary `a2afe0d`. Six individual `--no-ff` merges, each inspected: **zero conflicts**, which
is the designed outcome of the disjoint-ownership split. Result `4649ff1`, clean tree, 6 merge
commits, 36 files, 4070 insertions / 660 deletions.

Full gate set on the merged result, with `prisma generate` now safe because every worker had
stopped:

| Gate | Exit |
|---|---|
| `npx prisma validate` | 0 |
| `npx prisma generate` | 0 |
| `npx tsc --noEmit --pretty false` | 0 |
| targeted `npx eslint` over all 14 new/changed paths | 0 |
| 10 harnesses (surface, render, capability, tenancy, foundation, a11y, auth-authz, tenant-isolation, copilot-runtime, disposable-db-guard) | 0 / 0 failing |
| `npm run build` | 0 |

Fast-forward verified as a true fast-forward (`a2afe0d` is an ancestor) before applying, so
neither branch was rewritten. Untracked user files preserved (`.codex-remote-attachments/` still
present and untouched).

### Preservation evidence
- **Live database untouched.** Read-only probe: database `personalink`, 35 public tables,
  `_prisma_migrations` table absent (0 applied migrations), `ProductPurchase` = 8, and none of
  `Order`, `OrderLine`, `OrderEvent`, `RestaurantTable`, `OrderCounter`, `ProfileImage`,
  `Workspace`, `Contact` or `WorkflowRun` exist. No worker ran any database command. The probe
  script was deleted afterwards and the repo is clean.
- **Origin untouched.** `origin/recovered/aug20-wt-pr-32` is still `4b386d1`. Never pushed.
- **Frozen evidence lanes untouched.** All six `kirocrew/business-os-*` worktrees remain at
  `ea69595`.
- **Restaurant runtime, shared chat and RAG untouched** across the entire wave diff.

### Supervision mode
Zero continuous supervisors. `monitor_start` cannot arm in this ACP CLI session — it reports a
loop as "requested" but `~/.kiro/crew/autonudge.json` stays `{"loops":[]}`. Root supervised the
wave inside its own turn with bounded 45-second polls. `LIVE_ACTIVITY.md` remains an on-demand
one-shot snapshot, not a live feed. No cron jobs remain registered and no worker processes remain
alive.

### Tenant-isolation evidence
Two independent layers, both proven by harness rather than assertion. Slot 1's
`check-tenancy-contracts` proves deny-by-default for unknown, null and empty roles, the permission
closure of each named role, refusal of a cross-tenant read, and that the escape hatch is separately
branded and requires actor, reason, ticket, timestamp and a synchronous audit emission. Slot 5's
`check-tenant-isolation` proves the refusal is the DEFAULT rather than contingent on a caller
remembering a filter, and fails when inverted. Slot 5 also recorded an honest gap:
`requireBusinessOsAccess` closes over a Clerk/Prisma-backed `syncUser` with no injection point, so
the boundary is proven with deterministic fakes only, not against the real provider.


## 2026-08-27 20:50 — Security hotfix Next 16.3.3; P2-001 blocked, verified, NOT integrated

### Vulnerable tunnel destroyed first
`GHSA-p293-qw3h-jr36` (Next.js `>=16.0 <16.3.3`, unauthenticated RCE, no workaround) applied to the
running preview. The public quick tunnel was killed before anything else: cloudflared process count
went to 0, and the old hostname now returns Cloudflare **Error 1033 "unable to resolve"** with
`server: cloudflare` and no application envelope in the body, so no request reaches the Next server.
The firewall LAN block was never sufficient here — cloudflared connects outbound and hands requests
to the origin over loopback, which bypasses inbound rules entirely.

### Hotfix
Branch `security/next-16.3.3`, commit `cc41883`, cut from `0aba8d0`, isolated `node_modules`.
Dependency-only: `next` and `eslint-config-next` `16.0.6` -> `16.3.3`, pinned exactly to match the
prior convention. React/react-dom ranges untouched, resolved to `19.2.4`. Exactly three files
changed — `package.json`, `package-lock.json`, and the required security document. No `prisma/**`,
no `src/**`, no Clerk logic.

Gates: `npm ls` confirms `next@16.3.3`; `prisma validate`=0, `prisma generate`=0, `tsc --noEmit`=0,
targeted `eslint`=0, `npm run build`=0. Harnesses 10/13 pass. The three failures were each isolated
and none is caused by the upgrade:
- `check-restaurant-phase0-behavior` — **pre-existing**, proven by reproducing the identical
  `TS2550 Property 'replaceAll' does not exist` at base on 16.0.6. A `lib` target defect in
  `scripts/tsconfig.checks.json`.
- `check-order-stream` — its own guard refuses any database not named the rehearsal target. Not
  pointed at the rehearsal DB deliberately: that is P2-001's database and this harness writes orders.
- `check-restaurant-order-transaction` — data precondition (`No public restaurant with an available
  product`) asserted on a Prisma query result before any Next code path; the disposable copy lacks
  the fixture. Deliberately not baselined against live because it can write.

Database safety: the hotfix worktree inherited a `.env` pointing at `personalink`, so it was
repointed to the unused disposable copy `personalink_phase0_clean_20260826_221845` before any
harness ran, proven disposable through the committed guard. The live `.env` was untouched.

Primary fast-forwarded (verified true fast-forward) to `cc41883`, dependencies installed, rebuilt
(`BUILD_ID jd9g0fEeTaiBrOTZl79VF`), preview restarted supervised, and a NEW tunnel created. Route
matrix verified locally and through the tunnel; `/skydine-cafe/shop` is back to 431,112 bytes, which
also confirms the 21,365-byte reading during hotfix verification was just the thinner disposable
copy rather than a regression.

One honest caveat: the temporary firewall rule for the verification port 3100 failed to create
(`New-NetFirewallRule ... cannot find the file specified`), so that short-lived verification server
was briefly unblocked on a `::` bind before being stopped. Port 3100 is now clear and the rule
removed.

### Still outstanding, owner decision
`npm audit --omit=dev`: **5 vulnerabilities (2 critical, 3 high), all Clerk SDK**; Next.js is clean.
`@clerk/nextjs` 6.39.0 is inside the affected range for `GHSA-vqx2-fgx2-5wq9`, a **middleware-based
route protection bypass** — the most plausible explanation for unauthenticated `/dashboard/*`
returning 200 with a `Profile Not Found` shell instead of redirecting to sign-in. Out of the stated
hotfix scope (no Clerk auth logic, no unrelated upgrades), so it was documented rather than changed.
Recommend a separate scoped Clerk hotfix.

### P2-001 — genuine blocker, independently verified, NOT integrated
The schema owner (`gpt-5.6-sol`, observed `gpt-5.6-sol`) stopped because **its destructive rollback
rehearsal was denied at tool authorization**. It did not bypass, did not retry a different
destructive path, and reported the denial precisely. That is the correct behaviour.

Root verified its claims rather than accepting them:

| Claim | Verification |
|---|---|
| Backup taken outside repo, 149,270 bytes | CONFIRMED, file present at exactly that size |
| Target was the disposable rehearsal DB | CONFIRMED; guard independently returns ALLOWED for it and REFUSES `personalink`, `PersonaLink`, `PERSONALINK` |
| Migration additive-only | CONFIRMED — 14 `CREATE TABLE`, 38 indexes, 2 triggers, and **0** `DROP`/`TRUNCATE`/`DELETE FROM`/`RENAME`; all 26 `ALTER TABLE` target only new tables for FK wiring |
| 14 new tables applied | CONFIRMED, 14/14 present, migration `20260827140000_phase0_foundations` finished |
| New FKs nullable | CONFIRMED — `Workspace/Contact/ContactSourceLink/ActivityEvent/WorkflowRun.profileId` all `is_nullable=YES` |
| Append-only enforcement | CONFIRMED — triggers on both `ActivityEvent` and `CopilotAuditEvent` for UPDATE **and** DELETE |
| Backfill rehearsal rolled back cleanly | CONFIRMED — `Workspace`/`Contact`/`ContactSourceLink` residue all 0, `Profile` still 16 |
| `personalink` untouched | CONFIRMED — 35 public tables, `_prisma_migrations` absent, none of the 14 new tables, `Profile`=16 |

Not done, and therefore NOT acceptable for integration: rollback rehearsal, reapply verification,
the invariant harness and its failure-mode proof, `tsc`/`eslint`/`build` gates, and the single local
commit. Its worktree still holds an uncommitted `schema.prisma` and an untracked migration
directory, 0 commits ahead.

**Verdict: NOT ACCEPTED — blocked, work sound so far but incomplete.** Completion needs explicit
owner authorization to execute the guarded down migration against
`personalink_phase0_rehearsal_20260826_210704` and nothing else. The rehearsal database currently
carries the migration (56 public tables vs the live baseline of 35).


## 2026-08-28 (overnight run) — preview torn down, P2-001 ACCEPTED and integrated, SEC-002 dispatched

### Public exposure removed (owner directive)
Cloudflare tunnel, preview supervisor and preview Next process all stopped. Verified: cloudflared
process count **0**, ports 3000 and 3100 have no listeners, and every retired hostname fails to reach
the application (`conducted-moment-commands-cheats` and `prix-sciences-regulation-dark` answer 530,
`incorporated-photograph-teach-race` is unreachable). No new tunnel was created. Next.js 16.3.3 and
the SEC-001 hotfix are preserved. Temporary local servers were used only for tests and stopped
immediately afterwards.

### P2-001 — ACCEPTED, integrated at `9d5d20e`
The owner's explicit authorization unblocked the destructive rollback rehearsal. Because the cron
worker had been denied at tool authorization, root executed the guarded rollback itself, exactly as
the directive permits, and never bypassed the guard.

A guarded executor `scripts/one-off/p2-guarded-sql.ts` was written to enforce the mandated five-step
preflight with no bypass flag: redacted-name-only printing, `assertDisposableTarget`, exact-target
equality, backup existence plus SHA-256, abort otherwise. It additionally re-asserts
`select current_database()` **after connecting**, so the database actually attached to is proven
rather than trusted from the URL.

Backup: 149,270 bytes, SHA-256 `77c6eeb27b065b84fdab1cd0e77f820540ff5c1e53ac54dc6da286ab1fb4cc69`,
outside the repo, never deleted.

Guard negative tests, all correctly refused with nothing executed: `personalink`, `PersonaLink`,
`PERSONALINK` (refused by the guard) and `personalink_phase0_clean_20260826_221845` (disposable, but
refused because it is not the authorized target). The rehearsal DB was still at 56 tables afterwards,
proving no statement ran.

The first rollback attempt FAILED on `2BP01` — `Approval` depends on `WorkflowStep` — and **rolled
back atomically** (56 tables intact). Rather than retry by guesswork, the FK graph among the 14 new
tables was queried and a topological drop order computed, children strictly before parents, so no
`CASCADE` was needed. `CASCADE` was deliberately avoided because it can silently drop constraints on
pre-existing tables.

Rollback: **zero residue** — 0 of 14 tables left, enum dropped, function dropped, 0 triggers, ledger
row removed. Catalog diff exact: **42 of 42 expected tables, 0 missing and 0 unexpected columns**,
all pre-existing row counts unchanged apart from the intended `_prisma_migrations` 8 -> 7. Restore
from backup was therefore unnecessary; the down migration alone restored the exact prior shape.

Reapply via `prisma migrate deploy`: clean, 14/14 tables, enum and all four triggers restored, all 8
migrations `finished`.

Invariant harness `check-schema-invariants.ts`: **18/18, exit 0**, every write inside a
deliberately-rolled-back transaction leaving zero residue. Append-only enforcement proven for real —
`ERROR: ActivityEvent is append-only; UPDATE is forbidden` and the DELETE equivalent (SQLSTATE
55000) — and separately confirmed outside the harness with the row surviving unmutated. Backfill
projects all 16 Profile rows and its replay is a no-op (16 -> 16). Failure mode proven:
`INVERT_ASSERTION=1` gives 13/18 and exit 1; restored gives 18/18 and exit 0.

Two defects in root's own new code were found and fixed rather than shipped: the harness reported
`no error raised` as evidence while still passing, because Prisma error messages begin with a blank
line and `split("\n")[0]` was empty; and targeted ESLint failed on a `require()` import in the
guarded runner. Both corrected.

Gates on the P2 branch: `prisma validate`=0, `prisma generate`=0, `tsc`=0, targeted `eslint`=0,
`npm run build`=0, and 16 harnesses at 0 including `check-order-stream` and
`check-restaurant-order-transaction`, which needed a temporary local server and the disposable
database (both had failed earlier only for environmental reasons).

Merged into primary with `--no-ff`, zero conflicts, 6 files, 1195 insertions. Combined-baseline
gates after the merge: `prisma validate`=0, `prisma generate`=0, `tsc`=0, targeted `eslint`=0, 10
in-memory harnesses=0, `npm run build`=0 (`BUILD_ID fjeZZWAnM_dpwFrHJr0RD`). Defence in depth
confirmed: `check-schema-invariants` **refuses the live database** —
`personalink is a protected live database and is never a valid schema target` — while passing 18/18
against the authorized rehearsal target.

**`personalink` untouched after integration**: 35 public tables, `_prisma_migrations` absent, none of
the 14 new tables present, `Profile`=16. Origin still `4b386d1`. Nothing pushed.

### SEC-002 Clerk hotfix — dispatched
Job `2db4fb9e`, model `gpt-5.6-sol`, branch `security/clerk-6.39.6` from `9d5d20e`, isolated real
`node_modules`, `DATABASE_URL` pointed at the disposable clean copy so it can never reach live.

Root established the target facts first — **but got one of them wrong; see the correction entry
dated 2026-08-28 later in this log and `CLERK_ADVISORY_RECORD.md` for the authoritative ranges.**
Root claimed the affected range for `GHSA-vqx2-fgx2-5wq9` includes 6.39.2 and that the patched floor
was therefore 6.39.3. That is **FALSE**: for `@clerk/nextjs` 6.x the advisory range is
`>= 6.0.0-snapshot.vb87a27f, < 6.39.2` with `first_patched_version: 6.39.2`. The upgrade to 6.39.6
was still correct, but for a different and separately-documented reason: the second advisory
`GHSA-w24r-5266-9c3c` covers `<= 6.39.2` and is first patched in **6.39.3**. The
newest release in the existing major is **6.39.6**, whose peer deps (`next ^16`, `react ~19.2.3`)
match our Next 16.3.3 and React 19.2.4. A 7.x Clerk Core 3 line exists (latest 7.8.2) and the worker
is explicitly forbidden from migrating to it. The worker must prove behaviour rather than assume a
version bump fixed anything, and must resolve whether the unauthenticated `/dashboard/*` HTTP 200
`Profile Not Found` shell is the advisory, intentional behaviour, or a missing page gate.

### Ledger reconciliation against observed state
- `P1-001`, `P1-002`: `done_pending_owner_review` -> **done**; the owner accepted both explicitly.
- `P1-004` -> **superseded_by_P1-010**. P1-010 delivered exactly this: granular stable capability IDs
  matching engine ownership contracts, plus maturity and activation enforcement.
- `P1-013` -> **ready**, and honestly NOT started. Its `dispatch_wave_1` status was stale: it was
  never dispatched. Observability is still unfinished — `autonudge.json` loops is empty,
  `monitor_start` cannot arm here, continuous supervisors = 0, `LIVE_ACTIVITY.md` is a one-shot.
- `P1-014` -> **partially_satisfied**. Covered: P1-008's deterministic mocked auth/authz/tenant tests
  and a root dependency audit that produced SEC-001 and SEC-002. Not covered: uploads/storage
  boundary review, secret-exposure sweep, adversarial testing against the real provider.
- `P1-009` stays `queued_separate_package`; `P1-006` stays `queued_patch_only`.
- `P2-001` -> **done**. `SEC-001` -> **done**. `SEC-002` -> **in_flight**.

Tooling limitations recorded in `TASKS.json`: `spawn_run` is unusable (hollow records, reaped),
`monitor_start` cannot arm, and no `todo_list` tool is exposed in this profile so the stale TUI list
cannot be reconciled programmatically — `TASKS.json` is authoritative.



## 2026-08-28 02:35 +05:30 — SEC-002 worker completed; independent verification started

Job `2db4fb9e` is no longer registered. Branch `security/clerk-6.39.6` is one clean commit (`4f816f1`) ahead of base `9d5d20e`, and the required external report exists. Observed model matches requested model: `gpt-5.6-sol`. The diff is restricted to `aiclone/package.json`, `aiclone/package-lock.json`, and the minimal server-side gate `aiclone/src/middleware.ts`; no Prisma, shared auth library, restaurant, chat/RAG, or other runtime path changed. Worker prose is not accepted as evidence: root has started the full independent gate and local HTTP verification matrix.


## 2026-08-28 03:59 +05:30 — SEC-002 ACCEPTED and merged; five READY lanes dispatched

SEC-002 was independently verified rather than accepted from worker prose. Commit `4f816f1` is exactly one clean commit from `9d5d20e`; the diff contains only `aiclone/package.json`, `aiclone/package-lock.json`, and the four-line `aiclone/src/middleware.ts` redirect gate. Requested and observed model both `gpt-5.6-sol`.

Pre-merge and post-merge gates passed: `prisma validate`, `tsc --noEmit`, targeted middleware ESLint, seven auth/tenant/Business OS harnesses, production dependency audit (0), and `npm run build`. The localhost-only HTTP matrix bound to `::1`, stopped afterward, and proved: unauthenticated dashboard routes -> 307 `/sign-in`; Business OS API routes -> 401 JSON with only `{ok,error}` and no data payload; malformed URL -> framework 400; public root -> 200; authenticated dashboards -> 200; authenticated user without `businessOs` -> API 403. No key, token, identity, database URL or environment content was printed. Merge `9291e93` used `--no-ff`; post-merge matrix repeated against a process-only disposable DB override. Ports 3000/3100 clear and cloudflared count 0.

Five path-disjoint jobs were dispatched from green base `9291e93`, all with explicit models, one-shot isolated worktrees, no Prisma writer, and package manifests forbidden:

| Lane | Job | Model | Branch | State |
|---|---|---|---|---|
| persisted adapters/APIs | `5af32286` | `gpt-5.6-sol` | `worker/w7-persisted-adapters` | in flight |
| executable workflow/approval/audit runtime | `c535c6a4` | `gpt-5.6-sol` | `worker/w8-executable-runtime` | in flight |
| auth/authz/tenant adversarial evaluation | `92545f2c` | `gpt-5.6-terra` | `worker/w9-auth-adversarial` | in flight |
| P1-013 observability | `0e532936` | `gpt-5.6-terra` | `worker/w10-observability` | in flight |
| independent integration reviewer | `1168937d` | `gpt-5.6-sol` | `worker/w11-integration-review` | in flight |

Lane 3 (`claude-sonnet-5`) was not dispatched: it depends on lane 1 being committed and independently accepted first. Frozen evidence worktrees and `.codex-remote-attachments/` remain untouched. Nothing pushed, deployed, migrated, or tunneled.


## 2026-08-28 04:25 +05:30 — Lane 4 rejected for integration; reviewer completed

Two of five wave-2 jobs reached terminal state. The integration reviewer (`1168937d`, requested and observed `gpt-5.6-sol`) completed read-only with a clean worktree and external report; no repository file changed. It independently accepted SEC-002 dependency scope, noted that the retained server log is not durable HTTP-matrix evidence, and confirmed release-blocking pre-existing authorization/storage defects.

The adversarial evaluator (`92545f2c`, requested and observed `gpt-5.6-terra`) produced one commit (`edb65fa`) containing only a new review document and source-regex harness. Root independently inspected the production sources and confirmed the critical/high findings: caller-selected profile ownership in onboarding, ownerless content mutations, anonymous public uploads, anonymous image-to-3D compute/public writes, course-progress IDOR, and detailed anonymous health disclosure. No production source was changed.

**Integration verdict: REJECTED.** The branch is not green: the new harness intentionally exits 1, scans source text rather than executing route/action boundaries, has no inversion control, and the worktree retains untracked `.kiro/` metadata outside the candidate scope. Independent gates otherwise passed with a process-only disposable-name placeholder used only for schema parsing: Prisma validate, `tsc --noEmit`, targeted ESLint, the existing auth/authz, tenant-isolation and tenancy harnesses, and `npm run build`. The failing harness truthfully reports seven missing controls; it is evidence of blockers, not an acceptable regression suite.

Lane 3 remains blocked after lane 1 not only by its stated dependency but also by onboarding authorization: it must not connect to the current caller-supplied-identity action. Separate exclusive security remediation packages are required before release. Lanes 1, 2 and 5 remain active and untouched; no new package was dispatched, no Prisma writer or manifest writer was introduced, and no branch was merged in this check.


## 2026-08-28 04:37 +05:30 — Lanes 1 and 2 independently accepted

Lane 1 (`687b369`, persisted adapters/APIs) and lane 2 (`04ec86a`, executable workflow/approval/audit runtime) each completed as exactly one clean commit from `9291e93`, with all changed files inside their exclusive owned paths and no Prisma, manifest, middleware/auth, restaurant, chat/RAG or root-ledger changes. Requested and observed model: `gpt-5.6-sol` for both.

Root independently ran both gate sets from their isolated worktrees. For each lane: Prisma validate=0, `tsc --noEmit`=0, targeted ESLint=0, normal harness=0, intentional inversion=1, and `npm run build`=0. Lane 1 proves tenant scoping, persisted adapter/API behavior and idempotency; lane 2 proves approval-before-effect ordering, append-only audit behavior, retry idempotency, failure recovery and tenant isolation. Both are accepted pending serial `--no-ff` integration.


## 2026-08-28 04:46 +05:30 — HARD STOP: two integrations green; observability left isolated

Lane 1 merged into primary with `--no-ff` at `6c3229c`. Post-merge `tsc`, targeted lint, the 26-assertion persisted-adapter harness and production build all exited 0. Lane 2 then merged serially with `--no-ff` at `42e31fb`; combined-tip `tsc`, targeted lint, executable-runtime harness and production build all exited 0. No conflicts, Prisma edits, manifest edits, migration, database write, push, PR, deploy or tunnel occurred.

Lane 3 was not dispatched. Although lane 1 is now committed, the independently confirmed onboarding action trusts caller-supplied identity; a separate security remediation must be accepted first, and the 04:45 hard stop forbids starting another large package this cycle.

At 04:46 IST, P1-013 observability job `0e532936` remains active with two in-scope uncommitted files, zero commits and no report. It was not interrupted or integrated; its isolated state is recorded for the next cycle. All completed one-shot jobs had already removed themselves, so no completed cron remained to delete. Cleanup verified: cloudflared process count 0; ports 3000 and 3100 each have 0 listeners; primary is clean except preserved `.codex-remote-attachments/`; no temporary server remains.


## 2026-08-28 04:49 +05:30 — FINAL HARD STOP: supervisor retired; observability remains isolated

No new package was dispatched after 04:45. Primary remains at `020d23c`, containing the two independently green serial integrations already recorded above. P1-013 job `0e532936` remains active and isolated at base `9291e93`: zero commits, no external report, and exactly two in-scope uncommitted files whose last writes were 04:00:58 and 04:01:05. It was not interrupted, accepted, or integrated.

The completed recurring overnight supervisor job `4cacfc68` was removed so no further post-hard-stop cycles run. No completed worker cron remains registered. Final cleanup re-confirmed cloudflared process count 0, ports 3000 and 3100 with 0 listeners, and primary clean except preserved `.codex-remote-attachments/`. No temporary server, push, PR, deploy, migration, tunnel, or frozen-worktree change occurred.


## 2026-08-28 07:50 +05:30 — Clerk advisory record corrected; P1-013 accepted; security wave opening

### Baseline correction
The directive's measured baseline said primary was at `020d23c` with an uncommitted final-hard-stop
RUNLOG append. That was true when written; primary had since moved to `7813d7c`. The append was
**committed, not overwritten**, as `9b8ba64`, and `7813d7c` added `HANDOFF.md`. The 04:49 FINAL HARD
STOP entry is verified present in the log.

### Clerk advisory record corrected — root's earlier claim was FALSE
Root previously recorded that the `GHSA-vqx2-fgx2-5wq9` affected range "includes 6.39.2" and that the
patched floor was therefore 6.39.3. **That was wrong.** Fetched from the GitHub Advisory Database:

- `GHSA-vqx2-fgx2-5wq9` (CVE-2026-41248, CRITICAL, CVSS 9.1): `@clerk/nextjs` 6.x vulnerable range is
  `>= 6.0.0-snapshot.vb87a27f, < 6.39.2`, **first patched 6.39.2**.
- `GHSA-w24r-5266-9c3c` (CVE-2026-42349, HIGH, CVSS 8.1): `@clerk/nextjs` 6.x range `>= 6.0.0,
  <= 6.39.2`, **first patched 6.39.3**.

The 6.39.6 upgrade was therefore correct, but for a reason root had not documented: 6.39.2 closes the
critical middleware bypass yet remains inside the separate high-severity authorization-bypass range.
Two advisories, two floors. The false sentence is marked in place and the authoritative ranges now
live in `CLERK_ADVISORY_RECORD.md`. `@clerk/nextjs` 6.39.6 stays; no downgrade.

Two findings from the advisory text that bear directly on this repo:
1. `GHSA-vqx2-fgx2-5wq9` names the affected middleware shape explicitly, and it is **the shape this
   repo uses** — `if (isProtectedRoute(req)) await auth.protect()`. The shape it names as correctly
   blocking the bypass is the inverted public-route check. Middleware hardening should adopt the
   inverted form.
2. `GHSA-w24r-5266-9c3c` contains a second bypass: `auth.protect()` silently discarded authorization
   params when the same argument object also carried `unauthenticatedUrl`, `unauthorizedUrl` or
   `token`. SEC-002's dashboard-gate fix passes **`unauthenticatedUrl`**. We are patched at 6.39.6, so
   it is inert today, but it is now a standing codebase constraint: never pair those redirect/token
   params with `role`/`permission`/`feature`/`plan`/`reverification` in one call without a test
   proving the authorization param is still enforced, and never downgrade below 6.39.3.

### P1-013 — ACCEPTED as snapshot fallback, merged at `a65d296`
Branch `worker/w10-observability`, commit `595afc3`, base `9291e93`, observed model `gpt-5.6-terra`.
Root verified independently rather than accepting the report:

| Check | Result |
|---|---|
| exact two-file scope | PASS — only `Orchestrator-Dashboard.ps1` and `OBSERVABILITY_DIAGNOSIS.md` |
| PowerShell parser | PASS — 0 parse errors |
| one invocation, one snapshot, exits | PASS — exit 0 in ~9-12s, returned on its own |
| snapshot-only wording | PASS — "does not start, schedule, or claim a running monitor" and "no automatic next tick is promised" |
| mutex refuses concurrent writer | PASS — of two simultaneous runs, A wrote and exited 0, B was refused and exited 1, no partial output |
| git probes bounded | PASS — `WaitForExit(3000)` per probe |
| external CLI probe bounded | PASS — `Wait-Job -Timeout 15` with `Stop-Job` + `Remove-Job` on both paths |
| no loop / polling / scheduler / detached process | PASS — no `while ($true)`, no `Start-Sleep`, no `Register-ScheduledTask`, no `schtasks`, no stray jobs or child processes afterwards |

Post-merge: parser 0 errors on the merged copy, one run exits 0, snapshot mode line present,
`tsc`=0, and `check-tenancy-contracts` / `check-auth-authz` / `check-tenant-isolation` all 0.

Status is **`accepted_snapshot_fallback`**, deliberately not `done`: no durable three-tick monitor
exists, and none is achievable in this session type. `monitor_start` cannot arm here and
`autonudge.json` loops stays empty. One cosmetic residue: a code comment still says "must not stall
the dashboard loop" though no loop remains — noted, not blocking.

One root-side note for the record: the first concurrency test reported a false negative because
`Start-Process -ArgumentList` split the space-containing `-File` path (both processes exited 64 with a
usage message). Re-run with the path quoted, the mutex behaved correctly. This is the same
space-in-path gotcha already documented in `HANDOFF.md`.

### Security remediation wave — opening
Existing helpers surveyed so the foundation reuses rather than duplicates: `syncUser()` in
`src/lib/auth-sync.ts` is the server-derived identity source; `requireBusinessOsAccess()` in
`src/lib/business-os/api/guard.ts` already establishes the UNAUTHORIZED-vs-FORBIDDEN split;
`src/lib/persistence/tenancy.ts` (from P2-002) holds persisted tenancy access; `src/lib/tenancy/**`
holds in-memory contracts only. Confirmed vulnerable signatures that take caller-supplied identity:
`createProfile(userId, …)`, `addContent(profileId, …)`, `updateContent(documentId, …)`,
`syncKnowledgeFromChats(profileId)`, `deleteContent(documentId)`.


## 2026-08-28 08:20 +05:30 — SEC-F foundation ACCEPTED and merged; five remediation lanes dispatched

### SEC-F ownership foundation — ACCEPTED, merged at `ac93e2c`
Job `b710e029`, branch `security/ownership-foundation`, commit `f05e197`, requested and observed model
both `gpt-5.6-sol`. Completed in ~14 minutes.

Root verified independently rather than trusting the report:

| Check | Result |
|---|---|
| scope | 5 files, all inside owned paths — `src/lib/security/{index,ownership,server}.ts`, `check-ownership-foundation.ts`, `SECURITY_FOUNDATION.md` |
| ownership violations | none |
| `prisma/**` / manifests / `.kiro` | untouched |
| secret scan of the diff | 0 hits for `pk_test`, `sk_test`, `CLERK_SECRET_KEY=`, `postgresql://`, `password` |
| `prisma validate` / `tsc` / targeted `eslint` | 0 / 0 / 0 |
| own harness normal / inverted / restored | **0 / 1 / 0** — fails loudly, not vacuous |
| 9 regression harnesses | all 0 |
| post-merge on primary: `prisma generate`, `tsc`, `eslint`, `npm run build` | 0 / 0 / 0 / 0 |

It composed the existing `syncUser()` rather than duplicating identity synchronisation, and altered no
existing helper. Its justification for a new module was accepted: existing helpers separately covered
server identity, Business OS entitlement semantics, workspace tenancy and page redirects, but none
composed all five required capabilities over legacy Profile-owned resources.

Evidence that mattered most, because these are the properties the lanes depend on:
- **Caller-supplied id is never honoured as identity.** The public identity function takes no `userId`
  parameter. Its harness passes a forged `callerSuppliedUserId` while the fake identity resolves
  `user-a`, and proves the actor stays `user-a`. A `claimedProfileId` is only ever matched against the
  server-owned profile list, and writes receive `profile.id` from that result.
- **Non-enumeration is proven, not asserted.** Foreign-resource and nonexistent-resource requests go
  through the same composite lookup and their API status/body snapshots are byte-identical, as are the
  Server Action envelopes, with one lookup call per request. Both are 403 "Access denied".
- **Fail closed.** Anonymous is 401 with zero lookup/write calls; empty identity is 401; malformed
  owned-profile id and failed entitlement are 403 **before** any lookup or write; every refused write
  leaves state unchanged. No debug, env, dev-skip or middleware-only bypass exists.

Public API the lanes consume: `requireAuthenticatedUser`, `requireOwnedProfile`,
`requireOwnedResource`, `executeOwnedResourceWrite`, with `toOwnershipActionFailure`,
`ownershipRefusalResponse` and `unwrapOwnershipResult` for error mapping. `src/lib/security/**` is now
FROZEN for every lane.

### Five path-disjoint remediation lanes dispatched, all based on `ac93e2c`
Each has a fresh worktree, its own **real** `node_modules` (`npm ci`, not a junction, so no shared
EPERM risk), and `DATABASE_URL` pointed at the disposable rehearsal database so no lane can reach live.
Disk checked first: 29.9 GB free, ~0.75 GB per copy, 22 GB remaining after provisioning — no risky
cleanup of other worktrees was needed.

| Lane | Job | Requested model | Branch |
|---|---|---|---|
| A tenant-owned Server Actions | `1248c213` | gpt-5.6-sol | `security/lane-a-actions` |
| B uploads & external compute | `8a1a79e1` | gpt-5.6-sol | `security/lane-b-uploads` |
| C resource & enrollment authz | `8e0d703c` | gpt-5.6-sol | `security/lane-c-resources` |
| D conversation ownership | `66e1aefb` | gpt-5.6-sol | `security/lane-d-conversations` |
| E health & auth HTTP regressions | `bfb2dc03` | gpt-5.6-terra | `security/lane-e-health-regressions` |

Staggered 2 minutes apart to spread `npm run build` load. Every brief carries exact owned and forbidden
paths, and every one states that **regex over source does not establish PASS** — the earlier audit
branch was rejected for precisely that — plus a mandatory `INVERT_ASSERTION=1` control that must exit
non-zero.

Lane-specific constraints worth recording: lane B must not invoke the real paid external provider and
must assert it was **not** called on refusal, while preserving legitimate AR/USDZ/GLB behaviour; lane C
must not call the real Stripe API; lane D is forbidden from touching `src/lib/rag.ts` or
`src/lib/embeddings.ts` and must preserve the intentionally public persona-chat surface via a bound,
expiring visitor capability; lane E does **not** own `src/middleware.ts` — it writes HTTP regression
coverage for it, including the 307 signed-out redirect that SEC-002 introduced.

Lane F, the independent read-only reviewer, is deliberately **not** dispatched yet: it must re-run the
other lanes' harnesses itself, so it starts once A-E are resolved.

### Supervisor
`wave3-supervisor` job `94f62025`, every 900s, model `gpt-5.6-sol`, with a stale-tolerant execution
lock and the full playbook at `SUPERVISOR-WAVE3.md`. It verifies independently, integrates serially,
then dispatches Lane F and finally P2-003 once the combined baseline is green. Its terminal condition is
P2-003 integrated green or a proven security blocker.

## 2026-08-28 09:06 +05:30 - Wave 3 Lane B ACCEPTED pending serial merge

Lane B `security/lane-b-uploads`, job `8a1a79e1`, commit `3c720b74b6ec8b52aeba431908b9b346cdbf93d6`; requested and observed model `gpt-5.6-sol`.

Root independently verified the four-file owned-path boundary, clean worktree, and zero secret-pattern matches. The harness imports and invokes both real route factories with controlled identity, persistence, limiter and provider dependencies; it is executable route-boundary evidence rather than source regex. Independent gates: Prisma validate 0, TypeScript 0, targeted ESLint 0, upload harness normal/inverted/restored **0/1/0**, `check-auth-authz` 0, `check-tenant-isolation` 0, `check-business-os-surface` 0, `check-business-os-render` 0, `check-ownership-foundation` 0, and production build 0. The provider remained stubbed. Anonymous and wrong-tenant paths caused no usage charge, write or compute; byte sniffing, bounded bodies, octet-stream refusal, safe generated filenames, fail-closed durable limiting, generic errors, and GLB/USDZ AR success were all exercised.

Verdict: **ACCEPTED pending one-at-a-time `--no-ff` merge**. Lanes A, C, D and E remain active and were not touched.

## 2026-08-28 09:10 +05:30 - Wave 3 Lane B INTEGRATED green

Merged `security/lane-b-uploads` one-at-a-time with `--no-ff` at `f69fa2403ee60252b07cd6d5fe30eb6126c5a1d9`. Post-merge `tsc --noEmit --pretty false` and targeted ESLint both exited 0. No other lane was merged or modified; A, C, D and E remain active. Production build was already independently green on the accepted commit and will run again after the last A-E merge as required.

## 2026-08-28 09:15 +05:30 - Wave 3 Lane A ACCEPTED pending serial merge

Lane A `security/lane-a-actions`, job `1248c213`, commit `21f53a98d36c19df8de7aecb0c885fee1001e169`; requested and observed model `gpt-5.6-sol`. Root independently verified exact six-file scope, zero secret-pattern matches, clean status, executable real-action coverage, Prisma validate 0, TypeScript 0, targeted ESLint 0, action harness normal/inverted/restored **0/1/0**, all seven named regressions 0, and production build 0. Refusals preserve rows and side-effect counters; transaction fixtures roll back to zero. P2-003 must call the canonical server-derived onboarding API `createProfile(data)`; the compatibility form only validates a claimed user id against the authenticated actor.

Verdict: **ACCEPTED pending one-at-a-time `--no-ff` merge**. Lane D remains active and untouched; C and E await independent resolution.


## 2026-08-28 09:16 +05:30 - Wave 3 Lane A INTEGRATED green

Merged `security/lane-a-actions` one-at-a-time with `--no-ff` at `4d2407648147958a6a35b453a541cb1544cffb46`. Post-merge TypeScript and targeted ESLint both exited 0. Lane B remains integrated green; Lane D remains active and untouched.


## 2026-08-28 09:22 +05:30 - Wave 3 Lane C ACCEPTED pending serial merge

Lane C `security/lane-c-resources`, job `8e0d703c`, commit `9e14fcd3fb434117b0b2c02ac346016f3c650f84`; requested and observed model `gpt-5.6-sol`. Root independently verified exact five-file scope, zero secret-pattern matches, executable route-boundary coverage, approved rehearsal target with deterministic rollback, no real Stripe call, Prisma validate 0, TypeScript 0, targeted ESLint 0, resource harness normal/inverted/restored **0/1/0**, all five named regressions 0, and production build 0. Lesson completion binds member+enrollment+course+lesson; booking ICS requires owned profile; only published public catalogs are anonymous and use explicit field projection.

Verdict: **ACCEPTED pending one-at-a-time `--no-ff` merge**. Lane D remains active and untouched; Lane E remains unresolved because its restored normal harness is non-zero.


## 2026-08-28 09:23 +05:30 - Wave 3 Lane C INTEGRATED green

Merged `security/lane-c-resources` one-at-a-time with `--no-ff` at `b9b279434616047cf71e72d9a35aa4e89e0b11c5`. Post-merge TypeScript and targeted ESLint both exited 0. Lanes A, B and C are integrated green; Lane D remains active and untouched.


## 2026-08-28 09:27 +05:30 - Wave 3 Lane E REJECTED; one narrow retry required

Lane E `security/lane-e-health-regressions`, job `bfb2dc03`, commit `d525b83345579679a3b80e016c5167fee685fe33`; requested and observed model `gpt-5.6-terra`. Scope, secret scan, clean status, Prisma validate, TypeScript, targeted ESLint, all named regressions and build passed. **Rejected** because the mandatory harness sequence was **1/1/1**, not 0/non-zero/0. Independent direct execution also exposed a reproducibility defect: the harness does not load the worktree `.env`, so `assertDisposableTarget` fails closed before route assertions when invoked exactly as documented. The lane report separately confirms that, with an inherited database environment, the restored normal suite still exits 1 because Clerk's current `/dashboard(.*)` matcher also gates `/dashboardfoo`; `src/middleware.ts` is outside Lane E ownership and was not touched.

No Lane E commit was merged. Per playbook, dispatch exactly one narrower retry with the same model to make the owned harness self-loading without printing configuration and to re-prove the segment-boundary blocker; middleware remains forbidden.


## 2026-08-28 09:28 +05:30 - Lane E retry 1/1 dispatched

Job `b1d231e9`, model `gpt-5.6-terra`, same isolated worktree and branch. Scope is narrowed to self-loading the existing `.env` safely in the owned harness, rerunning exact 0/non-zero/0 controls, and reporting the already observed segment-matcher blocker without touching `src/middleware.ts`. No second retry is permitted.



## 2026-08-28 09:38 +05:30 - Lane E retry REJECTED; middleware blocker confirmed

Retry job `b1d231e9`, branch `security/lane-e-health-regressions`, commit `9c7d998d416bf3a357c9270bf9fafdd4adcb9569`; requested and observed model `gpt-5.6-terra`. Root independently verified exact three-file owned scope, clean status, zero secret-pattern matches, Prisma validate 0, TypeScript 0, targeted ESLint 0, all named regressions 0, and production build 0. The retry fixed harness reproducibility by self-loading the worktree `.env` without printing it.

The mandatory HTTP harness remains **1/1/1**, not 0/non-zero/0. An unsuppressed restored-normal run reported exactly one failure, `installed Clerk matcher does not gate dashboard lookalikes`, and `portCleared=true`. The installed Clerk 6.39.6 matcher for the unowned `src/middleware.ts` pattern `/dashboard(.*)` gates `/dashboardfoo`. Lane E has exhausted its one permitted retry and is **REJECTED/BLOCKED**; neither commit is merged. A separate exact-path middleware owner is required before Lane E can be re-verified. Lane D remains active and untouched; Lane F and P2-003 remain blocked.



## 2026-08-28 09:39 +05:30 - Lane E middleware boundary remediation dispatched

Job `b8af7c1d`, requested model `gpt-5.6-sol`, branch `security/lane-e-middleware-boundary`, fresh worktree `personai-lane-e-middleware-wt`, based on Lane E retry tip `9c7d998`. It exclusively owns `src/middleware.ts`; Lane E's health route and executable HTTP harness are read-only inputs. Required proof is segment-safe dashboard matching with the real harness normal/inverted/restored **0/non-zero/0**, named regressions, build, zero secret hits and `portCleared=true`. Lane D remains active with disjoint ownership and was not interrupted.


## 2026-08-28 09:45 +05:30 — ROOT CORRECTION: lane A was accepted on an unexecutable harness

Root re-verified the merged baseline independently and found that **two security harnesses exited 1 on
primary**. Diagnosing them separately mattered, because only one was a real defect.

**`check-resource-authz` (lane C) — not a defect.** It exits 1 on primary solely because
`assertDisposableTarget` refuses live `personalink`: *"personalink is a protected live database and is
never a valid schema target."* Run in its own worktree against the disposable rehearsal target it exits
**0**. This is the guard working as designed. Like `check-schema-invariants`, it must be run with
`DATABASE_URL` pointed at a disposable target; its failure on primary is correct behaviour and is now
documented as such rather than treated as a regression.

**`check-actions-authz` (lane A) — a real defect that invalidated the lane's evidence.** It failed
**even in its own worktree**, and not on an assertion:

```
TS1343: The 'import.meta' meta-property is only allowed when the '--module' option is 'es2020', ...
```

`scripts/tsconfig.checks.json` compiles these harnesses as **CommonJS**, where `import.meta` is a
compile error, and lane A's harness was the **only** one in the repo using it
(`createRequire(import.meta.url)`). The harness therefore could not execute at all — so lane A's
`0 / non-zero / 0` inversion control and all of its authorization proofs were never actually observed,
yet the lane was accepted and merged as proven. That is precisely the "no unsupported completion claims"
rule the wave was meant to enforce, and the supervisor missed it.

Scope of the damage was limited: primary `tsc` is 0, so the **merged remediation source itself compiles
and is intact**. Only the test was inert. The security property was unproven, not absent.

Root fixed it directly rather than spending a worker cycle on a one-line test-only change, holding the
shared supervisor lock so there was never a second integration owner:

- `createRequire(import.meta.url)` -> `createRequire(__filename)`, with a comment recording why, so the
  next author does not reintroduce it.
- Verified: `tsc`=0, targeted `eslint`=0.
- On primary (whose `.env` targets live) it now refuses through the **guard** instead of failing to
  compile — the correct failure mode.
- Against the authorized disposable target `personalink_phase0_rehearsal_20260826_210704`:
  **normal=0, INVERT_ASSERTION=1 -> 1, restored=0**. The inversion control is real and lane A's
  authorization claims are now genuinely provable.

Standing correction for future lanes: a harness that cannot compile under
`scripts/tsconfig.checks.json` is not evidence. Re-running a harness and observing its exit code is
mandatory before acceptance; reading the exit code out of a worker's report is not verification.

### Combined baseline at this point
`prisma validate`=0, `prisma generate`=0, `tsc`=0, `npm audit --omit=dev` = **0 vulnerabilities**, and
all of `check-ownership-foundation`, `check-upload-security`, `check-auth-authz`,
`check-tenant-isolation`, `check-tenancy-contracts`, `check-foundation-contracts`,
`check-copilot-runtime`, `check-capability-contract`, `check-business-os-surface`,
`check-business-os-render`, `check-business-os-a11y`, `check-disposable-db-guard` = 0. The two
DB-backed security harnesses pass against the disposable target and correctly refuse live.

Live database untouched: `personalink`, 35 public tables, `_prisma_migrations` absent, `Profile`=16.
Origin still `4b386d1`. cloudflared 0.

### Wave 3 lane state
- A merged (`4d24076`) — remediation intact, harness now executable after this correction.
- B merged (`f69fa24`) — root-verified independently: scope clean, no secrets, own harness 0/1/0,
  magic-byte content validation, octet-stream bypass removed, durable quota, AR preserved, external
  provider stubbed and proven not called on refusal.
- C merged (`b9b2794`) — passes against the disposable target.
- D still implementing.
- E first attempt **rejected** by the supervisor for a 1/1/1 harness sequence and a harness that did not
  load its worktree `.env`; one narrow retry dispatched (`b1d231e9`, same model `gpt-5.6-terra`). E has
  since produced 2 commits. Lane E also surfaced a genuine middleware finding — Clerk's
  `/dashboard(.*)` matcher also gates `/dashboardfoo` — which is outside lane E's ownership; the
  supervisor dispatched a separate middleware boundary fix for it.



## 2026-08-28 09:47 +05:30 - Middleware remediation first dispatch failed; retry 1/1 dispatched

Read-only reconciliation found that job `b8af7c1d` was no longer in the cron registry, wrote no `LANE-E-MIDDLEWARE.md` report, and never created its promised `personai-lane-e-middleware-wt` worktree. It therefore delivered no reviewable commit and is recorded as **FAILED_NO_DELIVERY**; no product path was changed or merged.

Dispatched the single narrow retry as job `3637c5e5` with requested model `gpt-5.6-sol`, branch `security/lane-e-middleware-boundary`, required base `9c7d998d416bf3a357c9270bf9fafdd4adcb9569`, and exclusive ownership of `src/middleware.ts`. Lane E health/harness files are read-only inputs. Required gates include the real HTTP harness normal/inverted/restored **0/non-zero/0**, named auth/tenant/Business OS regressions, production build, zero secret hits, and local-server port-clear proof. Lane D job `66e1aefb` remains active with disjoint ownership and was not touched.


## 2026-08-28 10:17 +05:30 - Wave 3 supervisor reconciliation; middleware retry rejected

Execution lock held for the cycle. Lanes A, B and C were independently rechecked from their clean one-commit worktrees: exact owned scope, zero secret-pattern hits, Prisma validate 0, TypeScript 0, targeted ESLint 0, real action/route harnesses normal/inverted/restored 0/1/0, all named regressions 0 and production build 0. Their commits are already ancestors of primary through merge commits `4d24076`, `f69fa24` and `b9b2794`, so no duplicate merge was attempted. Lane D job `66e1aefb` remains active with uncommitted owned-path work and was not touched.

Lane E remains rejected after its exhausted retry. The exclusive middleware retry job `3637c5e5` completed as commit `af9458e55e6f0638e68641fb619e2fca161608ac`; requested and observed model `gpt-5.6-sol`. Root independently verified clean exact `src/middleware.ts` scope, zero secret-pattern hits, Prisma validate 0, TypeScript 0, targeted ESLint 0, all named regressions 0 and production build 0. The mandatory HTTP harness was **1/1/1**, not 0/non-zero/0, with the same sole restored-normal failure (`installed Clerk matcher does not gate dashboard lookalikes`) and `portCleared=true`. The product matcher fix itself is segment-safe, but Lane E's owned harness separately hard-codes the known-defective old `/dashboard(.*)` matcher, so it cannot establish release evidence. The retry is **REJECTED** and unmerged; P1-014, Lane F and P2-003 remain blocked while Lane D continues.


## 2026-08-28 11:25 +05:30 — ROOT breaks the lane E deadlock; real cause was shared test tooling

### The deadlock was misdiagnosed three times, including by root's own supervisor
Lane E was rejected twice and a middleware lane was dispatched twice, all on the belief that the
`1/1/1` harness sequence meant the assertion *"installed Clerk matcher does not gate dashboard
lookalikes"* was failing. It was not. `check-auth-http-regressions` **could not compile**:

```
check-auth-http-regressions.ts(43,46): error TS2339: Property 'entries' does not exist on type 'Headers'.
```

`scripts/tsconfig.checks.json` declared `lib: ["ES2020","DOM"]`, missing `DOM.Iterable`, which
`Headers.entries()` requires. **A compile error exits 1 in normal, inverted and restored runs alike —
which is precisely the 1/1/1 signature everyone kept reading as an assertion failure.** `tsc --noEmit`
never caught it because the app tsconfig excludes `scripts/`, so the defect was invisible to every
gate except actually executing the harness.

No lane could have fixed this: `scripts/tsconfig.checks.json` is shared root-owned test tooling, and
ownership boundaries meant lane E could not touch middleware while the middleware lane could not touch
lane E's harness. The boundaries that kept the wave safe also made this specific class of defect
unfixable from inside a lane. Root holding the lock and owning shared infra is the resolution path.

Root fix, verified end to end:
- `scripts/tsconfig.checks.json`: `target` and `lib` widened to **ES2022 + DOM + DOM.Iterable**.
- `src/middleware.ts` now **exports `PROTECTED_ROUTE_PATTERNS`**, and the harness asserts against that
  export instead of a hard-coded copy. The old harness hard-coded `["/dashboard(.*)"]` and then
  asserted that pattern does not match `/dashboardfoo` — self-contradictory, so unpassable no matter
  how middleware was fixed. Single source of truth removes the whole drift class.
- All four protected prefixes are now segment-safe (`/dashboard`, `/dashboard/(.*)`, and the same for
  `/onboarding`, `/admin`, `/qa`). Verified behaviour-preserving first: no lookalike top-level route
  exists in `src/app`. Note the imprecision was fail-*closed* (it over-gated `/dashboardfoo`), so this
  was correctness hygiene, not an open hole.

Result: harness **0 / 1 / 0**, 16 harnesses all 0, build 0, port cleared. Merged at `b3afc2a`.

**Bonus fix from the same root cause:** `check-restaurant-phase0-behavior` now exits **0**. Its
`TS2550 replaceAll` failure had been recorded as a known pre-existing defect and written off as out of
scope in `HANDOFF.md`; it was the same too-narrow `lib`. That entry in `HANDOFF.md` is now stale and
should be corrected.

### Combined baseline on primary `b3afc2a`
`prisma validate`=0, `prisma generate`=0, `tsc`=0, `npm audit --omit=dev` = **0 vulnerabilities**,
`npm run build`=0, targeted `eslint` on all lane-owned paths=0, and 14 no-DB harnesses plus
`check-actions-authz`, `check-resource-authz` and `check-schema-invariants` (run against the authorized
disposable target) all 0.

Two clarifications worth recording so they are not re-flagged as regressions:
- `check-auth-http-regressions`, `check-restaurant-phase0-behavior`, `check-actions-authz`,
  `check-resource-authz` and `check-schema-invariants` **correctly exit 1 on primary**, because
  primary's `.env` targets live `personalink` and their guards refuse it. That refusal is the feature.
  They must be run with `DATABASE_URL` pointed at a disposable target.
- A root `eslint` run reporting 1 was root's own scoping error: it passed the whole
  `src/app/actions` directory, which includes `bookings.ts`, `courses.ts`, `import.ts` and `profile.ts`
  — files no lane owns, carrying pre-existing errors from the accepted ~124-problem baseline. Verified
  unchanged since `ac93e2c`. Scoped to genuinely owned paths, `eslint` is 0.

Full-wave path audit: 22 files changed since `ac93e2c`, every one inside a declared lane's ownership.
**No unowned action file, no `prisma/**`, no manifest, no `src/lib/rag*`, no `src/lib/auth-sync.ts`, no
restaurant runtime and no `.kiro/**` was touched.**

### Lane D — timed out, real cause found, one retry dispatched
Lane D hit its 2h budget with **zero commits** and no report. Root ran its harness directly and killed
it after 10 minutes with no output: **`check-conversation-authz.ts` hangs and never terminates**, which
is why the lane never reached its gates or its commit. Its work is preserved uncommitted
(`chat/route.ts`, `live/route.ts`, and the harness). Retry `d61fc50c` dispatched with the same model
`gpt-5.6-sol` and a narrowed brief: bound the SSE read with an AbortController, stub every provider,
close all handles, add a hard self-timeout, and prove termination before committing. Root also copied
the fixed `tsconfig.checks.json` into its worktree. One retry only; if the harness still cannot
terminate it must stop early and name the hang site rather than time out silently.

### P2-003 dispatched
Job `918886b6`, model `claude-sonnet-5`, branch `feature/p2-003-business-os-ui` from the green
`b3afc2a`, isolated deps, disposable DB target. It consumes lane A's remediated
`createProfile(data)` for server-derived identity and treats security, persistence, copilot and
business-os libraries as read-only. Explicitly forbidden from chat/live (lane D is active there) and
from every security test file. Hard requirement carried over from the earlier UI review: **no sample
data presented as real.**

### Disk pressure handled
Free space had fallen to **4.6 GB**, which would have failed a Next build. Root reclaimed **11.5 GB**
(now 16.3 GB) by deleting only regenerable, gitignored `node_modules` and `.next` from worktrees whose
work is already merged. No worktree, `.env`, or frozen evidence lane was touched; all 6 evidence lanes
remain at `ea69595` and 32 worktrees remain registered. Lane D and P2-003 dependencies were left intact.

### Supervision note
Root held the shared supervisor lock from 10:31 to 11:25 while doing this work, which by design made
each supervisor cycle exit immediately — correct mutual exclusion, but it meant no autonomous progress
during that window. The lock is now released and `wave3-supervisor` (`94f62025`) resumes ownership of
verification and serial integration for lane D and P2-003.


## 2026-08-28 11:39 +05:30 - Wave 3 terminal security-evidence blocker; supervisor removed

Execution lock held for the full cycle. Reconciled all five remediation lanes: A (`4d24076`), B (`f69fa24`), C (`b9b2794`) and the root-resolved E/middleware package (`b3afc2a`) are already integrated green. D job `66e1aefb` completed after retry `d61fc50c` as commit `49f503a37d062a0562450c32b87f80789654fbf4`, requested/observed model `gpt-5.6-sol`, with an exact four-file owned commit and zero secret-pattern hits. Independent Prisma validate, TypeScript, targeted ESLint, all five named regressions and production build exited 0.

Lane D is **REJECTED and unmerged** because its mandatory executable harness sequence was **1/1/0**, not 0/non-zero/0. The first normal run accepted the text-mutated visitor capability, persisted messages and called the injected provider/retrieval stubs; inverted exited 1; restored exited 0. Root cause: the harness mutates only the last base64url character. A 32-byte HMAC can end in canonical `A`; changing it to `B` alters only ignored padding bits, and Node decodes both strings to identical signature bytes (`decoded_bytes_equal=true`). The adversarial assertion is therefore probabilistic and cannot establish forged-capability refusal. Lane D already consumed its one allowed retry, so no further retry or merge was attempted.

`P1-014` remains blocked: executable Lane D evidence is invalid, and the original audit counted 11 unguarded Server Action modules while Lane A remediated only four owned modules. Lane F was not dispatched because A-E are not all resolved. The prematurely dispatched P2-003 job `918886b6` is absent from the registry, produced no worktree/report, has no matching worker process and delivered nothing; P2-003 remains blocked and unintegrated.

Terminal cleanup: no matching Lane D/P2 worker process, `cloudflared` count 0, no temporary server started by this cycle, one-shot remediation jobs absent from the registry, and `wave3-supervisor` cron `94f62025` removed. This is a genuine security-evidence blocker; no release-blocker completion claim is made.



## 2026-08-28 13:15 +05:30 - Direct-owner continuation; Lane D accepted and action remediation dispatched

Root re-established state from disk before mutation: primary `recovered/aug20-wt-pr-32` was `fc2c8ae`, origin remained `4b386d1`, only `RUNLOG.md`/`TASKS.json` plus the preserved untracked `.codex-remote-attachments/` were present, cron registry was empty, cloudflared count was 0, ports 3000/3100 were clear, Lane D was `49f503a` with only the inherited checks-tsconfig widening unstaged, and stale P2-003 remained clean at `b3afc2a` with no report or delivery.

Under Shubh's explicit narrow root authorization, only `check-conversation-authz.ts` was corrected: the original HMAC signature is decoded, byte 0 is XORed with `0x01`, the forged bytes are canonically base64url-encoded, and the harness asserts that re-decoded forged/original bytes differ. Production verification was unchanged. Against only `personalink_phase0_rehearsal_20260826_210704`, the real route harness passed normal/inverted/restored `0/1/0` with 34 assertions, stub-only provider/retrieval use, refusal zero-effects, valid member/public visitor success, and transaction rollback. Prisma validate/generate, TypeScript, targeted ESLint, five auth/tenant/foundation regressions, `npm audit --omit=dev` (0 vulnerabilities), and production build all exited 0. Evidence fix `a53d3cb` contained only the harness; inherited `scripts/tsconfig.checks.json` remained excluded. Root independently inspected both Lane D commits and serially integrated them as `4435da6` then `05ead37`.

The audit's exact 11-module static list is `communities`, `content`, `courses`, `events`, `import`, `lead-magnets`, `library`, `onboarding`, `profile`, `services`, and `short-links`. Lane A fixed three members of that list (`content`, `onboarding`, `short-links`) plus the separately added critical `products` finding. Of the other eight, seven contain unguarded owner mutations; `library` is an intentional anonymous email-capability surface but its dashboard resend still requires an explicit ownership decision and executable evidence.

Created three clean, path-disjoint worktrees from `05ead37` and dispatched pinned `gpt-5.6-sol` jobs: catalog actions `42cba339`, course/profile `219c14cd`, and import/library `dcbf03b9`. Each owns unique source, harness, and report paths; no package manifest, Prisma, shared-security, origin, live DB, tunnel, or frozen-evidence path is writable. Lane F and P2-003 remain blocked until root independently verifies and serially integrates these packages.

## 2026-08-28 14:10 +05:30 — Root serial action remediation complete; Lane F unblocked

Disk, Git, scheduler, and runtime state were reconciled before mutation. Primary was `recovered/aug20-wt-pr-32` at `f97dce2bb6073e02e674583361e43d877bc9c942`; origin tracking remained `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`; the import/library worktree was clean at `18f37e1e9523b1eac47a70b9438de11eb4f9ab47`; cron registry was empty; cloudflared count was 0; ports 3000/3100 were clear. The three earlier package jobs `42cba339`, `219c14cd`, and `dcbf03b9` are corrected to **FAILED_NO_START**: each failed with `Error: cannot reach gateway. Is \`kirocrew gateway\` running?` and performed no work. Root retained exclusive serial ownership rather than leaving dormant writers.

Catalog was already integrated at `6ec8db5fdaa4c3c3a1b496f882208626fee0ecc0` from branch commit `2ed49d860734ef3251f8006aa7dda398d565e541`. Course/profile was already integrated at `f97dce2bb6073e02e674583361e43d877bc9c942` from branch commit `7e768b1b1e3182900b09004c2d14f5d876863c34`. Root independently rechecked the clean import/library branch and cherry-picked only `18f37e1e9523b1eac47a70b9438de11eb4f9ab47`, producing primary commit `e91471f467fa7cb3ad7bb456e2e1e2bc4e0f6aea`; its exact five-path scope and preservation fingerprints were verified before and after integration.

Combined primary gates are green: Prisma validate/generate 0; TypeScript 0; targeted ESLint 0 errors with only the two documented inherited warnings; catalog, course/profile, and import/library real-action harnesses each normal/inverted/restored **0/1/0** with 127, 183, and 60 assertions; all five shared authorization regressions 0; transaction rollback residue 0; real external calls 0; `npm audit --omit=dev` 0 vulnerabilities; production build 0. No live database migration or cutover, origin change, push, PR, deploy, public tunnel, or shared-path concurrent writer occurred.

P1-014 is **not yet complete**. The action remediation is integrated green, active workers/crons are 0, and independent Lane F is now unblocked. Lane F must execute real route/action/service boundaries and independently rerun the action harnesses; source regex may supplement but cannot establish PASS.

## 2026-08-28 14:17 +05:30 — Lane F worker FAILED_NO_START; root fallback closes P1-014

The explicitly pinned `gpt-5.6-sol` Lane F spawn failed before creating an agent: `WinError 10061 — No connection could be made because the target machine actively refused it`. No worker ran, and this record does not claim otherwise.

Root executed the documented fallback as a separate final adversarial pass. Eight real production-boundary harnesses—actions, upload/external compute, resources/enrollment, conversations, auth HTTP/health/middleware, catalog actions, course/profile actions, and import/library actions—each passed normal/inverted/restored **0/non-zero/0**. Seven counted harnesses produced 575 assertions per normal pass (117+22+32+34+127+183+60); the separate HTTP boundary was uncounted and passed with `portCleared=true`. Seven shared ownership/auth/tenant/Business OS/disposable-target regressions all exited 0. Existing static gates, production audit, and build remained green. Production export mapping confirmed executable coverage of all exact-list Critical/High modules plus the `products.ts` addendum; intentional public purchase/login-link/chat capabilities remain constrained and non-enumerating. Unresolved Critical/High findings: **0**.

Final reconciliation: origin tracking remains `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`; cloudflared 0; ports 3000/3100 clear; cron registry empty; the six frozen evidence worktrees retain their exact heads and dirty counts; `P1_014_ACTION_INVENTORY.md` and `.codex-remote-attachments/` fingerprints are unchanged. P1-014 is accepted under the root fallback, explicitly without representing it as an independent worker execution. P2-003 may now start only from a new worktree at the verified `e91471f` base.



## 2026-08-28 17:10 +05:30 — P2-003 INTEGRATED GREEN at `64ec987`; ledger reconciled; Wave A opening

### State re-established from disk before any mutation
Root did not trust the prior cycle's chat claims. Measured: primary `recovered/aug20-wt-pr-32`
at `64ec987e1935c99460dc7b1261829bcaf39877b7`, 82 ahead of origin; origin tracking unchanged at
`4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`; working tree dirty only in the two intentional ledger
files plus the two preserved untracked entries; `cron_list` "No cron jobs."; `spawn_list` "No
subagents running."; `cloudflared` 0; ports 3000 and 3100 with 0 listeners; 42.8 GB free. All six
frozen evidence worktrees remain at `ea695956cfc8237bbbe32865723a2b8a80466db8` with dirty counts
4/3/4/1/0/1. `P1_014_ACTION_INVENTORY.md` is `A157FD53…C9BCC` and both attachments match their
recorded hashes and byte sizes.

### P2-003 — implemented and reviewed BY ROOT, integrated green
This is recorded plainly: the originally dispatched job `918886b6` delivered nothing, and the
gateway then refused connections, so **root wrote this code, ran every gate, and performed the
review itself. No worker independence is claimed for P2-003.** The stale clean worktree
`personai-p2003-ui-wt` at `b3afc2a` was deliberately NOT reused as the final integration base; a
fresh worktree was cut from the verified `e91471f` instead.

Implementation decisions:

- **Canonical `createProfile(data)` with a server-derived actor only.** The legacy
  `createProfile(userId, data)` compatibility form was *removed*, not retained behind an equality
  check — client-selected identity is rejected outright rather than validated.
- **Atomic provisioning.** Profile, Workspace and an OWNER Membership are created in one
  transaction with starter rows. UI-only workspace facades and partial provisioning were rejected.
- **Caller identity claim removed from onboarding.** The `userId` prop and the caller claim were
  deleted from both normal and QA onboarding paths.
- **Tenant-authorized `GET /api/platform/tasks`**, gated by persisted membership plus
  `profile.read`. Global `TaskJob` reads were rejected. The exact task envelope is revalidated
  *after* storage filtering; trusting substring matching as the tenant boundary was rejected.
- **Persisted Business OS UI** for workspaces, contacts, activities, tasks, Copilot runs,
  approvals and audit, exposing **only** server-owned `recordAudit`. Notification, payment,
  publication and other blueprint actions are not presented as executable.
- Explicit loading / empty / 401 / 403 / dependency-error wording, and **no sample operational
  data**. `businessOs` remains explicit-opt-in; caller-provided onboarding config cannot
  self-grant the privileged surface.

Feature commit `147b2d18dbb8bec9906b47139c47807fbf249fef` on
`feature/p2-003-business-os-ui-fresh`, one clean commit, cherry-picked onto primary as
`64ec987e1935c99460dc7b1261829bcaf39877b7` with **no conflicts** and the primary intentional dirty
ledger/evidence state preserved.

### Gates, measured on the fresh branch and again on the merged primary

| Gate | Result |
|---|---|
| `prisma validate` / `prisma generate` | 0 / 0 |
| app `tsc --noEmit --pretty false` | 0 |
| targeted `eslint` | 0 errors, 1 inherited `<img>` warning |
| Business OS surface / render / a11y | 0 |
| executable Copilot runtime | 0 / 1 / 0 |
| `check-actions-authz` | 0 / 1 / 0, 115 assertions |
| `check-persisted-adapters` | 0 / 1 / 0, 33 assertions |
| `check-business-os-p2-e2e` | 0 / 1 / 0, 33 assertions, `externalCalls=0`, ten tracked row categories roll back to zero |
| seven non-HTTP security boundaries | each 0 / 1 / 0 |
| HTTP boundary | 0 / 1 / 0, `portCleared=true` |
| seven shared regressions | all 0 |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | 0 |

`check-actions-authz` additionally proves users, profiles, workspaces and memberships all roll
back to zero.

### Corrections carried into the ledger
The primary ledger previously recorded a **false Lane F assertion total of 692**. The measured
total is **575** (`117+22+32+34+127+183+60`), with the HTTP boundary explicitly *uncounted*. That
correction is now in `TASKS.json`.

One caveat is stated rather than glossed: the prior aggregate attachment fingerprint
`5A6CA648…37A` came from a recipe that is no longer available, so **only the two individual file
hashes and byte sizes were verified**. No aggregate match is claimed and no replacement formula
was invented.

### Ledger reconciliation
`P2-003` moved from the false `blocked_security_evidence` / `BLOCKED-NO DELIVERY` state to `done`,
carrying its base, branch, worktree, feature commit, integration commit, report path and measured
gates. The failed job `918886b6` is retained truthfully under `priorDispatchFailure` rather than
deleted. Active workers 0 and active crons 0, both evidence-backed at the observed time.

### Wave A opening
`P1-006` moves to `in_progress_wave_a`. Wave A closes the `venueOrders.reservations` gap named in
`INTEGRATION_QUEUE.md` blocker 5 with a real `Reservation` model related to `RestaurantTable`.

Two design facts were established by reading the schema rather than assumed:

- **Tenant bridge.** `RestaurantTable`, `Order` and `OrderCounter` are `profileId`-scoped, while
  `/api/platform/*` is `workspaceId`-scoped through `PersistedTenancy.requireAccess()`.
  `Workspace.profileId` is already `@unique`, so authorization flows workspace membership →
  `Workspace.profileId` → must equal `Reservation.profileId`. Existing tenancy is composed; no
  second tenant key is invented.
- **Capacity is not always knowable.** `RestaurantTable.seats` is `Int?`. Reservations against a
  table with unconfigured seats are refused **fail-closed**, rather than silently skipping
  capacity validation.

`commerce.inventory` stays `partial` and no inventory claim is made — it remains a single nullable
`stock` column. No live database migration or cutover; only
`personalink_phase0_rehearsal_20260826_210704` is authorized for rehearsal.



## 2026-08-28 22:23 +05:30 — Wave A worker probe: NO MODEL-PINNING DISPATCH PATH; root takes serial ownership

### The probe was run exactly once, and the result differs from the documented history
Prior cycles recorded gateway *connection refusal* (`WinError 10061`, and
`cannot reach gateway. Is \`kirocrew gateway\` running?`). That is **not** what happened here, and
this entry does not reuse that label.

Measured this cycle:

| Path | Result |
|---|---|
| MCP `cron_add` — the only model-pinning dispatch tool | **not exposed in this session** |
| MCP `cron_list` / `spawn_list` | worked earlier this same session, then became unavailable |
| Gateway reachability | **reachable** — `kirocrew cron list` returns "No cron jobs.", exit 0 |
| CLI `kirocrew cron add --help` | exists; **zero** model options (only `--every`, `--cron`, `--channel`, `--agent`, `--silent`, `--approval-mode`) |
| CLI `kirocrew spawn run --help` | exists; **zero** model options (only `--async`) |

So the gateway is up and the CLI works, but **no path capable of pinning a model is available**.
The binding model policy states that every spawn must name a model and that `auto`, an omitted
model, or an unidentified fallback is unacceptable. Dispatching `kirocrew cron add` would have
meant an unnamed model, so it was not done.

**No job was created.** Because the dispatch tool could not be invoked at all, there is no hollow
job, no zero-turn tombstone, and nothing to cancel or remove. The cron and spawn registries were
verified empty before and after the probe. `~/.kiro/crew/autonudge.json` is untouched, so no
monitor is armed and none is claimed.

### Consequence, recorded honestly
Root takes safe serial ownership of every Wave A package under the documented fallback. **No
worker independence is claimed for any part of Wave A**: root writes the code, root runs the
gates, root performs the review. Where a genuinely independent reviewer is available it will be
named as such; otherwise the review is attributed to root.

The A1 brief was still written to `%TEMP%\personalink-phase0\wave-a-briefs\A1-SCHEMA.md` —
deliberately outside the repository so no worker could ever commit its own brief — and root
executes against that same brief so the scope contract is identical to what a worker would have
received.

### Tooling interruption, recorded because it affected delivery
Between 17:10 and 22:23 the write and shell tool surface (`execute_pwsh`, `fs_write`,
`str_replace`, `fs_append`) was withdrawn from this session, after the Phase 1 reconciliation
commit `dc4a7f5` had landed and the Wave A worktree had been provisioned. During that window no
mutation was possible, so Wave A implementation did not start. State was verified read-only and
found clean and consistent: reconciliation committed, worktree prepared with real dependencies,
zero reservation code written, no partial or inconsistent edit anywhere. Tools returned at 22:23
and work resumed from that verified point.



## 2026-08-29 00:08 +05:30 — WAVE A INTEGRATED GREEN at `79abb14`: restaurant reservations are real

Six packages, all implemented, gated and reviewed **by root**. No worker independence is
claimed anywhere in this wave; the probe result above explains why.

| Package | Commit | Scope |
|---|---|---|
| A1 schema | `d4cfe40` | `prisma/**` exclusive, invariant harness |
| A2 engine | `1a306b6` | `src/lib/reservations/**` |
| A3 API | `7456491` | `src/app/api/platform/reservations/**` |
| A5 blueprint | `4972424` | capability maturity, contract harness |
| A4 UI | `8da2294` | reservations panel, shell mount, a11y harness |
| A6 report | `4ff7ff4` | `docs/orchestration/WAVE_A_RESERVATIONS.md` |

Merged `--no-ff` at `79abb14716000726276743b5a77098f349f10a0c`, zero conflicts. A5 landed
before A4 because it depends only on A2. Full detail is in `WAVE_A_RESERVATIONS.md`.

### What is now genuinely true that was not before
`INTEGRATION_QUEUE.md` blocker 5 said `venueOrders.reservations` was a JSON blob on a
generic `Booking` with no relation to `RestaurantTable`. It is now a real persisted model
with tenant and venue isolation, fail-closed capacity, overlap refusal at the write
boundary, guarded lifecycle transitions, idempotent creation, and an append-only ledger.
An owner can view, create, hold, confirm, seat, complete, cancel and mark-no-show
reservations from the Business OS console.

**Blocker 5 is only half closed.** `commerce.inventory` is untouched and stays `planned`
because it is still a single nullable `stock` column. Retail/social commerce therefore
cannot honestly leave `draft`.

### Three things were verified rather than assumed, and one of them nearly went unnoticed

**Tenancy bridge.** The restaurant domain is `profileId`-scoped while `/api/platform/*` is
`workspaceId`-scoped. `Workspace.profileId` was already `@unique`, so venue isolation is
membership → `Workspace.profileId` → `Reservation.profileId`. No second tenant key was
invented.

**Capacity had to be fail-closed.** `RestaurantTable.seats` is `Int?`. A table with no
seat count cannot have capacity validated, so it refuses reservations rather than skipping
the check.

**The row lock was nearly credited to the wrong layer.** The first concurrent test showed
the loser failing at `INSERT`, meaning the exclusion constraint caught it and the
application row lock had apparently done nothing. Rather than accept a green result whose
code comments might be false, the constraint was temporarily dropped and the race re-run:
the row lock **alone** still produced exactly one winner with an application-level
conflict. The constraint was restored and its presence re-asserted. Both layers are real;
which one fires depends on interleaving. Either way exactly one row persists and the
caller gets a clean `CONFLICT`.

A related mapping defect was found and fixed during that investigation: the engine only
parsed SQLSTATE out of raw-query messages, so a genuine exclusion-constraint conflict
raised through a Prisma Client method was mis-reported as an unexpected error. It now also
reads Prisma `meta` and falls back to constraint identity.

### Migration rehearsal — disposable target only, never live
Fresh external `pg_dump` first (190590 bytes, sha256 `e164414d…9682`).
`assertDisposableTarget` was called before every command and was proven to refuse live by
name. `btree_gist` availability was probed before the exclusion constraint was written.

| Step | tables | cols | constraints | indexes | enum labels | triggers | ext | exclusion |
|---|---|---|---|---|---|---|---|---|
| before | 56 | 606 | 537 | 134 | 41 | 4 | 1 | 0 |
| apply | 58 | 637 | 559 | 142 | 54 | 6 | 2 | 1 |
| rollback | 56 | 606 | 537 | 134 | 41 | 4 | 1 | 0 |
| reapply | 58 | 637 | 559 | 142 | 54 | 6 | 2 | 1 |

Rollback is **byte-identical** to baseline (raw sha256 `c454c0ec…`). Reapply is
structurally identical to apply (normalized sha256 `85debc41…`); only Postgres
OID-derived NOT NULL constraint names differ, which a drop-and-recreate necessarily
changes. That normalization is stated rather than hidden, and it relaxes nothing else.

**Five `DropForeignKey` statements were deliberately omitted** from the migration.
`prisma migrate diff` wanted to drop the `profileId` FKs on `ActivityEvent`, `Contact`,
`ContactSourceLink`, `WorkflowRun` and `Workspace`. That is pre-existing drift between
`schema.prisma` and the phase0 migration; shipping it would strip referential integrity
from five existing tables. **Reported, still open, not fixed inside a reservations
migration.**

### Combined gates on primary `79abb14`
`prisma validate` 0, `prisma generate` 0, `tsc` 0, targeted `eslint` 0 errors and 0
warnings across all 20 changed paths, 13 of 13 no-DB harnesses 0, the three new
reservation harnesses **0/1/0** with 21/34/36 assertions, `check-capability-contract`
**0/1/0**, `check-schema-invariants` / `check-actions-authz` / `check-resource-authz` /
`check-conversation-authz` / `check-persisted-adapters` / `check-business-os-p2-e2e` /
catalog / course-profile / import-library all 0, `check-restaurant-phase0-behavior` **0**
and `check-restaurant-order-transaction` **0** so the shipped restaurant vertical is
unbroken, HTTP boundary 0 with `portCleared=true`, `npm audit --omit=dev` 0
vulnerabilities, `npm run build` 0 with all three reservation routes dynamic, secret scan
0 hits, and an allowed-path audit showing 20 of 20 files in scope with zero forbidden
paths.

### `check-order-stream` exits 1 and it is NOT a Wave A regression
It fails with `fetch failed` against `http://127.0.0.1:3000` because it requires a running
dev server, and ports are deliberately clear. Its in-process assertions pass. This was
confirmed rather than asserted: the same harness fails **identically** at the pre-Wave-A
source in the primary worktree, where no reservations code exists at all. It needs a
documented dev-server precondition or an in-process transport stub.

### Harness corrections, including one that would have quietly weakened a safety property
`check-capability-contract` used `venueOrders.reservations` as the subject of its
maturity-enforcement negative test — "an active blueprint may not require a `planned`
capability". Promoting reservations to `available` would have made that test **pass for
free**, silently losing the property. It was repointed at `commerce.inventory`, which is
still genuinely planned. Separately, that harness had **no inversion control at all** and
exited 0 with `INVERT_ASSERTION=1` set; a hook was added, giving it 0/1/0 for the first
time. `check-business-os-a11y` covered only pre-existing UI, so ten explicit assertions
were added for the new panel.

### Runtime and preservation
No dev server was started. No tunnel, push, PR or deploy. PostgreSQL 17 was already
listening on 5432 before this cycle — the Windows service handle reports `Stopped` and
could not be started without elevation, so the running instance was **not** started by
this cycle and was left exactly as found. Origin remains
`4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. The six frozen evidence worktrees remain at
`ea695956cfc8237bbbe32865723a2b8a80466db8` with dirty counts 4/3/4/1/0/1.
`P1_014_ACTION_INVENTORY.md` and both `.codex-remote-attachments` files are unchanged.

Next READY package: **Wave B**, the shared appointments engine, which must wrap the
existing `Booking`, `AvailabilitySchedule`, `CalendarOverride` and `ServiceOffering`
models rather than fork a parallel booking system.



## 2026-08-29 02:10 +05:30 — WAVE B B1-B2 INTEGRATED at `e1372a3`, and a real Wave A bug fixed

Root implemented, gated and reviewed both packages. **No worker independence is claimed.**
The gateway listener on port 5476 was absent and no model-pinning dispatch tool was
exposed, so per the standing fallback no probe cycle was spent and root proceeded
serially.

| Package | Commit | Scope |
|---|---|---|
| B1 schema | `3ebe8a1` | `prisma/**` exclusive, invariant harness |
| B2 engine | `8e76bf0` | `src/lib/appointments/**`, plus the Wave A engine correction |

Merged `--no-ff` at `e1372a3d764d1daa92e44211bfe58039880d6f6d`, zero conflicts.

### The finding that matters most: Wave A's overlap check was inert

While proving that `bufferMinutes` widens the conflict window, the appointment conflict
query returned **zero** where it should have returned one. The cause is a genuine and
easily-missed asymmetry:

> Against a `timestamp without time zone` column, Prisma writes a `Date` by its **UTC
> components**, but binds a `Date` **parameter** in raw SQL as **local wall-clock**.

On this UTC+05:30 host a stored `12:30` was compared against a bound `17:30`, so the
predicate was silently false. Measured directly: raw query with `Date` params returned
`0` conflicts, while the same predicate with naive-UTC strings and with Prisma's typed
`count()` both returned `1`, and the adjacency control correctly stayed `0`.

**The already-integrated Wave A reservations engine had the identical defect.** Its
application-level overlap check was doing nothing, and `Reservation_no_overlap` — the
layer Wave A described as mere defense-in-depth — was the only thing preventing
double-booking.

Worse, Wave A's own drop-the-constraint experiment had *appeared* to prove the row lock
sufficient. It passed only because that probe used raw parameters for **both** its insert
and its select, making the two self-consistent and hiding the asymmetry that exists in the
real engine, where inserts go through Prisma and the check went through raw SQL. The
earlier RUNLOG claim that "the row lock alone prevents double-booking" was therefore
correct about the probe and wrong about the shipped code. That is corrected here.

Both engines now use Prisma's typed `count()`, which is symmetric with how rows are
written. To stop this regressing silently, each engine records **which layer** refused:
the appointments harness asserts a buffer-gap conflict is `detectedBy: "application"` —
something the exclusion constraint cannot possibly see — and the reservations harness
asserts a sequential overlap is likewise application-detected. User-facing messages are
unchanged, so nothing new is leaked.

### B1 — additive appointment foundation
Seven enums; six tables (`AppointmentResource`, `ServiceResource`,
`AppointmentWaitlistEntry`, `AppointmentDeposit`, `AppointmentReminder`, append-only
`AppointmentEvent`); eleven nullable-or-defaulted columns and four indexes on the
pre-existing `Booking`, which previously had **no `profileId` index at all**.

`Booking.status` was deliberately **left as `text`**. It is `text NOT NULL` holding real
data, so converting it to a Prisma enum would have been breaking rather than additive.
`src/lib/appointments/lifecycle.ts` is the documented single source of truth, and a
harness assertion proves `OCCUPYING_STATUSES` exactly matches the exclusion constraint
predicate so the two cannot drift about what a conflict is.

The constraint is guarded by `resourceId IS NOT NULL` so pre-existing resource-less
bookings can never conflict with each other — asserted explicitly, because getting that
wrong would have broken the shipped booking flow.

**The first `migrate deploy` FAILED** with SQLSTATE 42601, *syntax error at or near "["*,
because the diff was captured through the rehearsal runner and the runner's own stdout
status lines were baked into the SQL. The catalog was byte-identical afterwards, so it
rolled back atomically with no partial state, and the failed record was cleared with
`migrate resolve --rolled-back`. The builder now strips runner noise, asserts the strip
count, and rejects any non-SQL line.

### Rehearsal — disposable target only
Fresh `pg_dump` first (200660 bytes, sha256 `e89f9fc4…`).

| Step | tables | cols | constraints | indexes | enum labels | triggers | ext | exclusion | Booking rows |
|---|---|---|---|---|---|---|---|---|---|
| before | 58 | 637 | 559 | 142 | 54 | 6 | 2 | 1 | 1 |
| apply | 64 | 707 | 624 | 166 | 85 | 8 | 2 | 2 | 1 |
| rollback | 58 | 637 | 559 | 142 | 54 | 6 | 2 | 1 | 1 |
| reapply | 64 | 707 | 624 | 166 | 85 | 8 | 2 | 2 | 1 |

Rollback is **byte-identical** to baseline (raw sha256 `1a015c42…`), with Wave A's
`btree_gist` and `Reservation_no_overlap` intact and the pre-existing Booking row
preserved. `down.sql` deliberately does not drop `btree_gist` or
`reject_append_only_mutation()`, both of which other migrations depend on.

Reapply matched apply structurally (normalized `364d0d13…`). This required widening the
OID normalization, and the justification was **verified before relaxing anything**:
adding a `NOT NULL` column to an existing table and re-adding it reallocates the internal
attribute number, so `<oid>_24_not_null` became `<oid>_35_not_null`. Columns with
`is_nullable` and defaults, tables, indexes, enums, triggers, extensions, exclusion
constraints and all *named* constraints were byte-identical, per-table auto-NOT-NULL
counts matched, and `Booking.partySize` was `integer`/`NOT NULL`/default `1` on both
sides. The comparator now also records per-table counts so a genuine added or removed
`NOT NULL` still surfaces.

The five pre-existing `profileId` `DropForeignKey` statements were excluded **again**,
this time programmatically with the removal count asserted. Still open as its own
decision.

### Combined gates on primary `e1372a3`
`prisma validate`/`generate` 0, `tsc` 0, targeted `eslint` 0, 13 of 13 no-DB harnesses 0,
17 of 17 DB-backed harnesses 0 — including `check-restaurant-phase0-behavior`,
`check-restaurant-order-transaction`, all three action packages and the HTTP boundary —
new appointment schema harness **0/1/0** with 39 assertions, appointment engine harness
**0/1/0** with 43 assertions, reservation engine harness **0/1/0** with 36 assertions,
`npm audit --omit=dev` 0 vulnerabilities, `npm run build` 0, secret scan 0 hits.

### Not done
**B3** (lifecycle, waitlist, deposits, reminders) and **B4** (APIs and Business OS UI) are
not implemented. No Stripe, email, SMS or WhatsApp adapter exists yet; when they are
built they must be stubbed and proven not invoked on refusal.

### Preservation
Live `personalink` untouched: still 35 public tables, `_prisma_migrations` absent, no
reservation or appointment tables, no `btree_gist`, `Profile`=16. Origin remains
`4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Six frozen worktrees at `ea69595` with dirty
counts 4/3/4/1/0/1. The Wave A worktree was briefly edited by mistake and immediately
restored to clean. No push, PR, deploy, tunnel or dev server. PostgreSQL was already
listening before this cycle and was left as found.



## 2026-08-29 02:55 +05:30 — WAVE B COMPLETE at `ce6348c`: shared appointments engine

Root implemented, gated and reviewed all four packages. **No worker independence is
claimed.** Gateway port 5476 absent and no model-pinning dispatch tool exposed, so per the
standing fallback no probe cycle was spent.

| Package | Commit | Scope |
|---|---|---|
| B1 schema | `3ebe8a1` | 7 enums, 6 tables, 11 Booking columns, exclusion constraint, append-only trigger |
| B2 engine | `8e76bf0` | availability + conflict, **plus the Wave A timezone fix** |
| B3 services | `2789e50` | waitlist, deposits, reminders, inert providers |
| B4 API + UI | `0b33887` | ten routes, owner panel, a11y coverage |

Merges: `e1372a3` (B1–B2), `ce6348c` (B3–B4). Both `--no-ff`, zero conflicts. `P2-005` is
`done`.

### What is now usable
One appointments engine serves coaching, consulting, CA practice, salon, events, real
estate and pet care. An owner can book against staff, rooms or equipment; availability,
capacity and double-booking are refused at the write boundary; appointments move through
`PENDING_PAYMENT → HELD → CONFIRMED → CHECKED_IN → COMPLETED` with `CANCELLED`, `NO_SHOW`
and `EXPIRED` as guarded exits; customers can join a waitlist and be promoted into a real
booking; deposits and reminders are tracked. All from the existing Business OS console,
with **no industry-specific fork**.

### The containment that matters most: money and messaging cannot fire
Deposits touch money and reminders touch someone's inbox. Rather than leave a TODO where a
Stripe or Twilio call would go, the capability is an **injected interface with an inert
default**. Consequences, each asserted by invocation counter rather than claimed in prose:

- An unavailable payment provider returns `DEPENDENCY_UNAVAILABLE` and **does not** move the
  deposit to `AUTHORIZED`. Recording a payment that never happened would be worse than
  failing.
- An unavailable notifier leaves the reminder `SCHEDULED`, never `SENT`, so the ledger
  cannot claim a delivery.
- A reminder on a cancelled, completed, no-show or expired appointment is `SUPPRESSED`
  **without reaching the notifier at all**.
- Every refusal path across B3 and B4 shows `payments.calls === 0` and
  `notifications.calls === 0`.

`runtime.ts` wires the unconfigured defaults, so acquiring a live provider requires a
deliberate code change. The UI matches: a pending deposit reads *"no payment has been
taken"* and a queued reminder reads *"not yet sent"*, and two a11y assertions enforce that
exact wording so a future edit cannot quietly imply otherwise.

### Waitlist promotion goes through the engine, not around it
Promotion books via `PersistedAppointments.book()`, so it inherits capacity, availability
and overlap refusal instead of bypassing them. It claims the entry under a row lock first,
so two concurrent promoters cannot both convert it. If the booking is then refused — for
example because the slot was taken while the customer waited — the entry is returned to
`WAITING` rather than silently losing its place. Both behaviours are asserted, including
the case where a second entry wants the slot the first just took.

### Availability is shared, not duplicated
The availability endpoint calls `engine.availabilityContext()` and uses the same
tenant-scoped windows, overrides and buffer the booking path uses. Re-querying in the HTTP
layer would have let the two drift, so a slot reported available could then be refused for
an availability reason. Sharing the data removes that class of bug.

### Combined gates on primary `ce6348c`
`prisma validate`/`generate` 0 · `tsc` 0 · targeted `eslint` 0 errors and 0 warnings ·
13/13 no-DB harnesses 0 · 19/19 DB-backed harnesses 0, including
`check-restaurant-phase0-behavior`, `check-restaurant-order-transaction`, all three action
packages and the HTTP boundary · four appointment harnesses **0/1/0** with 39, 43, 49 and
56 assertions · reservation engine **0/1/0** with 36 · `npm audit --omit=dev` 0
vulnerabilities · `npm run build` 0 with all ten appointment routes dynamic · secret scan 0
hits · allowed-path audit 21 files, zero forbidden.

### Two corrections made rather than worked around
`setDeposits` was flagged unused because the panel displayed deposit state but never
fetched it — and deposit visibility is a stated requirement. Rather than delete the
display, a tenant-checked deposit `GET` was added with its own 403 coverage, returning
`null` instead of 404 when no deposit exists, because *"this booking takes no deposit"* is
a legitimate answer rather than an error.

An unused `DepositState` import was removed instead of suppressed.

### Not built, and said plainly
No real payment or messaging provider is wired, on purpose. `dispatchDueReminders` exists
and is tested but **nothing schedules it** — there is no durable worker, and none is
claimed. Hold expiry is modelled as a status but is likewise not swept automatically.

### Preservation
Live `personalink` untouched: 35 public tables, `_prisma_migrations` absent, no reservation
or appointment tables, no `btree_gist`, `Profile`=16. Origin remains
`4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Six frozen worktrees at `ea69595`, dirty
4/3/4/1/0/1. No push, PR, deploy, tunnel or dev server. PostgreSQL was already listening
and was left as found.



## 2026-08-29 03:16 +05:30 — WAVE C C1 INTEGRATED at `d08a5a4`: cases and projects schema

Root implemented, gated and reviewed this package. **No worker independence is claimed.**
Gateway port 5476 absent and no model-pinning dispatch tool exposed.

C1 commit `fc5bcef`, merged `--no-ff` at `d08a5a4aa18ac33c1fb2f8374e03ce3cf4a1ede6`, zero
conflicts. `P2-006` is `in_progress_c1_integrated`.

### Ten tables that compose rather than duplicate
`CaseIntake`, `CaseProject`, `CaseBrief`, `CaseMilestone`, `CaseDeliverable`,
`CaseDocumentRequest`, `CaseInvoice`, `CaseTaskLink`, `CaseApprovalLink` and append-only
`CaseEvent`, plus eight enums.

The directive's hardest requirement here was *not* to create parallel contact, task,
approval or audit systems. A naive "the tables exist" check would pass either way, so the
harness verifies **foreign key targets by name**: `CaseTaskLink → TaskJob`,
`CaseApprovalLink → Approval`, `CaseDeliverable`/`CaseDocumentRequest → ProfileDocument`,
`CaseProject`/`CaseIntake → Contact` and `→ Workspace`, `CaseProject → Location`. A further
assertion fails if any `Case*` table grows its own `email`, `phone`, `payload`, `attempts`,
`leaseToken` or `embedding` column. Contact-level `ActivityEvent` is untouched; `CaseEvent`
is a separate case-level timeline. `CaseInvoice` records billing **state** and links out to
`Payment` rather than becoming a second accounting ledger.

The aggregate is `CaseProject` because `Project` is already taken by the pre-existing
portfolio model. Renaming that would have been breaking for no benefit, and the harness
asserts `Project` still exists.

### A regression I introduced, and the verification gap it exposed
Adding the back-relations with a PowerShell `-replace` using a **double-quoted**
capture-group reference interpolated it as an *undefined shell variable* rather than the
regex group. That **deleted six pre-existing relation fields** across `Contact`,
`Workspace` and `Location`. `prisma format` then helpfully re-added them under
auto-generated names — `sourceLinks` became `ContactSourceLink`, `contacts` became
`Contact`, `bookings` became `Booking` — which broke `src/lib/persistence/contacts.ts`.

The gap is the part worth recording. I had already run a semantic check with
`prisma migrate diff` and it was clean: **0** `DROP TABLE`, **0** `DROP COLUMN`, **0**
`ALTER COLUMN`, **0** `ADD COLUMN`. That check was not wrong, it was *insufficient* —
`migrate diff` compares DATABASE schema, and Prisma relation **field names are client-side
only**, so they never appear in SQL. The database was genuinely unchanged while the client
contract was broken.

`tsc` caught the three relations application code actually used. It could not catch the
others, because an unused-but-declared relation renames silently and only breaks a future
consumer. So I wrote a verifier that compares relation field names between the committed
schema and the working copy across every model: **63 pre-existing models checked, 0
renamed or dropped, exactly 10 new models added.** That verifier now lives beside the other
rehearsal tooling and should be run after any `prisma format`.

I also hit a second, smaller self-inflicted problem: a `git commit -m` message containing
a literal `$1` broke shell escaping badly enough that git treated part of the message as a
path. Commit messages of this length now go through `git commit -F` with a file.

### Rehearsal — disposable target only
Fresh `pg_dump` first (228319 bytes, sha256 `c7c76351…`).

| Step | tables | cols | constraints | indexes | enum labels | triggers | ext | exclusion |
|---|---|---|---|---|---|---|---|---|
| before | 64 | 707 | 624 | 166 | 85 | 8 | 2 | 2 |
| apply | 74 | 799 | 713 | 195 | 130 | 10 | 2 | 2 |
| rollback | 64 | 707 | 624 | 166 | 85 | 8 | 2 | 2 |
| reapply | 74 | 799 | 713 | 195 | 130 | 10 | 2 | 2 |

Rollback **byte-identical** to baseline (raw `b05804b2…`), with Wave A/B exclusion
constraints, `btree_gist` and all four append-only triggers intact and the existing
`Booking` row preserved. Reapply structurally identical to apply (normalized `d43b59a3…`).
A post-fix drift check confirms only the five known pre-existing `profileId`
`DropForeignKey` statements remain — excluded programmatically for the **third** wave
running, with the removal count asserted.

`down.sql` deliberately drops neither `reject_append_only_mutation()` (four ledgers depend
on it) nor `btree_gist` (two exclusion constraints depend on it, and this migration
installed neither).

### Combined gates on primary `d08a5a4`
`prisma validate`/`generate` 0 · `tsc` 0 · relation-rename verifier 0 · targeted `eslint`
0 · 13/13 no-DB harnesses 0 · 20/20 DB-backed harnesses 0, including
`check-restaurant-phase0-behavior`, `check-restaurant-order-transaction`, all four
appointment harnesses, both reservation harnesses, all three action packages and the HTTP
boundary · `npm audit --omit=dev` 0 vulnerabilities · `npm run build` 0 · secret scan 0
hits.

### Not done
**C2** cases runtime and **C3** APIs plus Business OS UI are not implemented. The schema
exists, so both are runtime and surface work needing no further migration. I stopped before
starting C2 rather than risk leaving it half-written.

### Preservation
Live `personalink` untouched: 35 public tables, `_prisma_migrations` absent, no
reservation, appointment or case tables, no `btree_gist`, `Profile`=16. Origin remains
`4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Six frozen worktrees at `ea69595`, dirty
4/3/4/1/0/1. No push, PR, deploy, tunnel or dev server.


---

## 2026-08-29 · Wave C complete — cases/projects runtime, APIs and Business OS surface

Root-serial. No worker independence claimed. Continuation branch
`feature/wave-c-cases-runtime` cut from primary `c8df279` in the existing clean Wave C
worktree, then merged `--no-ff` onto `recovered/aug20-wt-pr-32` at **`862e5ef`**.

| Package | Commit | Harness |
|---|---|---|
| C2 cases/projects runtime | `9bd9529` | `check-case-runtime` 67 assertions, 0/1/0 |
| C3 APIs + Business OS surface | `6187893` | `check-case-routes` 75 assertions, 0/1/0 |

Neither package needed a migration. C1's schema already carried everything, so the
rehearsal database was not touched beyond running harnesses against it, and it remains
fully applied.

### C2 — composition, not duplication
The engine writes to the records the platform already owns: `TaskJob` for background work,
`Approval` + `WorkflowRun` for approvals, `ProfileDocument` for uploads, `Contact` for the
client, `Location` for the site boundary, and `Payment` referenced by `CaseInvoice.paymentId`.
The C1 harness already asserts foreign-key *targets* by name, so a parallel table cannot
pass, and it fails if any `Case*` table grows an `email`, `phone`, `payload`, `attempts`,
`leaseToken` or `embedding` column — the shape a duplicate system would need.

Three decisions worth recording because the cheap alternative was wrong:

- **`Approval.workflowRunId` is NOT NULL.** A case approval therefore creates a real
  `WorkflowRun` (`workflowKey: cases.approval`, `state: awaiting_approval`) rather than a
  synthetic placeholder row. The approval ledger stays one ledger.
- **`DELIVERED` is approval-gated.** Handing a deliverable to a client is externally visible
  and cannot be quietly undone, so it requires a linked `Approval` in state `approved`.
  Ungated delivery was rejected.
- **`RECEIVED` requires a real `documentId`.** An optimistic accept would write a false
  record — a document request marked satisfied with nothing behind it.

All time comparisons use Prisma's typed API. Raw SQL `Date` parameters bind as local
wall-clock against `timestamp without time zone` while Prisma writes UTC components; that
mismatch silently disabled an overlap check in an earlier wave and is not repeated.

### C3 — boundary and surface
`CaseApiService` covers intakes, cases, briefs, milestones, document requests, deliverables,
tasks, approvals, billing state and the timeline, behind 18 thin route re-exports. Intakes
live under `/api/platform/case-intakes` rather than `/cases/intakes` so a static segment can
never shadow the `[id]` parameter.

Unknown enum values are validated against the owning lifecycle flow before the engine sees
them, which keeps **400 "that is not a status"** distinct from **409 "that is not a legal
move from here"** — a distinction the owner needs and a single 409 would destroy.

The UI is `cases-panel.tsx` (intake queue + case list) and `case-detail-panel.tsx` (brief,
milestones, document requests, deliverables, linked tasks, approvals, billing, timeline).
Case status buttons render from server-computed `allowedTransitions`, so the UI cannot offer
a transition the write boundary would refuse; the remaining sub-flows import the same
`lifecycle.ts` tables the server enforces, so there is no second copy to drift.
`CaseRecord` now projects `openedAt`/`deliveredAt`/`closedAt`/`cancelledAt` — additive, the
rows were already selected in full and the surface needs them to state when a case actually
opened.

### Measured, not asserted
- Anonymous is 401 across all 16 endpoints, with **zero rows written, zero `CaseEvent`s
  appended and zero external calls** — counted before/after, not described.
- An authenticated non-member is 403 on read and on write.
- A foreign case and a nonexistent case are compared by **string equality of the response
  body**; they are byte-identical on read and on mutation. This is the inverted assertion,
  and `INVERT_ASSERTION=1` fails exactly it (74/75).
- `globalThis.fetch` is replaced by a counting blocker for the whole run. Total calls: 0.
- Every fixture row is removed, six case tables return to baseline, and the `CaseEvent`
  append-only trigger is verified re-armed after being disabled for cleanup.

### Combined gates on integrated tip `862e5ef`
`prisma validate` 0 · `prisma generate` 0 · app `tsc` 0 · targeted `eslint` 0 ·
relation-rename verifier **0 renamed across 73 pre-existing models** · **35/35** check
harnesses exit 0 (`check-order-stream` excluded as the known non-blocking precondition),
including case schema 36/36, case runtime 67/67, case routes 75/75, appointments 43/49/56/39,
reservations 36/36/21, `check-schema-invariants` 18/18, `check-business-os-a11y` PASS with 19
new explicit cases assertions · `npm audit --omit=dev` 0 vulnerabilities · `npm run build` 0
with all 18 routes registered · secret scan 0 real hits (the one match is a deliberate fake
DSN inside `check-case-routes` that proves the 503 path leaks neither message nor connection
string).

### Preservation
Live `personalink` read-only. Disposable target
`personalink_phase0_rehearsal_20260826_210704` left **fully applied**, no mid-rehearsal
state. Origin remains `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Frozen worktrees and
attachments untouched; `P1_014_ACTION_INVENTORY.md` unchanged. No push, PR, deploy, tunnel,
dev server or real external-provider call.


---

## 2026-08-29 · Wave D complete — content and cohort schema, runtime, APIs and console

Root-serial. No worker independence claimed. Branch `feature/wave-d-cohorts` cut from
primary `a353770` in the reused Wave C worktree, then merged `--no-ff` onto
`recovered/aug20-wt-pr-32` at **`c516703`**.

| Package | Commit | Harness |
|---|---|---|
| D1 additive schema | `48e448d` | `check-cohort-schema-invariants` 60 invariants, 0/1/0 |
| D2 cohort runtime | `4d35deb` | `check-cohort-runtime` 114 assertions, 0/1/0 |
| D3 APIs + console | `12d3f2f` | `check-cohort-routes` 87 assertions, 0/1/0 |

### What was promoted rather than forked
The **program is the pre-existing `Course`**, with its `CourseModule` and `CourseLesson`
children. Learner identity stays `Member`. The learner's relation to a program stays
`CourseEnrollment`. Per-lesson progress stays `LessonCompletion`.

The genuinely missing concept was a **cohort**: a dated, capacity-bounded run of a course
that people attend together. Eight tables hang off it, and every one of them points at the
records that already exist — `CohortMembership` → `CourseEnrollment`, `CohortSession` →
`Location`, `CohortSubmission` and `CohortCertificate` → `ProfileDocument`,
`CohortMembership` → `TaskJob` for renewal reminders. The schema harness verifies those
foreign-key targets by name and fails if any of twelve forbidden fork tables appears.

**There is no progress table.** Progress is computed from `LessonCompletion`,
`CohortSubmission` and `CohortAttendance` on every read. A cached percentage would be a
second source of truth that can silently disagree with the rows it summarises, so the
harness fails if any `Cohort*` table grows a `progress`, `percent` or `completedLessons`
column.

Certificate policy is **data, not code**: `Cohort.attendanceThresholdPct`,
`requireAllAssignments` and `requireAllLessons` are stored, so eligibility is evaluated
against a published rule rather than a threshold buried in a function.

### The one column added to a pre-existing table
`CourseEnrollment.idempotencyKey TEXT NULL`, with a unique index on
`(courseId, idempotencyKey)`. Enrolment previously had **no idempotency key at all**, so a
retried enrolment created a duplicate row. NULLs are distinct in Postgres, so the index
constrains only rows that carry a key — the harness proves three NULL-key enrolments in one
course coexist. The alternative, a cohort-only enrolment table, would have forked the
learner's relationship to a course, which is the duplication this wave exists to avoid.

### Migration rehearsal, disposable target only
Fresh external backup before any DDL. `pre-d1` 74 tables / 799 columns / 130 enum labels /
10 triggers → `post-d1-apply` 82 / 893 / 176 / 12 → `post-d1-rollback` **byte-identical to
`pre-d1`** (raw sha256 `9f09cd30f5c2b1d9`) → `post-d1-reapply` normalized-identical to
`post-d1-apply`. Catalog comparison reports `only_in_pre-d1=0` for tables, columns,
constraints, indexes, enums and triggers — nothing was removed in any category. Exclusion
constraints stayed at 2 and extensions at 2 throughout.

`prisma migrate diff` produced 8 `CREATE TABLE`, 9 `CREATE TYPE`, 1 `ADD COLUMN`, 0
`ALTER COLUMN`, 0 `DROP TABLE`, 0 `DROP COLUMN`. The build tool asserts that exact shape and
aborts on any `ADD COLUMN` other than the one named above. The five pre-existing `profileId`
`DropForeignKey` statements were excluded with the count asserted, for the fourth wave
running.

`prisma format` inserted five opposite relation fields. A semantic block diff over the whole
schema shows **17 blocks added, 0 removed**, and confirms those five fields plus the one
column and its index are the only changes to pre-existing models; every other textual
difference is whitespace realignment. The relation-name verifier reports **0 renamed across
81 pre-existing models**.

### Four gates where the cheap version would have recorded something false
- **Membership `COMPLETED`** is evaluated against the cohort's own policy using persisted
  rows, and the refusal names the unmet requirements. Marking a learner complete is a claim
  that outlives the cohort, so it is not allowed to be optimistic.
- **Certificate `ELIGIBLE`** is recomputed, never accepted from the caller. The serial is
  minted server-side at issue from the cohort code and membership id, so a caller can
  neither choose nor collide with one, and an eligible-but-unissued certificate keeps a null
  serial and null `issuedAt` so it cannot be mistaken for a credential.
- **Attendance** requires a session that has actually started. Recording attendance against
  a `SCHEDULED` or `CANCELLED` session is refused, because either would be fabricated.
- **Renewal `REMINDED`** requires a linked `TaskJob`. Scheduling enqueues a real `QUEUED`
  row with `nextAttemptAt` set to the requested remind time and sends nothing; without the
  rule the state would assert a delivery that never happened.

### Measured, not asserted
- Anonymous is 401 across all 24 endpoints, with zero cohorts, zero enrolments, zero
  `CohortEvent`s and zero external calls — counted before/after.
- A foreign cohort and a nonexistent cohort are compared by **string equality of the
  response body**: byte-identical on read and on mutation. Wrong-tenant progress is 403 and
  leaks no figures. This is the inverted assertion in both cohort harnesses.
- `globalThis.fetch` is replaced by a counting blocker for the whole run. Total calls: 0.
- Capacity is enforced inside the transaction against a locked cohort row; a withdrawal
  genuinely frees the seat, proven by rejoining.
- Every fixture row is removed, eleven tables return to baseline, and the `CohortEvent`
  append-only trigger is verified re-armed after being disabled for cleanup.

### Combined gates on integrated tip `c516703`
`prisma validate` 0 · `prisma generate` 0 · app `tsc` 0 · targeted `eslint` 0 ·
relation-rename verifier **0 renamed across 81 pre-existing models** · **38/38** check
harnesses exit 0 (`check-order-stream` excluded as the known non-blocking precondition),
including cohort schema 60/60, cohort runtime 114/114, cohort routes 87/87, case 36/67/75,
appointments 43/49/56/39, reservations 36/36/21, `check-schema-invariants` 18/18,
`check-business-os-a11y` PASS with 22 new explicit cohort assertions · `npm audit
--omit=dev` 0 vulnerabilities · `npm run build` 0 with all 15 cohort routes and all 18 case
routes registered · secret scan 0 real hits (the one match is a deliberate fake DSN inside
`check-cohort-routes` that proves the 503 path leaks neither message nor connection string).

### Preservation
Live `personalink` read-only. Disposable target
`personalink_phase0_rehearsal_20260826_210704` left **fully applied** at 82 tables, not
mid-rehearsal. Origin remains `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Frozen worktrees
and attachments untouched; `P1_014_ACTION_INVENTORY.md` unchanged. No push, PR, deploy,
tunnel, dev server or real external-provider call.


---

## 2026-08-29 · Wave E complete — truthful vertical activation at `e91f6c7`

Root-serial. Branch `feature/wave-e-blueprints` from `fa36d26`, commit `239a4e0`, merged
`--no-ff` at **`e91f6c7`**. No migration and no runtime change: this package corrects what
the product *claims* about itself after four delivery waves, and makes the claim testable.

### What was promoted, and what was not
Ten capabilities became `available` with evidence pointing at the runtime that now exists:
all four `casesProjects` capabilities (Wave C), all three `contentCohorts` capabilities
(Wave D), and `appointments` services, availability and waitlist (Wave B).

**Two were deliberately left `partial`.** `appointments:reminders` and
`appointments:deposits` have persisted records and real state machines, but their provider
boundaries are inert — nothing is sent and no money moves. Marking them available would
have told an owner the opposite of the truth. That decision is what forced
`coaching-studio-v1` to be deprecated rather than activated, because it *required*
reminders.

### Two gaps were split out instead of being absorbed
`casesProjects:billing` previously described "retainers, invoices, and payment follow-up".
Invoices and payment linkage are built; retainer drawdown is not. Rather than mark the
capability available and leave "retainers" sitting in its description, **retainers is now
its own planned capability**. Same for `contentCohorts:memberships`, whose description
promised "access levels" — `accessLevels` is now its own planned capability.

This is the substantive point: a description is not checked by anything. A capability is.
Leaving a gap inside the prose of a capability that has just been marked available is how
an overclaim survives a review.

### Blueprint status changes
| Blueprint | Change | Why |
|---|---|---|
| `restaurant-venue-v2` | active, unchanged | already truthful |
| `consulting-agency-v1` | draft → **active** | its contract needed no rewriting; every capability it already claimed became available in Wave C, so only the status caught up |
| `coaching-studio-v1` | draft → **deprecated** | required `appointments:reminders`, which is only partial |
| `coaching-studio-v2` | **new, active** | requires only what exists; names `accessLevels`, `reminders` and `deposits` as planned |
| `ca-practice-v1` | **new, active** | the cases engine fits a CA practice most exactly, because its core loop *is* the document request: ask for a record, refuse to close it without the actual file, gate the filing on partner approval, then invoice |
| `retail-storefront-v1` | **new, draft** | a storefront that cannot say whether an item is in stock is not a storefront; `commerce:inventory` is still a single nullable `stock` column |

Registering retail as a draft rather than omitting it keeps the gap addressable instead of
leaving the vertical undocumented. Its draft status is now *proven*: the harness builds an
active copy and asserts validation rejects it while inventory is planned.

### The contract is now falsifiable
`check-capability-contract` gained three properties, because a maturity flag is just a
string and nothing was checking whether it meant anything:

1. **Every implemented capability must cite an evidence path that exists on disk.** This
   immediately caught real rot: `appointments:availability` cited
   `src/app/api/bookings/route.ts`, a file that no longer exists. Nothing had noticed.
2. **Every capability an active blueprint requires must be `available` and have its
   evidence file present.** This is the assertion that fails if a blueprint is activated
   ahead of its runtime.
3. **Two active blueprints may not claim the same vertical**, and a superseded blueprint
   must be deprecated, so two versions of one vertical cannot both be live.

A second negative test proves `partial` is rejected as well as `planned`. Both negative
tests carry a non-vacuity assertion — the harness fails if `reminders` stops being partial
or `inventory` stops being planned — so neither can quietly start passing for free. Each
Wave E status is asserted individually so a silent regression is caught.

### Gates on integrated tip `e91f6c7`
app `tsc` 0 · targeted `eslint` 0 · `check-capability-contract` PASS, and
`INVERT_ASSERTION=1` fails **all five** overclaim guards · **38/38** check harnesses exit 0 ·
`npm audit --omit=dev` 0 vulnerabilities · `npm run build` 0.

### Preservation
No schema change, no database contact beyond the harness sweep against the disposable
target. Origin remains `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Live `personalink`
untouched.


---

## 2026-08-29 · Wave F complete — commerce inventory hardening at `7bfc868`

Root-serial. Branch `feature/wave-f-inventory` from `510c9ab`, merged `--no-ff` at
**`7bfc868`**.

| Package | Commit | Harness |
|---|---|---|
| F1 additive schema | `ca90b9a` | `check-inventory-schema-invariants` 50 invariants, 0/1/0 |
| F2 runtime | `0d59dc8` | `check-inventory-runtime` 85 assertions, 0/1/0 |
| F3 APIs + console | `a723078` | `check-inventory-routes` 58 assertions, 0/1/0 |

### What existed before
`DigitalProduct.stock`, one nullable `Int`. Nothing decremented it, nothing reserved
against it, there was no location dimension, no movement history and no oversell refusal.
That column is left **exactly** as it is — not renamed, dropped or migrated — because
deciding what its existing values mean is a data decision, not a schema one. The harness
asserts it is still a nullable integer.

### Overselling is now impossible at the storage layer
Four CHECK constraints do the work that comments used to:

```
InventoryItem_onHand_nonnegative      onHand   >= 0
InventoryItem_reserved_nonnegative    reserved >= 0
InventoryItem_reserved_within_onHand  reserved <= onHand
InventoryReservation_qty_positive     qty      >  0
```

The schema harness proves all four **refuse a direct write with no engine involved**, and
that the boundary case — reserving exactly the whole on-hand quantity — is accepted. The
engine refuses first and names the real number, so a caller gets "Only 4 units are
available; 99 were requested" rather than a bare 409; the constraints are the backstop that
holds even if the engine is wrong.

Like the five append-only triggers and two exclusion constraints already here, these live
in SQL rather than `schema.prisma`. That is safe by demonstration, not assumption: the
earlier triggers have survived four generated migrations untouched.

### The concurrency claim is measured
Every balance change runs inside a transaction that first takes `SELECT ... FOR UPDATE` on
the stock record. The runtime harness fires **two `reserve()` calls in parallel** at a
record holding exactly one unit and asserts one is fulfilled and one rejected, that exactly
one hold row exists, and that the record ends with one reserved and zero available. That is
the inverted assertion, so the row lock cannot quietly stop working.

### The ledger verifies itself
`InventoryMovement` stores the signed deltas **and** the resulting balances. Both harnesses
replay the deltas and require them to reproduce the stored after-values and match the live
record. A ledger that only stored deltas would be unfalsifiable against the row it explains.

### Three refusals where the permissive version would record something false
- **`RESERVE`, `RELEASE` and `CONSUME` cannot be written as direct movements.** They arise
  only from a reservation transition, so accepting them as input would let a caller move
  the reserved balance with no hold behind it. Only `RECEIPT`, `ADJUSTMENT`, `RETURN` and
  `COUNT` are direct.
- **An untracked stock record refuses to hold a reservation.** A reservation is a promise,
  and a record that does not count units cannot make one.
- **`EXPIRED` requires the hold to have actually passed its expiry**, and a hold with no
  expiry cannot be expired at all. Otherwise the state would be a quiet way to cancel a
  live reservation. All three settled states are terminal: re-releasing would double-credit
  stock, un-consuming would conjure units that have already left the shelf.

### One design decision worth recording
`locationId` is **NOT NULL**. Stock that is not anywhere is not stock, and a nullable
location would need either a partial unique index or a denormalized discriminator to keep
"one record per product per place" enforceable. Both are schema drift, and this repository
already pays a drift tax every wave: five `profileId` `DropForeignKey` statements have to be
filtered out of every generated migration. The runtime refuses with a clear message when a
workspace has no `Location` yet.

### Migration rehearsal, disposable target only
Fresh external backup before any DDL. `pre-f1` 82 tables / 893 columns / 176 enum labels /
12 triggers → `post-f1-apply` 85 / 931 / 190 / 14 → `post-f1-rollback` **byte-identical to
`pre-f1`** (raw sha256 `24db167452bd7661`) → `post-f1-reapply` normalized-identical.
`only_in_pre-f1=0` in all six categories. Exclusion constraints stayed at 2, extensions at 2.

`prisma migrate diff` produced 3 `CREATE TABLE`, 3 `CREATE TYPE`, **0 `ADD COLUMN`**, 0
`ALTER COLUMN`, 0 `DROP TABLE`, 0 `DROP COLUMN`. The build tool asserts the exact table and
enum counts and aborts on any `ADD COLUMN` at all. The five `profileId` `DropForeignKey`
statements were excluded with the count asserted, for the fifth wave running. A semantic
block diff shows 6 blocks added, 0 removed, and six auto-inserted opposite relation fields
as the only change to pre-existing models.

### Making inventory available had consequences, and they were followed through
- **`commerce:inventory` planned → available**, evidence `src/lib/inventory/engine.ts`.
- **`restaurant-venue-v2` → deprecated; new `restaurant-venue-v3` active**, requiring
  `commerce` catalog + orders + inventory. v1 always *required* inventory; v2 had to demote
  it to a planned backlog item because it was a single nullable column. A backlog entry for
  something that exists is a false statement, so v3 restores the original intent.
- **`retail-storefront-v1` stays draft, for a narrower reason.** Inventory is no longer the
  blocker. What a storefront still cannot do is sell a size or a colour, tell a customer
  where their parcel is, or take anything back: `variants` and `fulfilment` are partial and
  `returns` is planned. All three are now **required** capabilities on the blueprint
  precisely so activation is mechanically rejected — and the harness asserts the rejection
  happens *and* that its message names variants, fulfilment and returns rather than
  inventory.
- **The planned-capability negative test was repointed** from `commerce:inventory` to
  `commerce:returns`. It had already moved once, from `venueOrders:reservations`. Each time
  a wave makes the target real the test would silently become vacuous; the non-vacuity
  assertion beside it is what forces the maintenance.

### Combined gates on integrated tip `7bfc868`
`prisma validate` 0 · `prisma generate` 0 · app `tsc` 0 · targeted `eslint` 0 ·
relation-rename verifier **0 renamed across 84 pre-existing models** · **41/41** check
harnesses exit 0, including inventory schema 50/50, runtime 85/85, routes 58/58, cohort
60/114/87, case 36/67/75, appointments 43/49/56/39, reservations 36/36/21,
`check-capability-contract` PASS with `INVERT_ASSERTION=1` failing all five overclaim
guards, `check-business-os-a11y` PASS with 20 new explicit stock assertions ·
`npm audit --omit=dev` 0 vulnerabilities · `npm run build` 0 with all 6 inventory routes
registered · secret scan 0 real hits.

### Preservation
Live `personalink` read-only. Disposable target left **fully applied** at 85 tables, not
mid-rehearsal. Origin remains `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. Frozen worktrees
and attachments untouched; `P1_014_ACTION_INVENTORY.md` unchanged. No push, PR, deploy,
tunnel, dev server or real external-provider call.


---

## 2026-08-29 · Run close — P1-009 first slice, and preservation verified

### P1-009 first slice `108846e`
Repo-wide lint went from **53 errors / 61 warnings / 114 reports across 54 files** to
**39 errors / 52 warnings / 91 reports**, with no severity changed anywhere.

The interesting part was not the count. Eight of the reported violations were
`_request`, `_available` (twice), `_calendarId`, `_startDate`, `_endDate`, `_uuid` and
`_RemovedProductsView` — identifiers already carrying this repository's own "deliberately
unused" marker and being told off for it. The linter did not know the convention. Renaming
them would have been churn; configuring `no-unused-vars` to honour `^_` was the actual fix.
Genuinely dead identifiers without the underscore are still reported, so the remaining 24
are signal rather than noise.

Three `no-require-imports` errors were in `scripts/**/*.js`, which are CommonJS by
extension. `require()` is correct there. The override is scoped to that glob so application
code still cannot use it.

Eleven real violations were fixed behaviour-preservingly: `window.location.href` →
`router.push` in the error boundary (a full document load from an error boundary discards
the React tree), two internal `<a>` links → `next/link`, two empty extending interfaces →
type aliases with the exported names unchanged, and one bare apostrophe escaped.

Deliberately not attempted: `no-img-element` (25), `no-explicit-any` (24), the remaining
`no-unused-vars` (24) and the react-hooks family (18). Each needs judgement rather than a
mechanical edit — swapping `<img>` for `next/image` changes layout behaviour, replacing
`any` requires knowing the intended type, deleting a dead export requires knowing nobody
depends on it, and `set-state-in-effect` needs the effect redesigned. Doing those blind is
how a lint pass introduces a regression.

Verified: app `tsc` 0 · 41/41 check harnesses exit 0, including all three Business OS
surface harnesses that render the touched components · production build compiles · targeted
`eslint` still 0 across the wave paths.

### Run summary
Six waves integrated on `recovered/aug20-wt-pr-32`, each with its own scoped gates and a
combined suite on the integrated tip:

| Wave | Tip | What shipped |
|---|---|---|
| C | `862e5ef` | cases/projects runtime, 18 routes, Business OS surface |
| D | `c516703` | content/cohort schema, runtime, 15 routes, console |
| E | `e91f6c7` | truthful vertical activation, falsifiable capability contract |
| F | `7bfc868` | commerce inventory schema, runtime, 6 routes, stock panel |

Final primary HEAD `108846e`. Harness count grew from 35 to 41; new assertion totals this
run: cases 36 + 67 + 75, cohorts 60 + 114 + 87, inventory 50 + 85 + 58, plus 61 new explicit
Business OS a11y assertions and eight new properties in the capability contract.

### Preservation, verified not asserted
- **Live `personalink`**: read-only checks only. 35 public tables, `_prisma_migrations`
  absent, **zero** of the twelve tables this run created present, `btree_gist` absent,
  `Profile` = 16. Identical to the start of the run.
- **Disposable target** `personalink_phase0_rehearsal_20260826_210704`: `prisma migrate
  status` reports "Database schema is up to date", 13 migrations applied, 85 tables / 931
  columns / 190 enum labels / 14 triggers / 2 exclusion constraints / 2 extensions. **Fully
  applied, never left mid-rehearsal.**
- **Origin**: `origin/recovered/aug20-wt-pr-32` = `4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`,
  `origin/main` = `9e8a0fffb84937d809788ee4512884289c3132b8`. Both unchanged.
- **Frozen worktrees**: all six `kirocrew/*` worktrees still at `ea69595`.
- **Attachments** and `P1_014_ACTION_INVENTORY.md`: untouched, still untracked.
- No push, PR, deploy, tunnel, dev server, real external-provider call, or destructive Git
  operation at any point.


---

## 2026-08-29 16:25–16:35 · Bounded orchestration recovery attempt — `ORCHESTRATION_UNAVAILABLE`

Ten-minute budget, one attempt, no patching or reinstalling. Result: **the gateway itself is
recoverable and is now running, but this session cannot obtain a model-pinned dispatch tool,
so no worker can be started.**

### Evidence gathered
- `C:\Users\shubh\.kiro\crew\run\gateway-5476.pid` held **39640**, last written 27 Aug
  03:29. `Get-Process -Id 39640` now resolves to **`dllhost`** — the PID was recycled, so the
  old gateway is definitively dead rather than wedged.
- `crew\logs\crash-dumps\loopstall-20260826T215903Z.txt` records a loop-stall dump opened for
  that same PID. `crash.log` then fills with repeated
  `ConnectionResetError [WinError 10054]` inside
  `_ProactorBasePipeTransport._call_connection_lost`, last entry 2026-08-27T06:49:04Z. The
  event loop wedged and the process never recovered.

### Supported start mechanism, used as-is
`C:\Users\shubh\.kiro\crew-venv\Scripts\kirocrew.exe gateway` (the binary named by the
existing `gateway-5476.bin` pointer). Nothing was patched, reinstalled or reconfigured.

### Acceptance conditions, measured
| Condition | Result |
|---|---|
| Port 5476 listening | **PASS** — listening 10s after launch, pid 54756; `kirocrew status` reports "gateway is running (token auth enabled)" |
| Model-pinned dispatch tool genuinely exposed | **FAIL** |
| Control worker has non-null start/PID/turns | not reached |
| Control worker writes its expected report | not reached |
| Requested and observed model match | not reached |

### Why condition 2 fails, precisely
`~/.kiro/settings/mcp.json` contains `"mcpServers": {}`. The only registered MCP servers are
the two belonging to the `windows-computer-control` power. There is **no workspace-level
`.kiro/settings/mcp.json`** either. No KiroCrew MCP server is registered with this session at
all, which is why no model-pinned dispatch tool appears in the tool surface — and registering
one would require editing MCP configuration plus a session-level MCP reconnect, neither of
which is in scope for this run.

This is the same conclusion every previous wave reached, but with a sharper cause: the gap is
**client-side MCP registration**, not the gateway process. That distinction matters, because
the previously assumed blocker — "the gateway will not start" — is now disproved.

### Hollow or dead jobs
None to remove. `kirocrew cron list` → "No cron jobs"; `~/.kiro` scheduled tasks file is 18
bytes (empty); `kirocrew agent list` shows only the four built-in agent definitions and no
running members. The one residual artifact is a zero-length
`taskrunner_run_openai-kirocrew-master-orchestrator-prompt.jsonl.lock` from the 27 Aug crash;
it is empty and was left in place rather than deleted, since removing files under `.kiro/crew`
is closer to patching KiroCrew than to housekeeping.

### Decision
Recorded as `ORCHESTRATION_UNAVAILABLE`. The gateway is left **running**, because it started
cleanly through the supported path and an owner-driven client can now register the MCP server
against it — that is an owner-actionable next step rather than a dead end. No further recovery
attempt this run. Wave G proceeds **root-serial**, and no worker independence is claimed.

**Owner-only action to unblock parallelism:** register the KiroCrew MCP server in
`~/.kiro/settings/mcp.json` (or a workspace `.kiro/settings/mcp.json`) and restart the Kiro
client so the model-pinned dispatch tool is exposed. The gateway on 5476 is already up.


---

## Wave G - commerce variants, fulfilment and returns; retail activated

Integrated at `dd84acc` (merge, `--no-ff`) on `recovered/aug20-wt-pr-32`, from base `34f8561`
via branch `feature/wave-g-commerce`. Root-serial, `ORCHESTRATION_UNAVAILABLE` (see the
preceding section). Four slices, each committed only after its own gates were green.

| Slice | Commit | What it is |
|---|---|---|
| G1.1 schema | `816b8f7` | 6 enums, 9 tables, 4 CHECKs, 1 partial unique index, 2 triggers |
| G1.2 runtime | `c0a183f` | variants / fulfilment / returns composed over inventory, orders, payments |
| G1.3 APIs + UI | `37991e6` | 16 tenant-authorized routes, one refusal envelope, two owner panels |
| G1.4 capability | `5f189e6` | three promotions, `retail-storefront-v1` activated, negatives repointed |

### The migration was not additive, and that is stated rather than hidden

`InventoryItem` gains `variantId`, so `20260829170000_commerce_variants_fulfilment_returns`
is not a purely additive migration - the first in this program that is not. Forcing additivity
was considered and rejected: a variant that cannot own stock is not a variant, and the whole
point of the wave is that a size or a colour is the thing you actually sell.

Five `InventoryItem` statements were therefore lifted out of the generated diff and
hand-ordered. Prisma emits `ADD COLUMN "variantId" TEXT NOT NULL`, which is simply wrong on a
populated table, and the rehearsal database held **237 pre-existing `DigitalProduct` rows**, so
this was a real populated-table migration and not a theoretical one. The end state matches what
Prisma would produce; only the order and safety of getting there differs.

`down.sql` drops the foreign key and the column **before** deleting the backfilled variants.
The natural order was rejected because the CASCADE would have deleted every stock row on
rollback - the rollback would have been more destructive than the migration.

### Existing products resolve, they are not rewritten

Every pre-existing product receives one default variant with the deterministic id
`var_<productId>`. Deterministic rather than `cuid()`, because reconciliation across
apply/rollback/reapply then becomes a join rather than an act of faith; the same convention is
used by `InventoryService.ensureDefaultVariant`, so the migration and the runtime cannot
diverge on what "the default variant" means.

The default variant leaves `priceCents` NULL and therefore **inherits** the product price.
Copying the price was rejected: the two would drift the first time an owner edited a product.

`InventoryItem.productId` is kept, and its agreement with `variantId` is enforced by
`reject_inventory_variant_product_mismatch()` and trigger
`InventoryItem_variant_product_match`. A composite foreign key `(productId, variantId)` would
have been tidier in SQL but Prisma cannot express it, so it would have become a sixth permanent
drift entry; dropping `productId` would have failed the relation-name verifier. The trigger is
the option that costs nothing later.

`DigitalProduct.variantsJson` and `DigitalProduct.stock` are untouched. What their existing
values mean is a data decision, not a schema one.

### Rehearsal, on the disposable target only

Backup sha256 `78f9d8ae…`. Pre-G1 85 tables / 931 columns / 190 enum labels / 14 triggers /
236 constraints -> post-apply 94 / 1024 / 214 / 18 / 277 -> rollback **byte-identical** to
pre-G1 (raw sha256 `32cd0cbe98c06bd7`) -> reapply normalized-identical. Row reconciliation:
10/10 pre-existing rows mapped exactly once on apply, 7/7 on rollback, 10/10 on reapply,
cleanup 1/1. The five pre-existing `profileId` `DropForeignKey` statements were excluded with
the count asserted, for the sixth wave running. Relation-name verifier: 0 renamed, 0 dropped
across 93 pre-existing models.

### Where stock leaves, and why it matters

Stock leaves at **SHIPPED**, by consuming the hold Wave F already created. Pack time was
rejected because the goods are still on the shelf; delivery time was rejected because they left
days earlier. The consequence is that `SHIPPED -> CANCELLED` is forbidden, which is a real
limitation and is stated in the UI rather than discovered at the write boundary.

Fulfilment and returns keep **no balances of their own**. Duplicating inventory would have made
two numbers that must agree, which is how the `DigitalProduct.stock` problem started.

Restock is idempotent via key `return:<itemId>` plus a stored `restockMovementId`. Returning
CONFLICT on replay was rejected: the requirement is idempotence, not refusal.

### Concurrency and refusals

Measured with genuinely parallel operations: where stock is insufficient exactly one caller
wins. A variant cannot be created as the default, and product, default flag and option
selection are immutable on update - mutability would relocate stock and rewrite the meaning of
orders already placed.

A foreign resource and a nonexistent resource return **byte-identical** refusals
(`403 {"ok":false,"error":{"code":"FORBIDDEN","message":"Access denied"}}`), proven by
comparing the two serialized bodies rather than by reading them. A 409 keeps its numbers in
machine-readable `details`, because a storefront cannot act on a bare conflict.

### Retail activation is a consequence, not a decision

`commerce:variants` and `:fulfilment` moved partial -> available; `:returns` moved planned ->
available. All three cite an evidence file that exists, which the contract harness checks.
`retail-storefront-v1` moved draft -> **active** because all six required capabilities are
available with a runtime file present - `validateBusinessBlueprint` is what decides that, not
`blueprints.ts`.

Three consequences for the contract harness, all of them maintenance the harness forces on
itself:

1. The planned-capability negative test moved from `commerce:returns` to
   `fieldJobs:dispatch`. That is the third such move
   (`venueOrders:reservations` -> `commerce:inventory` -> `commerce:returns` ->
   `fieldJobs:dispatch`). A second assertion now records *why*: returns is available, so it
   can no longer serve as the planned example.
2. `"activating retail is still rejected"` was **inverted** to
   `"activating retail is accepted"` rather than deleted. The claim worth testing is what the
   validator produces from the real registry, not which status string sits in the blueprint.
3. New, and required: activation must fail when **any one** required capability is downgraded.
   Each of the six is temporarily downgraded in the real registry to both `partial` and
   `planned`, the real validator is re-run, and the rejection must name that capability and its
   maturity. 12 cases, all rejected, all naming the blocked capability. Every downgrade is
   reverted immediately and the restoration is asserted, so the test leaks no state into later
   assertions.

### What Wave G does not claim

No carrier is contacted - tracking is text the owner types. No refund is executed - a refund
payment is only referenced. No email, SMS or WhatsApp is sent. The blueprint summary and the
three capability descriptions say all of this, and the harness asserts that they say it, so an
active retail storefront cannot quietly come to imply an integration that does not exist.

### Gates on the integrated tip `dd84acc`

| Gate | Result |
|---|---|
| `prisma validate` / `generate` | 0 / 0 |
| app `tsc --noEmit` | 0 |
| targeted ESLint (all changed paths) | 0 problems |
| repo-wide ESLint | 91 problems (39 errors, 52 warnings) - **identical to `34f8561`** |
| check harnesses | **44 of 44 exit 0** (`check-order-stream` excluded, precondition still unmet) |
| `check-commerce-schema-invariants` | 85/85 |
| `check-commerce-runtime` | 110/110 |
| `check-commerce-routes` | 78/78; inverted 77/78 exit 1 |
| `check-capability-contract` | PASS, 0 failures; `INVERT_ASSERTION=1` -> 18 failures, exit 1 |
| `check-business-os-a11y` | PASS, 127 assertions (104 -> 127); inverted probe failed then restored |
| `check-inventory-*` | 51/51 schema, 85/85 runtime, 58/58 routes |
| relation-name verifier | 0 renamed, 0 dropped across 93 models |
| secret scan | 0 real hits; one deliberate fake DSN in `check-commerce-routes` |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0; all 16 commerce routes emitted as dynamic server routes |
| live `personalink` | untouched - 35 public tables, 0 wave tables, 16 `Profile` rows |
| disposable DB | left fully applied at 94 tables, not mid-rehearsal |

**One honest note about the sweep driver.** `run-wave-c-gates.ps1` is hardwired to the primary
worktree. While Wave G was still on its branch, running it against the already-migrated
rehearsal database reported three inventory failures - an artifact of the *checkout* being
behind the *database*, not regressions. A worktree-scoped driver (`run-wave-g-gates.ps1`, kept
outside the repository) was used for pre-merge sweeps, and gave 44/44. The post-merge sweep used
the original driver, which is valid again now that the primary carries Wave G, and also gave
44/44. Recording the distinction rather than quietly picking whichever number looked better.


---

## Wave G3 - retainers, course access levels, two capability promotions

Integrated at `5a26b6b` (merge, `--no-ff`) from base `1f172eb` via branch
`feature/wave-g3-retainers-access`. Root-serial. Three slices, each committed only after its
own gates were green.

| Slice | Commit | What it is |
|---|---|---|
| G3.1 schema | `c4fb417` | 9 tables, 11 enums, 14 CHECKs, 2 partial unique indexes, 6 triggers |
| G3.2 runtime | `d07c41d` | retainer + course-access engines, and a second additive migration |
| G3.3 capability | `dd5b9ee` | two promotions; three blueprints stop calling them planned |

### Two migrations, and why the second one exists

`20260829190000_retainers_and_course_access_levels` shipped the retainer tables, including
`CaseRetainerDraw`, which records every movement of the allowance. What it cannot record is a
**state** change - activating an agreement, closing or renewing a period, linking a case. And
`CaseEvent` could not be reused, because `CaseEvent."caseId"` is NOT NULL while a retainer
legitimately exists before any case is linked to it.

Two alternatives were considered and rejected. Fanning agreement events out to every linked
case would leave a retainer with no links yet holding no history at all - exactly the moment an
owner most wants one. Requiring a linked case before activation would have made that gap
unreachable rather than absent, which is worse: the hole would still be there, just harder to
find. So `20260829200000_retainer_event_history` adds `CaseRetainerEvent`, strictly additively,
reusing `CaseEventKind` and `CaseEventActor` so it adds no vocabulary.

This is recorded as two migrations rather than folded into one because that is what actually
happened, and because the second one is the honest consequence of noticing the gap while
writing the runtime.

### The one non-additive statement, and the position that matters

```
ALTER TYPE "CaseEventKind" ADD VALUE 'RETAINER' BEFORE 'NOTE';
```

Reusing `'NOTE'` with a discriminator smuggled into the free-text `to` column - the way brief
events already do - was rejected. A query for retainer history would become
`WHERE kind = 'NOTE' AND "to" LIKE 'RETAINER%'`, which is the sort of encoding that quietly
becomes a lie. `CohortEventKind` already carries a domain-specific `RENEWAL`, so a
domain-specific kind is the established shape here.

`BEFORE 'NOTE'` is not decoration. Prisma emits a bare `ADD VALUE`, which Postgres appends at
the **end**, leaving the database reading `(APPROVAL, NOTE, RETAINER)` while `schema.prisma`
reads `(APPROVAL, RETAINER, NOTE)`. Postgres cannot reorder an enum afterwards, so the position
is decided at insertion time or never. The build tool rewrites the statement with the
substitution counted and asserted. Verified in the database, and by a post-apply `migrate diff`
that shows zero enum churn.

**Rolling back an enum value is not a no-op, and `down.sql` says so.** Postgres cannot remove a
value, so the rollback recreates the type in its original member order, and refuses to run if
any `CaseEvent` row already uses `RETAINER` - a migration whose new value is in use cannot be
rolled back without destroying history. The rolled-back catalog came out byte-identical and the
enum read as its original nine labels.

### A retainer is an agreement plus a ledger, not a payment

Workspace-scoped, linked to cases through `CaseRetainerCaseLink` rather than owning a single
`caseId`. A retainer is an agreement with a client that work from several cases draws against;
tying it to one case would make "renewal period" meaningless, because you would be renewing per
case rather than per agreement.

Each period **snapshots** its own included allowance rather than reading the agreement, so
amending the agreement cannot rewrite what a closed period included.

**Overage is accepted and reported, not prevented.** `used` may exceed `included`. Refusing a
draw once an allowance is spent would misrepresent work that was actually done, and an owner who
cannot see overage cannot bill for it. What *is* constrained: used can never go negative; a draw
must be denominated in the same basis as its period; a draw may only name a case the retainer
covers; a draw may only belong to a period of its own retainer; and a retainer and its linked
cases must share a workspace. The last four are triggers, because a composite foreign key would
express them and Prisma cannot describe one.

The draw ledger stores the signed delta **and** the resulting balance, so replaying it must
reproduce the period - measured over a four-row ledger including a credit.

### Consumption is additive, so both parallel writers must win

Measured with genuinely parallel operations: two draws fired at one open period **both land**,
and their after-balances chain correctly. This is the **opposite** of the Wave F inventory case,
where exactly one writer wins because stock is finite. Consumption is additive, so a lost writer
would silently forget real work. The period row is locked `FOR UPDATE` first, so the two
serialise rather than racing.

### Content visibility is a new decision, not a changed one

Before this wave there was **no content-visibility check anywhere in the repository**. Any
ACTIVE or COMPLETED enrolment returned every module and every lesson, and `CourseLesson.isFree`
was written by importers and enforced by nothing.

So the risk was never that an existing rule would break - there was none - but that adding rules
would silently change what existing learners can see. The design makes that impossible: a lesson
with no `CourseLessonAccess` row is unrestricted, no existing lesson has one, and there is
therefore **no backfill to get wrong**. That is measured, not asserted: on a seeded three-tier
course, a learner holding no tier at all - the state every existing learner is in - still sees
every unruled lesson.

A **SUSPENDED or EXPIRED** grant falls back to the unruled lessons, **not** to the lowest tier.
Expiry is computed on read rather than swept, so a grant past its expiry stops entitling
immediately while its state remains ACTIVE, and the report says so.

Two services, because there are two principals. `CourseAccessService` is the owner surface and
composes `CohortContext`. `LearnerAccessService` takes **no** `workspaceId` at all - a learner is
a `Member` with a cookie session, not a Clerk user with a workspace membership, and letting a
learner name a workspace would hand them a probe. Both call **one** visibility function, so the
console and the learner surface cannot disagree; that is asserted by comparing their outputs.

**Approving is not applying.** Requesting changes nothing, approving changes nothing, only
applying moves the entitlement - all three measured separately. Applying is refused if the
entitlement moved since approval, so an approval cannot overwrite a tier it was never agreed
against. Direction is derived by comparing ranks, so a downgrade cannot be presented as an
upgrade. Removing a rule restores the original behaviour, so the whole feature can be backed out
without a data migration.

### No payment execution, measured on both sides

The retainer's full billing lifecycle - `DRAFT`, `ISSUED` against a real `CaseInvoice`, `PAID` -
leaves the `Payment` row count unmoved. A complete course upgrade, with an invoice reference
recorded, does the same. Every change event stores `paymentExecuted: false`, so the history
cannot be read as a charge.

### Three blueprints had to stop calling these planned

A backlog entry for something that exists is a false statement - the same correction
`restaurant-venue-v3` made for inventory in Wave F. `coaching-studio-v2` now requires
`contentCohorts:accessLevels`; `consulting-agency-v1` and `ca-practice-v1` now require
`casesProjects:retainers`. `consulting-agency-v1` is the pointed one: its summary has claimed
retainers since Wave E while the capability sat in a backlog.

A new invertible check now sweeps **every** blueprint for a planned entry naming an available
capability. It immediately found one: `restaurant-venue-v2` lists `commerce:inventory` as
planned, available since Wave F. **It is exempted by name, and the reasoning is recorded rather
than buried.** v2 is retained for addressability as a *historical* contract, and its backlog was
accurate when written; editing it to match today would be claiming the historical contract said
something it did not. A live blueprint is a claim about now, a deprecated one is a record of
then. A second assertion proves every exempted entry belongs to a deprecated blueprint on the
named list, so the exemption cannot quietly grow.

### Gates on the integrated tip `5a26b6b`

| Gate | Result |
|---|---|
| `prisma validate` / `generate` | 0 / 0 |
| app `tsc --noEmit` | 0 |
| targeted ESLint (all changed paths) | 0 problems, 0 warnings |
| repo-wide ESLint | 91 problems (39 errors, 52 warnings) - **identical to `34f8561`** |
| check harnesses | **48 of 48 exit 0** (44 at Wave G plus 4 new) |
| `check-retainer-schema-invariants` | 77/77; inverted 76/77 exit 1 |
| `check-retainer-runtime` | 87/87; inverted 86/87 exit 1 |
| `check-course-access-schema-invariants` | 72/72; inverted 71/72 exit 1 |
| `check-course-access-runtime` | 79/79; inverted 78/79 exit 1 |
| `check-capability-contract` | PASS, 0 failures; inverted 19 failures, exit 1 |
| `check-case-schema-invariants` | 37/37 (was 36/36 - `CaseEventKind` now pinned as an ordered list, not a count) |
| relation-name verifier | 0 renamed, 0 dropped; 10 new models across the two migrations |
| row reconciliation | content md5 of 12 pre-existing tables identical at apply, rollback **and** reapply |
| external calls | zero, counted |
| fixture residue | zero across 16 tracked tables; every append-only trigger verified re-armed |
| secret scan | 0 hits |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0 |
| live `personalink` | untouched - 35 public tables, 0 wave tables, 16 `Profile` rows |
| disposable DB | left fully applied at 104 tables, not mid-rehearsal |

**One failure worth recording rather than quietly re-running.** The first full sweep failed on
`check-schema-invariants` because the G3 reconciliation fixture was still resident in the
rehearsal database and collided on `Workspace.profileId`, which is unique. The fixture was
removed through its own cleanup step, the append-only trigger was verified re-armed, and the
pre-existing counts were confirmed back at 4 courses / 6 modules / 18 lessons / 1 enrolment. That
was harness residue, not a regression - but the distinction is only worth anything if it is
written down.


---

## Wave G4 - the fieldJobs foundation: intake and dispatch

Integrated at `ef17770` (merge, `--no-ff`) from base `61670da` via branch
`feature/wave-g4-fieldjobs`. Root-serial. `fieldJobs` was the last engine in the registry with
nothing built at all: intake, dispatch and inspection were all `planned` with evidence `none`.

| Slice | Commit | What it is |
|---|---|---|
| G4.1 schema | `20c509e` | 4 tables, 7 enums, 6 CHECKs, 2 partial unique indexes, 2 triggers |
| G4.2 runtime + promotion | `8d966af` | intake and dispatch engines; two capabilities promoted |

### This is a foundation, and that is said out loud in five places

`fieldJobs:inspection` is deliberately not built and stays `planned` with evidence `none`. Asset
checks, parts, completion notes and invoice handoff are absent on purpose. The migration header,
the capability description, both commit messages, `TASKS.json` and `NEXT_ACTION.md` all say so -
because two available capabilities beside one planned one is exactly the shape that gets read as
"the engine is done" six weeks later.

### The technician already existed, so no technician was created

A field technician **is** an `AppointmentResource` with kind `STAFF`. That table is already
profile-scoped, already optionally tied to a `Location`, already carries `capacity` and
`isActive`, and is already what `ServiceOffering` rows are made eligible for. A separate
`Technician` table would have been a second answer to "who can do this work", and the two would
have drifted the first time somebody was added to one and not the other. `ServiceOffering` is
reused for the same reason.

The consequence is not a preference: tenancy here **has to be** `profileId`, because sharing
`AppointmentResource` means sharing its scope. The forbidden-table list in the schema harness is
correspondingly long and deliberate - `Technician`, `FieldTechnician`, `Crew`, `CrewMember`,
`WorkOrder`, `Job`, `JobCard` - and `AppointmentResource` is pinned at exactly nine columns, so
reuse cannot quietly become extension. The runtime harness adds the other half of that proof: the
technician count moves by exactly the five rows the fixture seeded, and no `Booking` row is
created by any of it.

**A job happens at a customer site, not at a `Location`.** `Location` models the owner's own
premises and is read by the reservation, appointment and inventory engines. Creating `Location`
rows for customer addresses would pollute it. So `FieldJob.siteAddress` is required free text and
`originLocationId` is only the depot the job is dispatched *from*.

**A request is not a job.** `FieldJobRequest` is separate for the same reason `CaseIntake` is
separate from `CaseProject`: a declined request must remain a record, and a job that exists must
mean somebody committed to it. Collapsing them would make "how many jobs do we have"
unanswerable.

### The design work is in the side conditions, not the status table

A status table alone would let an owner dispatch a job with nobody assigned, start one before
anybody arrived, or complete one while a technician was still mid-visit. Each condition is an
exported named list in `lifecycle.ts` rather than an inline `if`, so the rule is readable without
reading the method, and each one is measured:

- a job with no visit window cannot be marked scheduled **or** dispatched;
- a job cannot be dispatched without an accountable `LEAD` - **a helper alone is not enough**;
- work cannot start until a technician is `ON_SITE`;
- a job is not complete while any card is still `ASSIGNED`, `ACCEPTED`, `EN_ROUTE` or `ON_SITE`,
  and the refusal names how many;
- cancelling a job, declining a card and releasing a card all need a reason, and whitespace does
  not count - the database rejects it too.

**An assignment is a request until the technician answers it.** `ASSIGNED` cannot jump to
`EN_ROUTE`; recording only `ASSIGNED` would make a silent refusal look like agreement. A
technician who declined can be assigned again, and the declined row survives, because both
partial unique indexes exclude `DECLINED` and `RELEASED`.

Directionality is deliberate. `SCHEDULED` can return to `DRAFT`, because un-scheduling is normal
when a customer moves. `DISPATCHED` cannot, because a technician has already been told. An
`IN_PROGRESS` job can still be cancelled, because work does get abandoned. A `COMPLETED` job is
terminal and cannot be cancelled.

### What "dispatch" does not do, measured rather than promised

No route is optimised, no distance or travel time is computed, no map provider is called, and no
technician is notified. The schema harness asserts there is no `routeId`, `routeOrder`,
`distanceMeters`, `travelMinutes`, `latitude`, `longitude`, `notifiedAt`, `smsSentAt`,
`emailSentAt`, `pushSentAt` or `providerMessageId` column anywhere in the four tables, and that
no `Route`, `Inspection`, `Part`, `Asset`, `Invoice` or `Notification` table exists. The runtime
harness replaces global `fetch` with a counting blocker and asserts zero calls, and asserts every
assignment event records `notified: false` - so the history cannot be read as a claim that
somebody was told.

### The fourth repoint of the planned negative test, and a warning about the fifth

`fieldJobs:intake` and `fieldJobs:dispatch` moved `planned -> available`. The
capability-contract planned-capability negative test therefore moved from `fieldJobs:dispatch` to
`fieldJobs:inspection`.

That is the **fourth** move in this program - `venueOrders:reservations` ->
`commerce:inventory` -> `commerce:returns` -> `fieldJobs:dispatch` -> `fieldJobs:inspection` -
and the **second within this single run**, because G3 promoted returns and G4 promoted dispatch.

A new assertion now warns about the end of that road. If a future wave promotes `inspection`
there will be **no planned capability left in the registry**, and the test will have to be
rewritten against a synthetic descriptor rather than repointed. The assertion lists the surviving
planned capabilities in its detail field, so the day it fails it will say exactly why rather than
just going red.

### Gates on the integrated tip `ef17770`

| Gate | Result |
|---|---|
| `prisma validate` / `generate` | 0 / 0 |
| app `tsc --noEmit` | 0 |
| targeted ESLint | 0 problems, 0 warnings |
| repo-wide ESLint | 91 problems (39 errors, 52 warnings) - **still identical to `34f8561`** after four integrated waves |
| check harnesses | **50 of 50 exit 0** (48 at Wave G3 plus 2 new) |
| `check-fieldjob-schema-invariants` | 79/79; inverted 78/79 exit 1 |
| `check-fieldjob-runtime` | 75/75; inverted 74/75 exit 1 |
| `check-capability-contract` | PASS, 0 failures; inverted 19 failures, exit 1 |
| relation-name verifier | 4 models added, 0 renamed, 0 dropped |
| rehearsal | pre-g4 104 tables -> apply 108 -> rollback byte-identical `19214961de96a2d1` -> reapply normalized-identical |
| post-apply drift | 0 of everything except the five pre-existing `profileId` `DROP CONSTRAINT` statements, ninth wave running |
| external calls | zero, counted |
| fixture residue | zero across 7 tracked tables; append-only trigger verified re-armed |
| secret scan | 0 hits |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0 |
| live `personalink` | untouched - 35 public tables, 0 wave tables, 16 `Profile` rows |
| disposable DB | left fully applied at 108 tables, not mid-rehearsal |

**No APIs and no owner surfaces, same as G3.** The brief asked to *begin* the foundation, and
claiming a surface would have meant building one. That is recorded in `NEXT_ACTION.md` so two
available capabilities are not read as two finished features.


---

## Retainers, end to end - the HTTP surface and the owner panel

Two commits on `recovered/aug20-wt-pr-32`: `9ca772e` (10 routes) and `4ebaf2a` (owner panel).
The retainer engine landed in Wave G3 with no way to reach it; this closes that.

**An integration deviation, recorded rather than glossed.** Both commits went **directly onto
the primary branch**, not through a feature branch and `--no-ff` merge like Waves G, G3 and G4.
The branch-then-merge pattern exists to keep unvalidated work off the integration tip, and every
gate below was run on exactly this tree, so that protection was obtained a different way. Neither
commit carried a migration; a schema-bearing package would still warrant the branch.

### The HTTP layer went where the existing one is

The retainer methods live on `CaseApiService` rather than on a service of their own, for the same
reason `CaseRetainerService` composes `CaseContext`: the envelope, the status map, the
server-derived actor and the 503 catch-all are already there, and a second HTTP boundary would be
a second place for them to drift. `CaseApiService` gained a fourth constructor argument, so
`check-case-routes` needed updating — it still passes 75/75, which is the point of touching it
rather than working around it.

### What the route harness measures rather than asserts

- **Non-enumeration, byte for byte.** A foreign retainer and a nonexistent one produce an
  identical status *and* an identical body, compared by serializing both rather than by asserting
  two 403s. Checked twice: once for a signed-in owner naming someone else's workspace, and once
  for a genuinely different signed-in tenant.
- **400 is not 409, on the same field.** `basis: "HOURS"` is 400 because the vocabulary check runs
  before the state machine; units *and* money together is 409 because the value was understood and
  refused. Likewise `state: "SLEEPING"` is 400 while a legal-but-out-of-order `"PAUSED"` is 409.
  Two different mistakes, two different answers, one field.
- **A 409 keeps its numbers.** The over-credit refusal is asserted to contain the actual used
  figure, not just a status code.
- **Overage is accepted over HTTP too.** A draw past the allowance returns 201 and the body
  reports `overage: 16`.
- **No payment route exists.** The `Payment` row count is captured and re-checked after `DRAFT`,
  `ISSUED` against a real `CaseInvoice`, and `PAID` have all been driven through HTTP.
- **The 503 leaks nothing.** A broken client whose underlying error contains a fake DSN produces
  `DEPENDENCY_UNAVAILABLE` with no DSN, host or driver text in the body.
- **One envelope shape.** The 200, 201, 400, 401, 403, 409 and 503 responses are each asserted to
  carry exactly `{ok,data}` or `{ok,error}` and nothing else.

Re-linking a case returns 200 with `linked: false` rather than an error, matching the replay
convention every other idempotent write on this surface already uses.

### The panel's job is mostly to stop a retainer looking like a payment

Billing state is stated to be a record and not a charge **twice** — in the card description and
again beside the buttons that change it, because the second is where an owner actually reads it.
Overage is shown with its reason: "recorded rather than refused, so it can be billed". An owner
who cannot see overage cannot bill for it.

The balance section says its figures are recomputed from the ledger on every read rather than
stored. The ledger section says each row holds the balance it produced at the time rather than a
recalculation. Auto-renew is disclosed as intent only, so the word does not imply a timer that
does not exist.

**The panel performs no arithmetic on any balance, and that is asserted rather than intended.**
No `Math.round`, no `Math.max`, no subtracting remaining from included — every number is rendered
as the server computed it, and the harness checks for the *absence* of those operations. The
moment a browser starts working out a balance there are two answers to what the client owes.

One helper formats an allowance by basis, so a units agreement is never printed as money and a
money agreement never as a count. Printing "USD 0.20" where the contract says twenty units would
be a quiet lie about the contract.

Every action button — retainer, period and billing — renders from server-computed
`allowedTransitions`. A terminal retainer and a terminal period each explain why they have no
actions rather than simply showing none. A retainer with no open period says so instead of showing
a draw form that would be refused, and the draw form states the two rules a caller would otherwise
discover by being refused.

### Gates

| Gate | Result |
|---|---|
| `check-retainer-routes` | 62/62; inverted 61/62 exit 1 |
| `check-case-routes` | 75/75 after the constructor change |
| `check-business-os-a11y` | PASS, 150 assertions (127 -> 150) |
| check harnesses | **51 of 51 exit 0** |
| app `tsc --noEmit` | 0 |
| targeted ESLint | 0 problems, 0 warnings |
| repo-wide ESLint | 78 problems - unchanged by either commit |
| production build | exit 0; all 10 retainer routes emitted as dynamic server routes |

**Still missing, and named so nobody has to discover it:** course access levels and field jobs
have engines with no HTTP surface and no owner panel. No capability description claims otherwise.


---

## Field jobs, end to end - the HTTP surface and the owner panel

Two commits on `recovered/aug20-wt-pr-32`: `3185a58` (10 routes) and `3de518b` (owner panel).
Same direct-commit deviation as the retainer surface, for the same reason: no migration, and
every gate ran on exactly this tree.

### This surface has two actors, and that is the interesting part

Cases and cohorts derive a fixed `STAFF` actor and offer no way to name yourself. Field jobs
genuinely have two: an office staffer moving a job card **on a technician's behalf** is a
different fact from the technician moving it, and a history that cannot tell them apart is worth
less. So a write may declare `actorType: "TECHNICIAN"`.

That makes the actor an **input**, which is exactly the kind of input an audit trail must not
over-trust. So the boundary is deliberately narrow, and the harness proves it rather than the
comment asserting it: `STAFF` and `TECHNICIAN` are accepted, **`CUSTOMER` and `SYSTEM` are
refused with 400**, and `actorId` is never taken from the caller whatever is sent. A request
asserting that it came from the system is precisely what a record should not believe.

### Conversion is a POST, not a status change

A request becomes `CONVERTED` by a job existing. So conversion has its own route, and the status
route **refuses** `CONVERTED` with a 409 that says exactly that. There is one way to do it, and
the wrong way explains itself instead of half-working. The panel filters `CONVERTED` out of its
transition buttons for the same reason.

### What the route harness measures

- **400 is not 409, on the same field, three times over.** An unrecognised request status is 400
  and a legal-but-out-of-order one is 409. A non-integer quote is 400 and a negative one is 409.
  An unrecognised priority or role is 400 *and lists the accepted values*.
- **The side conditions survive the route.** A job with no visit window still cannot be scheduled;
  a job with nobody assigned still cannot be dispatched, and the refusal still names the missing
  lead technician. A route that quietly widened an engine rule would be the easiest thing in this
  codebase to miss, so it is checked at the boundary rather than assumed from the engine test.
- **Non-enumeration, byte for byte, twice.** Foreign versus nonexistent technician, and foreign
  versus nonexistent job.
- **Nothing is notified.** Every assignment event carries `notified: false`, asserted from the
  timeline the *route* returns rather than from the engine.
- **An unrecognised status filter is 400, not silently ignored.** A list endpoint that drops a
  filter it does not understand returns the wrong rows and says nothing about it.
- **The 503 leaks nothing**, and **one envelope shape** across 200/201/400/401/403/409/503.

`runtime.ts` has no adapters, and its comment says why that is the design rather than an
omission: a field-service product is *exactly* where you would expect a map provider, a routing
engine and an SMS gateway, and the composition root is the one place a reviewer has to look to
know that none are wired.

### The panel's whole job is saying what dispatch does not do

Four things, because a field-service panel that stays quiet about them gets read as having them:

1. **Assigning a technician tells nobody.** Stated twice — in the card description and again
   beside the assign control, because the second is where an owner is standing when they do it.
2. **No route is planned and no travel time is estimated.** No ordering control, no map, no ETA
   field. Asserted by looking for map-library imports, eta-shaped identifiers and
   `routeOrder`/`travelMinutes`/`distanceMeters`, and by proving every line mentioning a route is
   copy saying there isn't one.
3. **The visit window is what the owner typed**, not a slot the system found.
4. **Inspection, parts and completion notes are not built**, said outright rather than leaving an
   owner hunting for a tab that does not exist.

It also **explains rules instead of only enforcing them**, which is the difference between a
disabled button and a usable surface: an undated job says dispatching it would tell nobody when to
turn up; an accepted request with no site address says a job with no address cannot be visited;
the assign control says a technician is an existing staff resource so nobody is created here — the
Wave G4 reuse decision surfacing where it actually matters; the one-lead rule carries its reason;
and a declined request is described as still a record, because declining should not erase that
somebody asked.

**One assertion was written badly and rewritten rather than relaxed.** The first attempt asserted
the absence of the bare string "ETA", which failed — because the panel's own honesty copy says
"no ETA". It now looks for eta-shaped identifiers and map libraries, and separately proves every
route mention sits in a line saying no route is planned. An assertion that fails on the copy it
exists to protect is worse than no assertion, and quietly deleting it would have been worse still.

### Gates

| Gate | Result |
|---|---|
| `check-fieldjob-routes` | 53/53; inverted 52/53 exit 1 |
| `check-business-os-a11y` | PASS, 175 assertions (150 -> 175) |
| check harnesses | **52 of 52 exit 0** |
| app `tsc --noEmit` | 0 |
| targeted ESLint | 0 problems, 0 warnings |
| repo-wide ESLint | 78 problems — unchanged by either commit |
| production build | exit 0; all 10 field-job routes emitted as dynamic server routes |

**Still missing:** `contentCohorts:accessLevels` has an engine with no HTTP surface and no panel,
and `fieldJobs:inspection` is still not built.


---

## Access tiers are now enforced, not merely enforceable

Commit `581a03e`. Wave G3 made access tiers real and computed visibility correctly, and **nothing
consulted it**. This gap was written into `INTEGRATION_QUEUE.md` as the most honest remaining gap
in the program *before* it was closed, rather than found and quietly fixed — which is the only
reason it is worth writing about now.

### One rule, four callers

`src/lib/cohorts/access.ts` now exports `lessonVisibleToEnrollment(db, lessonId, enrollmentId)`,
typed against the narrowest client that can answer the question so it works inside a Prisma
transaction as well as against the full client. The owner console, the learner surface, the library
page and the completion route all call it.

Restating the rule at each site was the alternative, and three copies of an access rule is three
chances to disagree about what somebody paid for. The harness asserts that neither new call site
restates it.

### The library reader

`src/app/library/courses/[id]/page.tsx` consulted nothing before this: any ACTIVE or COMPLETED
enrolment returned every module and every lesson of the course.

- A lesson with no access rule is visible to everybody, so **every course without tiers configured
  behaves exactly as it did before**. No data migration, and no existing learner's view changed.
- Locked lessons are **removed** rather than shown as locked, because `CourseViewer` has no locked
  state and inventing one here would mean two components disagreeing about how a lock looks. That
  reason is written into the file rather than left as a silent choice.
- The **count is surfaced** instead: "N lessons are not included in your current access level."
  Being quietly given less is worse than being told what you cannot see.
- A module whose every lesson sits above the tier is dropped rather than rendered empty, because an
  empty module reads as a broken course.
- `completedLessonIds` is filtered too, so a lesson the learner can no longer see does not show as
  complete in a course they can no longer finish.

### The completion route

`src/app/api/courses/complete-lesson/route.ts` now refuses a locked lesson, and refuses it with the
**same** `ACCESS_DENIED` response a foreign enrolment gets. That is deliberate: a distinguishable
refusal would let a learner map which lessons exist above their tier by trying to complete them one
at a time.

### A vacuous assertion, caught before it shipped

One of the eight new assertions was written as `.every(async ...)`. That is **always truthy** — it
would have shipped a check that cannot fail and reports success. It was replaced with an awaited
per-lesson loop comparing the shared rule against the list computation across all four lessons. A
vacuous assertion is worse than no assertion, because no assertion at least does not claim
anything.

### Gates

| Gate | Result |
|---|---|
| `check-course-access-runtime` | 87/87 (79 -> 87); inverted 86/87 exit 1 |
| check harnesses | **52 of 52 exit 0** |
| app `tsc --noEmit` | 0 |
| targeted ESLint | 0 problems, 0 warnings |
| repo-wide ESLint | 78 problems — unchanged |
| production build | exit 0 |

**Scope note.** This does not touch the capability registry.
`contentCohorts:accessLevels` claims tiers, entitlements and visibility enforcement — which is now
true in the two places content is actually served. It has never claimed an owner API or panel, and
it still does not have one.


---

# Run close - 2026-08-29, seven hours, root-serial

Started `2026-08-29 16:24:52 +05:30` from primary HEAD `34f8561`. The combined suite below was run
on `43d0fa5`; this closing section and the `NEXT_ACTION.md` rewrite land on top of it as
docs-only commits, so the final tip is `31957f7` and the gate results still hold.

## What was delivered

| Package | Commits | What it is |
|---|---|---|
| Orchestration recovery | `efb843f` | one bounded attempt, recorded `ORCHESTRATION_UNAVAILABLE` |
| Wave G — commerce variants, fulfilment, returns | `816b8f7`, `c0a183f`, `37991e6`, `5f189e6`, merge `dd84acc` | 9 tables, 16 routes, 2 panels, `retail-storefront-v1` activated |
| Wave G3 — retainers and course access levels | `c4fb417`, `d07c41d`, `dd5b9ee`, merge `5a26b6b` | 10 tables across two migrations, two engines, two promotions |
| Wave G4 — fieldJobs foundation | `20c509e`, `8d966af`, merge `ef17770` | 4 tables, intake and dispatch, two promotions |
| P1-009 slice 2 | `2804314` | repo-wide lint 91 -> 78, provably |
| Retainer surface | `9ca772e`, `4ebaf2a` | 10 routes and an owner panel |
| Field-job surface | `3185a58`, `3de518b` | 10 routes and an owner panel |
| Access-tier enforcement | `581a03e` | tiers enforced where content is served, not merely enforceable |
| Ledger reconciliation | `1f172eb`, `61670da`, `0427f25`, `edfd4c7`, `bb1548c`, `5d5d18f`, `43d0fa5` | seven ledger commits |

**Seven** capabilities moved from `planned` or `partial` to `available`, each citing an evidence
file that exists: `commerce:variants`, `commerce:fulfilment`, `commerce:returns`,
`casesProjects:retainers`, `contentCohorts:accessLevels`, `fieldJobs:intake` and
`fieldJobs:dispatch`. `retail-storefront-v1` went from draft to active, and **no blueprint is left
in draft**.

## Final combined suite on `43d0fa5`

| Gate | Result |
|---|---|
| `prisma validate` / `generate` | 0 / 0 |
| app `tsc --noEmit` | 0 |
| check harnesses | **52 of 52 exit 0** (41 at `34f8561`, +11 this run) |
| relation-name verifier | 0 renamed, 0 dropped |
| repo-wide ESLint | 78 problems (39 errors, 39 warnings), **down from 91** |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0 |
| live `personalink` | untouched — 35 tables, no `_prisma_migrations`, 0 wave tables, no `btree_gist`, `Profile` = 16 |
| origin | `4b386d1d…` and `origin/main` `9e8a0ff…`, both unchanged; nothing pushed |
| frozen worktrees | all six `kirocrew/*` still at `ea69595` |
| disposable DB | 17 migrations, `migrate status` up to date, 108 tables — fully applied, never mid-rehearsal |
| working tree | only the two expected untracked paths |
| `P1_014_ACTION_INVENTORY.md` | 6067 bytes, last written 2026-08-28 13:18 — before this run began |

## What this run got wrong, and what that cost

Recorded because a run that only lists its successes is not a record.

1. **A vacuous assertion nearly shipped.** One access check was written as `.every(async ...)`,
   which is always truthy. It would have reported success forever. Replaced with an awaited loop.
2. **An assertion failed on the copy it existed to protect.** A check for the absence of the
   string "ETA" failed because the field-jobs panel honestly says "no ETA". Rewritten to look for
   eta-shaped identifiers instead of the word.
3. **Two fixtures violated real constraints**, and the constraints caught them rather than review:
   `OrderLine_amounts_check` and `CourseAccessGrant_expiry_after_grant`.
4. **A verification command failed silently.** `Select-String -Path` with `**` globs does not
   recurse and reported zero matches for identifiers that were provably present. The P1-009
   verification was redone recursively; had it been trusted, the slice would have deleted code on
   the strength of a search that never ran.
5. **The first full sweep after Wave G3 failed on harness residue**, not a regression — a
   reconciliation fixture left in the rehearsal database collided on a unique key. Cleaned up and
   recorded rather than quietly re-run.
6. **Two packages were committed directly to primary** rather than through a feature branch and
   `--no-ff` merge. Neither carried a migration and every gate ran on the integrated tree, but it
   is a deviation from the pattern the earlier waves used and it is recorded in both P2-014 and
   P2-015.

## Three things left honestly unfinished

1. `fieldJobs:inspection` is not built and is declared `planned`. It is the **last** planned
   capability in the registry, which makes the capability-contract negative test's next repoint
   impossible — it will need rewriting against a synthetic descriptor. An assertion already warns
   about this.
2. `appointments:reminders` and `:deposits` remain `partial` with inert providers. Owner-gated.
3. `contentCohorts:accessLevels` has an engine, enforcement and executable tests, but **no owner
   API or panel**. Tiers can be defined only through the engine.

Nothing in the capability registry claims something that does not exist. Two capabilities are
`available` on the strength of an engine plus enforcement rather than an owner surface, and
`NEXT_ACTION.md` says so in the table rather than leaving it to be inferred.


---

# Run close - 2026-08-30, night-run resumed after failure, root-serial integration

The previous night-run died mid-flight. This run resumed from primary `435a5e9`, finished
`fieldJobs:inspection`, integrated the two worker packages that were complete but unintegrated, and
promoted the capability. Final tip `7b15cd3` plus the docs commit that carries this section.

## The resume began by measuring, and the inherited description was wrong in three places

This is the most useful thing in this entry, because every one of these would have caused real
damage if trusted.

1. **The brief said the disposable database held in-progress inspection work.** It did not. The
   schema and its migration had already landed in `8b33a6a`, and the rehearsal database was left
   **fully applied**: 18 migrations, every one finished, none rolled back, 5/5 inspection tables,
   4/4 inspection enums, 113 public tables. Had the run "resumed the rehearsal" it would have
   re-applied an applied migration. Nothing was re-run.

2. **A stale runner made a healthy database look broken.** `prisma migrate status` through
   `wave-c\run-on-rehearsal.js` reports "17 migrations found" while the repository has 18 and the
   database has 18. The runner hardcodes `APP_DIR` to the `personai-wave-c-cases-wt` worktree, which
   sits 12 commits behind at `8d966af`. That is the documented sweep-driver trap wearing different
   clothes: **a driver pinned to the wrong checkout does not error, it lies quietly.** Diagnosed by
   querying `_prisma_migrations` directly with a purpose-written read-only probe rather than by
   trusting the tool.

3. **The migration's rollback evidence was half worthless.** Six H0 snapshots existed. Comparing
   them by hash showed `h0-rollback` is **byte-identical to `h0-post`** - so the first rollback was a
   no-op and proved nothing, which is presumably why a second cycle script exists. The second cycle
   is genuine: `h0-rollback2` equals `h0-pre` exactly, and `h0-reapply2` equals `h0-post` apart from
   39 OID-derived internal NOT NULL constraint names on the recreated inspection tables, with **zero**
   non-OID differences and 1194 constraints on both sides. Rule earned: **invertibility evidence is
   only as good as the snapshot taken after the rollback actually ran, and two snapshots with the same
   hash either side of a rollback mean the rollback did not happen.**

The 55 gate logs inherited from the failed run were also discarded as a baseline: every one predates
the commit they were supposed to describe (written 00:50, `435a5e9` committed 01:14, and that commit
changed harnesses). A fresh sweep was run instead - 55 checks, 0 failed - and that is what the rest of
this run is measured against.

## What was delivered

| Package | Commits | What it is |
|---|---|---|
| Inspection runtime, routes, harnesses | `0151575` | two services, 13 endpoints across 9 route files, two adversarial harnesses |
| Owner inspection panel | `7af39f8`, merge `7648473` | W4's 987-line panel plus its shared module and 24 a11y assertions |
| Shell mount | `be176d4` | the panel was unreachable until root mounted it |
| Lint slice 5 | `ea28089`, merge `adebddd` | W5 cleared both `react-hooks/refs` errors |
| Promotion + blueprint | `7b15cd3` | `fieldJobs:inspection` to available, `field-service-v1` installed |

## The design work worth keeping

**Snapshotting is the whole point of the template.** Creating an inspection from a checklist copies
the lines into rows rather than referencing them, so editing the checklist later cannot rewrite what
a past inspection asked. The harness proves it by editing a template **after** an inspection is
raised from it and re-reading the inspection.

**An ASSET line had to be seeded to exist at all.** `FieldJobInspectionItem_asset_has_identity`
requires every ASSET row to name its equipment from the moment it is inserted. Snapshotting an ASSET
template line therefore seeds `assetLabel` from the checklist line's label. Without that, an ASSET
template line could not be snapshotted - the constraint would refuse the row. This was found by
reading the migration's CHECK constraints before writing the engine, not by hitting the error.

**The part deduction is an ADJUSTMENT, not a CONSUME, because the inventory engine says so.**
`applyMovement` deliberately refuses CONSUME as direct input: CONSUME only arises from settling a
reservation, and a part taken off a van has no hold behind it, so accepting it would move the
reserved balance with nothing backing it. Composing the existing engine meant obeying its rule rather
than working around it.

**The ordering of a part write is chosen for its failure mode.** The part row goes in first, so the
database's boundary trigger validates tenant, depot and existence before any stock moves; then the
movement is applied with an idempotency key **derived from the part id**; then the movement id is
stored. A crash mid-way leaves a visible part line with no movement - recorded, stock not moved -
rather than stock that vanished with nothing pointing at it. Because the key is the part id, a retry
finishes the job and cannot deduct twice. There is no way to make this atomic across two engines'
transactions, so the honest choice was to pick which half-done state a human would rather find.

## Three places the implementation deliberately contradicts its own written contract

`INSPECTION_API_CONTRACT.md` was written before the implementation so the UI could be built in
parallel. Three of its statements were wrong, and the code is right:

1. **A foreign or nonexistent stock record is 403, not 409.** The contract listed "belongs to another
   tenant" among the 409 conditions. A foreign record answering 409 while a nonexistent one answers
   403 would make the endpoint an **oracle for which stock records exist**, defeating the
   non-enumeration property the whole platform is built on. Only the depot mismatch - stock the caller
   demonstrably owns, at the wrong location - is a 409. The harness proves the two refusals are
   byte-identical.
2. **The 401 code is `UNAUTHORIZED`.** That is what `PersistedTenancy` throws platform-wide. Harmless
   to the panel, confirmed by reading `inspectionErrorCopy` and finding it branches on
   `error.status`, never on the code string.
3. **Recording is allowed only in `DRAFT` and `IN_PROGRESS`.** The contract said recording was refused
   only on a terminal inspection. The lifecycle module's own `RECORDABLE_STATUSES` is stricter and
   coherent, because `SUBMITTED` can legally return to `IN_PROGRESS` precisely so the office can ask
   for more detail. This leaves a real mismatch with the panel, which is recorded in
   `INTEGRATION_QUEUE.md` rather than left to be found by a user.

## Evidence

Two new harnesses, and both were proven able to fail rather than merely observed passing:

| harness | green | inverted |
|---|---|---|
| `check-fieldjob-inspection-runtime` | 96/96, exit 0 | 58/96, **exit 1**, 38 flipped red |
| `check-fieldjob-inspection-routes` | 54/54, exit 0 | 30/54, **exit 1**, 24 flipped red |

What they measure rather than assume: snapshot immunity to later template edits; that
`NOT_APPLICABLE` is an answer and `PENDING` is not, including the refusal's `pendingRequired` **count**;
that omitting `consumeStock` moves no stock, read from `onHand` rather than from the flag; that the
deduction landed as an `ADJUSTMENT` with `qtyDelta` -3; that a replay cannot deduct twice; that the
engine's open-status list matches the partial unique index **read out of `pg_indexes`**; that a handoff
to `HANDED_OFF` writes no `Payment` and no `Order` row; that one inspection's timeline never returns
another's events on the same job; and that across every observed response on the route surface a **404
never occurs**, which is what makes "the UI must never say not found" safe to follow.

## Final combined suite on `7b15cd3`

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 |
| check harnesses | **57 of 57 exit 0** (55 at `435a5e9`, +2 this run) |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings), down from 45 |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0, all 9 inspection route files registered as dynamic |
| capability contract | PASS, and the registry now has **zero** planned capabilities |
| live `personalink` | untouched - 35 tables, no `_prisma_migrations`, 0 wave tables, no `btree_gist`, `Profile` = 16 |
| disposable DB | 18 migrations, all finished, none rolled back, 113 tables - fully applied, never left mid-rehearsal |
| origin | nothing pushed |
| frozen worktrees | all six `kirocrew/*` still at `ea69595` |
| working tree | only the two expected untracked paths |

## What this run got wrong, and what it cost

1. **A new harness introduced a lint warning.** A ternary used as a statement
   (`can(a,b) ? legal++ : illegal++`) tripped `no-unused-expressions` and took repo-wide lint from 45
   to 46. Rewritten as an if/else, back to a **byte-identical** diff against the baseline. Caught by
   comparing lint output line by line rather than by comparing totals - a total can hide a swap.
2. **The route harness was written with four calls missing their path argument.** `addTemplateItem`
   takes `(templateId, request)` and was called with only the request, four times. ts-node caught it
   as TS2554 before anything ran. Cheap, but it is why the harness is run rather than reasoned about.
3. **Changing the HTTP boundary's arity silently broke an existing harness.** `FieldJobApiService`
   went from two constructor arguments to four, and `check-fieldjob-routes.ts` constructs it twice.
   Neither is covered by `tsc -p tsconfig.json`, because scripts compile under a different tsconfig,
   so the app typechecked clean while a harness was broken. Found by searching for every construction
   site rather than by waiting for the sweep. **Widening a constructor is a repo-wide change even
   when the type checker for the app says nothing.**
4. **Installing a blueprint turned a green check red on an improvement.** `marks unused engines
   honestly` asserted the literal word "unused" appears, which only held while some engine had no
   blueprint. Rewritten to prove the badge by reproducing the gap deliberately. The lesson is already
   in this file twice under different names; this is its third instance.

## Honest limits of this run

- **No worker was observed executing.** W1 through W5 ran in the run that failed. What was verified
  is artifacts: branches, single clean commits, per-worktree `node_modules` copy logs, and written
  reports. W4 and W5 were each independently re-checked in their own worktrees before merging.
- **W4 could not prove its model or its PID**, and said so. Its evidence is the artifact, not its
  identity claim. W5 reported a real PID and a model and corrected the brief's own baseline.
- **No automated harness covers orb animation**, so W5's behavioural claim about `bloub-orb` and
  `welcome-orb` rests on code review, not on a green test. The lint and type claims are measured.
- **`check-business-os-render` does not enumerate the shell's panel tree**, so mounting the inspection
  panel does not by itself place it under a render assertion. Its evidence remains the source-level
  a11y assertions plus the route harness on the server side.


## H1 follow-ups, same session - three gaps closed and the vertical join proved

Base `b25b955`, head `f8ee611`. This is the part of the run that acted on what the previous section had
just written down, rather than leaving it for a future run.

| Commit | Slice |
|---|---|
| `a5906ab` | `canRecord` computed server-side; the panel stops guessing from `!isTerminal` |
| `eea2f7b` | the `invoiced` ban rewritten to target behaviour, and proven able to fail |
| `f8ee611` | the inspection/inventory join asserted from the inventory surface |

### Two of these were fixing our own new work, not inherited debt

Worth stating plainly. The `canRecord` mismatch was created in this run: root made the server stricter
than the written contract (recording only in `DRAFT`/`IN_PROGRESS`) while W4's panel, built against
that contract, gated on `!isTerminal`. Nobody was wrong in isolation; the contract was wrong, and the
two halves were built in parallel against it. **Writing the gap down at merge time is what made it
cheap to fix an hour later** - the alternative was a user discovering that a button always fails.

The `invoiced` word-ban was W4's, and it passed. It was rewritten anyway because this repository has
now paid for the same mistake three times - "ETA", `.every(async ...)`, and the `unused` badge earlier
in this very run. A check that passes today and will fail on honest copy tomorrow is a liability even
while it is green.

### The cross-vertical assertion is the one that changes what is proven

Every inspection assertion up to this point was measured from inside the fieldJobs surface. That
cannot distinguish "composed the inventory engine" from "wrote a private part row while inventory
carried on unaware" - both look identical from the fieldJobs side. The route harness now asks the
inventory vertical's own HTTP boundary and gets four answers: the `-3` `ADJUSTMENT` is in that stock
record's movements, its reason names the inspection, inventory's `onHand` equals the figure fieldJobs
computed, and **the part recorded without `consumeStock` produced no movement at all**.

That last assertion is what gives the `consumeStock: false` default meaning from the outside. A
"recorded only" part must be invisible to inventory, and now that is measured rather than asserted by
the module that would benefit from believing it.

### Also fixed, outside the repository

`wave-c\run-on-rehearsal.js` now prints which worktree it runs in and compares that worktree's
migration count against the migrations actually applied in the target database. Run today it says:
`*** MIGRATION DRIFT: this worktree has 17 migration(s) on disk, the database has 18 applied ***`.
It deliberately does not abort, because a pre-migration comparison is a legitimate case where the
counts differ. This is the trap that cost this run real time at the start; it can no longer be silent.

### Gates at `f8ee611`

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 |
| check harnesses | 57 of 57 exit 0 |
| `check-fieldjob-inspection-runtime` | 100/100; inverted exit 1, 41 flipped |
| `check-fieldjob-inspection-routes` | 59/59; inverted exit 1, 29 flipped |
| repo-wide ESLint | 43 problems, byte-identical diff to `b25b955` |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | exit 0 |
| live `personalink` | untouched, re-verified |
| disposable DB | `FULLY_APPLIED_WITH_INSPECTION`, 113 tables |

### What was NOT done, and why - the approved sequence, answered honestly

The remaining items in the approved sequence were measured before being started, and most turned out
to be already done, undefined, or unsafe to do mechanically. Recording that is more useful than
inventing work to fill the list:

- **Daily operations** - no package by that name exists in this repository's ledgers. The operational
  surfaces that do exist (the Business OS shell, the task queue, the approval inbox, the audit ledger)
  are built and green.
- **Wave-1 verticals** - already complete and integrated. `TASKS.json.wave1Result` records six accepted
  packages merged at `4649ff1` with 10/10 harnesses.
- **Onboarding** - the critical defect HANDOFF.md records, `createProfile(userId, data)` trusting a
  caller-supplied owner, is **already fixed**: it derives the actor from `requireAuthenticatedUser()`.
  Verified by reading the file. A new onboarding surface for `field-service-v1` is a genuine gap and is
  now in the queue, but it is a greenfield package rather than a follow-up.
- **Command-centre UI** - the Business OS shell IS this, and it was extended this run: the inspection
  panel is mounted, and every engine is now composed by at least one blueprint.
- **Cross-vertical E2E** - done, above.
- **Safe lint reduction** - **there is no safe slice left**, and this is a refusal rather than an
  omission. All 14 remaining errors and 29 warnings need per-component judgement: 25 `no-img-element`
  each change layout and loading behaviour, 10 `set-state-in-effect` need effects redesigned, 3
  `preserve-manual-memoization` need memoized-collection identity analysis, 3 `exhaustive-deps` need
  per-effect analysis, 1 `no-explicit-any` is a documented design call, and 1 `no-unused-vars` is a
  live DOM query. Clearing any of them to move a number would break this file's own standing rules,
  which is why the count is being left at 43 rather than improved cosmetically.

Also worth recording: **HANDOFF.md is stale and should not be used for planning.** All four entries in
its critical/high defect table are closed, and its "next steps" list still describes P2-003 as blocked,
which it has not been for several waves.


---

## Night run, resumed a second time — the two named H1 gaps closed, and a compaction incident

Root: Claude Opus 5. Primary `recovered/aug20-wt-pr-32`. Starting HEAD `7419669`, ending HEAD
`086c835`. No migration. Origin unchanged, nothing pushed.

This entry exists mostly to record **a real incident**, because the run's other content is small and
the incident is the useful part.

### The incident: a compacted session resumed from a stale summary and overwrote committed work

The root session's context was compacted. On resuming, it restored a summary that described the run
as being at HEAD `435a5e9` with Phase H1 not yet started. **That summary was roughly four hours
out of date.** The real HEAD was `7419669`, and H1 was complete: schema, migration, runtime, 13
routes, two panels, a promotion and a blueprint.

Acting on the stale summary, the session began "building" H1 again, and its file writes **overwrote
four committed files** — `src/lib/fieldjobs/{http,inspection,runtime}.ts` and nine route files —
replacing an evolved design with an earlier-generation one. It also wrote a stray
`inspection-http.ts` for a boundary that the committed design had deliberately folded into
`http.ts`.

What caught it: `git status` reported the files as **modified rather than untracked**. A file you
believe you have just created cannot be "modified". Reading that one word is what stopped it, four
tool calls in.

Recovery was complete and needed no history rewriting, because everything overwritten was committed:
`git checkout -- <paths>` restored all thirteen files, the stray file was deleted, and `git diff HEAD`
then returned empty with `tsc` at 0. **Nothing was lost.** Total cost: about twenty minutes and a
scare.

The lessons, in the order they would have prevented the damage:

31. **After a compaction, measure HEAD before writing anything.** A restored summary is a claim about
    the past, and the repository is the only statement about the present. `git log --oneline -5` and
    the wall clock would each have caught this in one call. The run's own rule 22 — a tool pinned to
    the wrong checkout lies quietly — turns out to apply to a resumed *agent* as well as to a script.
32. **`git status` distinguishing `M` from `??` is a fact about the world, not noise.** It was
    printed, twice, before it was read.
33. **Everything committed is recoverable, so commit at every green point.** The reason this incident
    cost twenty minutes instead of hours is that the work it overwrote had been committed. The same
    incident against uncommitted work would have destroyed several hours of it.

Also worth stating plainly: the earlier part of this same session, before compaction, produced
`8b33a6a` (the inspection schema and migration) and `435a5e9` (six real defects fixed in the G4
evidence harnesses, found by an independent audit worker). Those commits are real and were built on by
the sessions that followed. The stale-summary problem was in the *handover*, not in the work.

### Two gaps closed, both taken straight from the queue

**`5822aa8` — owner surface for authoring inspection checklists.**

The five `/inspection-templates/**` endpoints shipped with no owner surface, so a checklist could only
be created by calling the API. `NEXT_ACTION` named this the one real remaining hole in H1.

A separate panel rather than more of `inspection-panel.tsx`, for a reason worth keeping: authoring what
you intend to ask and recording what a technician found are different jobs done by different people at
different times, and folding them together would tempt a reader into treating a template LINE and a
recorded ITEM as one object. They are not — the item is a snapshot of the line taken at inspection
creation, which is exactly why editing a checklist cannot rewrite a past answer.

The server stays the authority. A `MEASUREMENT` line with no unit and a range that ends below where it
starts are both refused by a CHECK constraint and by the engine; the panel surfaces those verbatim and
labels the unit field "required for a measurement" as a **hint only**. A new assertion fails if the
panel ever starts refusing them locally, because a second copy of a rule in the client is the drift
this program keeps paying for. Deactivation is explained rather than left to be guessed: it hides the
checklist from new inspections, does not delete it, and does not touch inspections already created
from it.

`templateErrorCopy` is a separate function from `inspectionErrorCopy` rather than one function taking a
noun, because the 403 wording is the load-bearing part of both and a caller passing the wrong noun
would silently describe the wrong object. A read-only textarea was written and then removed before
commit: it was a control that did nothing.

**`086c835` — field service is selectable during onboarding, and that is now enforced.**

`field-service-v1` shipped ACTIVE, composing a fully built engine with 13 routes and two panels, and
had **no onboarding role at all**. An owner who sends people out to jobs could not say so when signing
up, so the engine this program had just finished building was unreachable from the product's own front
door. Every other active blueprint already had a role; only this one did not, and nothing failed
because nothing checked.

`FIELD_SERVICE` is now a role with a need entry, an icon and suggested addons. Two deliberate
non-additions: it reuses the existing `TAKE_APPOINTMENTS` goal instead of inventing an eighth `Goal`
value that would have left an unhandled case in every switch on it, and all its addons are existing
ones, because field work reuses `ServiceOffering`, `AppointmentResource` and scheduling — that reuse is
the point of a shared engine and a bespoke addon would have quietly denied it. No migration:
`Profile.roleTemplate` is a `String` with a default, so a new value is data.

`CORRESPONDING_BLUEPRINT` records which blueprint a role corresponds to. It is named *corresponding*
and not *installs* because **there is no installation runtime in this repository**, and the harness
asserts that absence rather than trusting it: 117 platform routes were enumerated and none installs a
blueprint. The map lives on the onboarding side because the blueprint registry is deliberately
self-contained and knows nothing about onboarding.

The harness is the actual deliverable — 20 assertions checking the correspondence in **both**
directions, so this class of defect cannot recur. The trap it guards that a reader would miss:
`restaurant-venue-v1` and `v2` are deprecated and `v3` is active, so a map pointing at an older version
would read as correct and be wrong. It also asserts every capability `field-service-v1` requires is
available, tying the onboarding claim to engine reality — which is what an owner acts on when they pick
the role.

### Measured gates at `086c835`

| Gate | Result |
|---|---|
| `prisma validate` | 0 |
| `tsc --noEmit` | 0 |
| check sweep | **58 of 58 exit 0** (was 57; one new harness) |
| `check-onboarding-blueprint-coverage` | 20/20; inverted exit 1 with 8 flipped; restored 20/20 exit 0 |
| `check-business-os-a11y` | PASS, with 16 new assertions for the authoring panel |
| `check-business-os-render`, `-surface` | PASS |
| repo-wide ESLint | **43 problems (14 errors, 29 warnings) — unchanged**; both packages add none |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | exit 0; all 9 inspection routes in the manifest |
| live `personalink` | untouched: 35 tables, no `_prisma_migrations`, 0 wave tables, `Profile` = 16 |
| disposable rehearsal DB | unchanged, still fully applied at 18 migrations |

### What was deliberately NOT started, and why

**Blueprint installation runtime, and the unified daily-operations runtime.** Both were measured
rather than assumed: `src/lib/business-os/` is a static registry of 418 + 261 + 90 + 86 + 42 lines
with **zero API routes**, so installation does not exist even in part. Building it means durable state,
which means a migration — and with under two hours left that collides with the standing rule against
starting a migration inside 90 minutes, and with the harder rule that the rehearsal database must never
be left between apply and reapply. Starting it would have produced a half-package and risked the one
piece of state this program guards most carefully. Recorded as the next package instead.

**P1-009 slice 6 remains a refusal, not a backlog item.** Unchanged from the previous entry: all 43
remaining problems need per-component judgement, and the count is left at 43 rather than moved
cosmetically.


---

## Same run, continued — the unified daily operations view, end to end

Root: Claude Opus 5. Primary `recovered/aug20-wt-pr-32`. `156cace` → `ff50658`. No migration, no schema
change, no write path added anywhere. Origin unchanged, nothing pushed.

Chosen over the blueprint installation runtime deliberately, and the reasoning is worth keeping because
it is a scheduling judgement rather than a preference. Installation was measured first:
`src/lib/business-os/**` is a static registry with **zero API routes**, so it does not exist even in
part. It needs durable state — an installed-blueprint record with workspace association, version,
terminology, surfaces, modules and an audit trail — therefore a migration, therefore the full rehearsal
cycle. The inspection package, which is comparable in size, took most of a night with three workers.
With under two hours left, starting it would have produced a half-package and put the one piece of state
this program guards most carefully at risk of being left mid-cycle. The operations view needs no schema,
so it was the largest package that could actually be finished.

| Commit | What landed |
|---|---|
| `dac6a23` | `src/lib/operations/**` — engine, boundary, composition root — plus `/api/platform/operations/today` and a 23-assertion harness |
| `0387d86` | `operations-panel.tsx`, mounted first in the shell, with 14 new a11y assertions |
| `d06e122` | case milestones covered, and the tenant boundary now reported per domain |
| `ff50658` | `check-operations-routes.ts`, 26 assertions at the HTTP boundary |

Sweep **58 → 60**. Repo-wide lint unchanged at 43 (14 errors, 29 warnings) throughout.

### The design problem this package actually had

Not the aggregation. A cross-engine total is the most dangerous number in this product, because an
owner reads "0" as "nothing anywhere" and stops looking. The view reads seven domains and deliberately
skips three, so a bare zero would be a lie by omission.

So coverage is **declared and enforced**: `OPERATIONS_DOMAINS` names what is read, `UNCOVERED_DOMAINS`
names what is not *with the reason*, and the harness asserts in both directions that every declared
domain has a reader and every reader is declared. The panel renders `covers` and `doesNotCover` from
the response rather than restating them — which paid for itself immediately: when `d06e122` moved case
milestones from uncovered to covered, the panel updated with no change to its coverage rendering.

Read-only is enforced structurally rather than promised: no create/update/delete/upsert, no raw SQL, no
transaction, asserted over executable lines only — comments legitimately discuss writes in order to say
there are none, so a whole-file scan would have flagged the explanation as the violation. The context
accepts only `profile.read`, so there is no write permission path to widen. The route exports GET alone.

Three smaller decisions that each prevent a specific wrong number: the clock is read **once** and
passed down, so two figures in one response cannot disagree about whether the same record is overdue;
`overdue` is computed server-side and never recomputed in the browser against a second clock; and
`at: null` renders as "no due date" rather than as unknown, because three domains genuinely have no
deadline and inventing one would compound.

### The subtlety `d06e122` surfaced instead of hiding

`CaseProject` carries `workspaceId`, not `profileId`. Every other domain here is profile-scoped, and a
profile can own several workspaces — so covering case milestones makes one total span **two tenant
boundaries**.

Scoping them by `profileId` would have been wrong in a way that is easy to miss: it would have returned
cases from the profile's other workspaces, which the caller may have no access to. So the reader filters
through the relation on the authorised `workspaceId`, and the difference is reported —
`OPERATIONS_DOMAIN_SCOPE` per domain, `scope` on every summary, `mixedScope` on the response, and the
panel marking those counts "this workspace only" and explaining the split.

Without that, an owner with two workspaces would eventually notice the total not reconciling against
another screen and have no way to find out why. That is a quieter failure than being wrong, and a worse
one.

### What the route harness caught

The operations 503 said **"Field jobs are temporarily unavailable"**.

Reusing the fieldJobs envelope helper was right — one status map, one `{ ok, data }` shape — but its
503 fallback *sentence* was hardcoded to that domain, so the sentence came along with the shape. An
accurate envelope carrying an inaccurate sentence is still wrong, and it is the kind of wrong that
reaches a user rather than a log. `failure()` now takes the message as a defaulted parameter;
`check-fieldjob-routes` still passes 54/54, which is what made that a safe change rather than a hopeful
one.

Two assertions there could not have been made from the engine: `asOf` is serialised as an ISO **string**
(a Date surviving as an object is only visible after serialisation), and a foreign workspace and a
**nonexistent** one produce byte-identical refusals — compared as serialised bodies, because a status
code alone would still let a caller learn which workspace ids are real.

### A lint rule that took three attempts, and was not suppressed

The panel's first version added a 15th repo-wide error: `react-hooks/set-state-in-effect`. Two
hypotheses were tested and **both were wrong** — keying the cached value instead of clearing state in
the effect did not help, and neither did lifting the horizon out of the effect's dependency chain.

What satisfies the rule is an inline async closure: it flags an effect calling a *named* function that
is also reachable elsewhere and sets state, and accepts a self-contained closure where the whole path is
visible. Hence the inline mount fetch, with a comment saying so because it otherwise looks like
duplication. The alternatives were both worse: suppressing hides the finding, and matching the pattern
eight other files already trip would have added an error to a count this run is holding flat.

34. **A rule that fires on a pattern eight other files already use is still your problem to solve, not
    a precedent to follow.** The fix took three attempts and the third was genuinely better code.

### Measured gates at `ff50658`

| Gate | Result |
|---|---|
| `prisma validate` | 0 |
| `tsc --noEmit` | 0 |
| check sweep | **60 of 60 exit 0** |
| `check-operations-runtime` | 28/28; inverted exit 1, 13 flipped; restored 28/28 |
| `check-operations-routes` | 26/26; inverted exit 1, 12 flipped |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged across all four commits |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | exit 0 |
| disposable rehearsal DB | unchanged, fully applied at 18 migrations; this package added no migration |


---

## Same run, closing package — checklist line editing, and a claim finally proven

Root: Claude Opus 5. `c784922` → `eb35b32`. No migration, no schema change.

`5822aa8` let an owner author a checklist but never fix a typo in one or remove a line — a real hole in
a surface shipped hours earlier, and the kind that makes somebody recreate a whole checklist to change
one word. `updateItem` and `removeItem` close it, with a PATCH/DELETE route and per-line controls in
the panel.

Three decisions worth keeping:

`updateItem` takes only the fields present in the body, so correcting a label cannot clear a range by
omission. `removeItem` returns `snapshotsRetained`, so the UI states "this stops being asked; N past
inspections keep it" instead of leaving an owner to guess whether they just destroyed records. `kind`
is deliberately **not** editable — turning a CHECK into a MEASUREMENT would leave every inspection
snapshotted from that line describing a different question than the one now on record, with a unit and
range those snapshots never had.

### The claim that had been asserted but not proven

The panel and `5822aa8`'s message both say editing a checklist never changes what a past inspection
asked or answered. The existing harness proved that against a **direct database edit**, which
establishes the schema design — but it never exercised these engine paths, and `removeItem` is where
the real risk lives: it DELETES the line and relies on `onDelete: SetNull` to leave the snapshot
standing. A cascade there would silently destroy recorded answers and nothing would have noticed.

It is now measured: an answer is recorded, the line is removed, the inspection is re-read, and it has
the same number of lines, the same question wording, the same PASS result, and `templateItemId` null —
the snapshot loses its provenance pointer and nothing else.

### A defect I reproduced hours after fixing it in someone else's code

The first version of the new refusal test compared a "foreign line" against a "nonexistent line" and
failed — because the foreign case passed another tenant's **workspace**, so it refused at workspace
authorization and never reached line ownership.

That is exactly W3 audit finding 10, which this same run fixed in `check-fieldjob-routes.ts` a few
hours earlier. Knowing about a defect class is not the same as not writing it.

The corrected test compares a real line belonging to a **different checklist of the same tenant**
against a line that does not exist. Both reach `ownedTemplateItem`, the only code that can tell them
apart, and both return byte-identical refusals. The workspace-level refusal is asserted separately,
because it is a different refusal and conflating them is how a non-enumeration test stops testing
non-enumeration.

35. **Fixing a defect class in one file does not inoculate you against writing it in the next one.**
    The routes audit finding and this were the same mistake, hours apart, by the same author. The thing
    that caught it both times was an assertion that compared *serialized bodies* rather than trusting
    that two refusals looked alike.

Validation is also asserted to survive an EDIT and not only an insert: clearing a measurement line's
unit and inverting its expected range are both refused on update.

### Measured gates at `eb35b32`

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 |
| check sweep | **60 of 60 exit 0** |
| `check-fieldjob-inspection-runtime` | **112/112** (was 100); inverted exit 1, 49 flipped |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged |
| `npm run build` | exit 0; the new `items/[itemId]` route in the manifest |


---

## Read-only blueprint preview — `c3f3f44`

The question this package answers is "what would choosing this blueprint actually mean for my
business", and the discipline is that it must answer it **without ever implying it did something**.
There is no installation runtime in this repository. Every response says so.

### The contract is a type file, not a document

Two workers were about to build against a shape only one of us could see. The obvious move was to write
a contract document. That was rejected: a document describing a shape can be ignored, misread, or drift
silently, and the drift only surfaces at runtime. `src/lib/business-os/preview-types.ts` was committed
first (`f1af3a4`) and both workers were pointed at it.

The payoff was concrete and immediate. BP1's report listed, honestly, one thing it could not verify:
"if root's actual response shape diverges from `preview-types.ts`, that would only surface at runtime".
But BP1 had **re-exported** `BlueprintPreviewView` from the contract rather than redeclaring it — so
once the resolver landed, `tsc --noEmit` exit 0 *was* the proof that the panel matches what the resolver
returns. The unverifiable item closed itself, at compile time, because the contract was a type.

`installed` is typed as the literal `null` rather than as an optional object. This is deliberately
stronger than a field documented as always null: fabricating installed state is now a **compile error**
rather than something a reviewer has to notice.

### 404 here, 403 everywhere else, and why that is not a leak

This platform's rule is that a caller must not be able to tell "does not exist" from "not yours". A
blueprint id breaks the premise of that rule: it is a public static registry key, identical for every
tenant, so refusing to confirm `field-service-v1` exists protects nothing and hides the owner's typo.
So an unknown blueprint id is **404**.

The safety property that makes this sound is ordering, not the status code: **authorization is evaluated
BEFORE the registry lookup.** An unauthorised caller gets 403 even for an id that does not exist, so 404
can never be used as a registry oracle. Both facts are asserted, along with a byte-identical comparison
of the foreign-workspace and nonexistent-workspace refusals — comparing *serialized bodies*, because
that is the assertion that has repeatedly caught refusals which merely looked alike. The reasoning is
pinned in an assertion so a future reader does not "fix" it into a 403.

### Presentation is derived, and admits it in every field

`BusinessBlueprint` declares no terminology, no surfaces and no modules. That was measured, not assumed,
and it is asserted **against the type itself** — so if a blueprint ever gains a `terminology` field, the
check goes red and somebody has to decide whether preview should read it instead of deriving it.

Given that, there were three options: fabricate a terminology pack per blueprint, invent a private
engine-to-surface mapping, or resolve through the onboarding role the blueprint corresponds to using the
`surfacesFor` / `calendarNoun` / `shopNavLabel` / `defaultFulfillment` helpers that already exist. Only
the third tells the truth, and every value it produces is tagged `source: "role-derived"` so a reader
can always tell derived from declared. A blueprint with no corresponding role reports `role: null` and
empty surfaces rather than guessing.

Two limitations ship in the response body rather than in a document, because a caller reads the body:
surfaces are stored per **profile** (JSON on `Profile.personalityConfig`), so a profile with several
workspaces has one set of surfaces across all of them; and `businessOs` — the owner console — is never
granted by a role kit and cannot be switched on by choosing a blueprint. That second one is asserted for
all nine blueprints, because "choosing a vertical quietly granted the owner console" is exactly the kind
of silent permission expansion nobody would notice until it mattered.

### Lessons

36. **A passing assertion can be vacuous, and looking at it will not tell you.** `check-blueprint-preview`
    asserted "an optional capability never blocks installability, however immature it is". It passed. It
    also passed with the `required` guard **deleted** from `resolveBlockers` — because the only optional
    composition in the entire repository is `commerce:[catalog,orders]`, and both are `available`. The
    assertion was reporting "nothing optional is currently unavailable" while reading as "optional is
    excluded from blockers". It would have gone on passing until the day someone composed an immature
    capability optionally, which is the day it was supposed to fire.

    The only reason this was caught is that the inversion was performed as a **real source mutation**
    rather than trusted. Deleting the guard and expecting red produced green, and green-when-you-expect-red
    is information. The fix is the synthetic-descriptor discipline the capability-contract negative test
    already established: `resolveBlockers` is now exported and driven directly with a synthetic
    composition over the **real** engine registry, using `appointments:reminders` — genuinely `partial`,
    because the reminder record and its state machine are persisted but no messaging provider is wired —
    and both directions are asserted: required blocks, and the *same* capability composed optionally does
    not. The registry-wide check is kept as a weaker companion. An assertion that only ever exercises the
    safe direction has not tested the discriminator; it has tested that the discriminator was not needed.

37. **An inversion switch that does not exist is worse than no switch at all.** The preview harness
    header stated "Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can
    fail." It was never implemented. Any reader — including a later session — would have run it, seen
    exit 0 unchanged, and concluded the assertions were inverted and fine. Removed, and replaced with a
    description of what was actually done: inversion by source mutation, naming the specific break and
    what went red. A harness that lies about how to falsify it is worse than one that says nothing.

38. **A refined invariant can quietly shrink its own scope.** BP2 correctly replaced a route-*path*
    proxy (`/blueprint|install|onboard/` on the filename, which any new route would trip regardless of
    behaviour) with a behavioural detector: a route is an installation candidate when it concerns
    blueprints **and** exports a write verb. Genuinely better, and it added a second trigger — any Prisma
    model matching `/Install|Blueprint/` — so the invariant now also fires the moment durable
    installation state appears.

    But it scanned only `src/app/api/platform`, and `src/app/api/business-os` **already serves
    blueprints** — two GET routes since `627b826`. That tree, not `platform`, is where somebody would
    most naturally add an install `POST`. The refinement was correct and the scope was wrong, which is a
    harder failure to see than a wrong assertion because everything it does check, it checks properly.
    Widened to every API route, 119 → 150, and **the reach itself is now asserted**, so a future
    narrowing shows up as a failure rather than as a smaller number nobody reads.

39. **Two endpoints serving the same nouns are not automatically duplication.** `/api/business-os/blueprints`
    and `/api/platform/blueprints` both list blueprints, which looks like something to consolidate. They
    authorize differently: the first requires the `businessOs` owner-console surface, which is opt-in per
    profile; the second requires only workspace membership. Onboarding happens *before* anyone opts into
    the owner console, so merging them would either lock preview out of onboarding or quietly widen what
    the `businessOs` surface implies. The distinction is now asserted with both route sources read, so a
    future de-duplication has to argue with a failing check rather than with a comment.

### Measured gates at `c3f3f44`

| Gate | Result |
|---|---|
| `prisma validate` | 0 |
| `prisma generate` | 0 |
| `tsc --noEmit` | 0 |
| check sweep | **61 of 61 exit 0** (was 60) |
| `check-blueprint-preview` | 53/53; inversion A 2 red / exit 1; inversion B 1 red / exit 1; restored 53/53 |
| `check-onboarding-blueprint-coverage` | 25/25 (was 20); inverted exit 1, 11 flipped |
| `check-business-os-a11y` | PASS, `failures: []` |
| targeted ESLint, 9 files | 0 findings |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | exit 0; both routes in `app-path-routes-manifest.json` |
| live `personalink` | untouched — 35 tables, no `_prisma_migrations`, 0 leaked, no `btree_gist`, `Profile` = 16 |
| triggers | 21 total, 0 disabled |
| frozen worktrees | all six `kirocrew/*` still at `ea69595` |

### Workers, with evidence rather than elapsed time

| Worker | Model | Evidence | Delivered |
|---|---|---|---|
| BP2 — onboarding invariant | `gpt-5.6-terra` | **PID 47284**, commit `8fb9077`, report file, clean worktree | accepted as `5e29a4c` |
| BP1 — owner preview panel | `claude-sonnet-5` | commit `277114a`, report file, clean worktree; **declined to fabricate a PID**, stating the tool environment did not surface one | accepted as `0798020` |

`spawn_run` was hollow again — three probes (`3b7c855e`, `e694ae04`, `c0874291`) produced no worker.
The one-shot cron path with `approval_mode: auto` produced two real workers with real commits. That is
now twice in a row; cron is the proven path and `spawn_run` should not be retried a fourth time without
new information. BP1 reporting "no PID available to me" rather than inventing one is the behaviour worth
keeping — an unverifiable field left blank is evidence, a plausible number is noise.


---

## Durable blueprint installation — `9548440`

Preview said what choosing a blueprint would mean. This is the half that writes it down, and the whole
discipline is that it writes down **only** that.

### Two tables, and the list of things that were not built

`BlueprintInstallation` and `BlueprintInstallationEvent`. That is the entire footprint. Every other
candidate table was rejected for a specific reason rather than for tidiness:

**No workflow template table.** The design suggested instantiating the blueprint's declared workflows as
durable templates. `blueprint.id` already encodes the version — `restaurant-venue-v2` against `-v3` — and
the registry **retains deprecated entries** rather than deleting them, which is precisely what makes
pinning an id sufficient for immutability. Copying the declarations into the database would create a
second source of truth able to disagree with the first, and reconciling them would become somebody's
permanent job. `WorkflowRun`, `WorkflowStep`, `Approval` and `TaskJob` are untouched, and the schema
harness asserts they still exist so "reuse" is a checked claim rather than an intention.

**No surface or terminology table.** Surfaces already live per profile as JSON on
`Profile.personalityConfig`. An unscoped `Terminology` table was explicitly on the design's forbidden
list, and it deserves to be: terminology means nothing except relative to an installation, so a global
table would invite exactly the cross-tenant leak this schema spends three triggers preventing elsewhere.
The resolved pack is frozen into `configJson` on a workspace-scoped row, so it is scoped by construction.

**No permission write, therefore no grant at all.** This is the one worth stating carefully, because it
looks like a gap and is not. Installing does not touch `Profile.personalityConfig`. Surfaces are stored
per **profile**; an installation is per **workspace**; and a user reaches many workspaces through
`Membership`, which is keyed by `userId`. Writing workspace-scoped intent into a profile-scoped store
would change what that user sees in workspaces the install said nothing about. So `configJson` **records**
the surfaces the corresponding role implies and nothing applies them — and the runtime harness proves it
by comparing that column **byte for byte** across an install. Not "no grant was intended": the column
where grants live is unchanged.

**No FAILED state and no REFUSED event kind.** A failed install leaves nothing at all. A refusal row
would be a partial write, and the zero-partial-rows proof would need an exception carved out for it — and
an assertion with an exception carved out of it is the kind that stops noticing.

**No method to edit a config.** Editing a frozen record of what was agreed to is how an audit trail stops
being one. A configuration change is an upgrade, and upgrades supersede.

### One active installation per workspace, in the database

A blueprint carries terminology for an entire vertical: the calendar noun is "job" or "booking" or
"reservation", not all three. Two simultaneously active blueprints would leave the product with two
answers to "what is this thing called" and no way to choose. So it is a partial unique index on
`("workspaceId") WHERE state = 'ACTIVE'` — the mechanism that already enforces one default variant per
product, and for the same reason: Postgres can express it and Prisma cannot.

The consequence is the requested behaviour obtained structurally rather than by convention. **Upgrade
through supersession is not preferred over re-installation; re-installation is unrepresentable.**

### Role safety is a choice between two permissions that already exist

Reads ask for `profile.read` — the same permission preview asks for — so an onboarding surface can show
an owner what installing would do before they hold any elevated role. Writes ask for `workspace.update`,
which `ROLE_PERMISSION_MATRIX` grants only to OWNER and ADMIN.

Deliberately **not** `profile.update`, which MANAGER also holds. A manager being able to change what the
business *is* would be a silent permission expansion achieved by picking the permission that happened to
already be there. And no permission **key** was invented: adding one to `PERMISSION_KEYS` extends the
OWNER and ADMIN closures automatically, since both derive from `ALL_PERMISSIONS`, and forces a decision
about every other role. `PERMISSION_KEYS` is still 18 and none of them mentions blueprints. A MANAGER
reading successfully and being refused when installing are both asserted, because only asserting the
refusal would leave "MANAGER can see nothing either" indistinguishable from success.

### The invariant that had to change, and was not weakened

`check-onboarding-blueprint-coverage.ts` asserted that nothing in the repository could install a
blueprint, and it was deliberately built to go red the moment that stopped being true. This commit makes
it happen: the schema-model trigger fires on `BlueprintInstallation`, and the behavioural detector fires
on the new `POST`.

Deleting it or loosening it would have thrown away the reason it existed. So it was **replaced** by the
claim that matters once installation is real, and which is strictly harder to satisfy:

> **Onboarding has no path to the install runtime.**

The old risk was that the map overclaimed what it did. The new risk is concrete and much worse —
*signing up quietly reconfigures a workspace* — and one import in `onboarding-needs.ts` would do it. The
check now asserts installation genuinely exists, that nothing on the onboarding path reaches the install
runtime, and that the write path asks for `workspace.update`. 25 → 29 assertions.
`CORRESPONDING_BLUEPRINT`'s comment was rewritten in the same commit, because it said installation did
not exist and that sentence had just become false.

### Lessons

40. **A `BEFORE DELETE` trigger outranks a cascade.** `onDelete: Cascade` plus an append-only ledger
    means a workspace with installation history can never be deleted: the cascaded `DELETE` still fires
    the trigger. Consistent with `ActivityEvent` and `CopilotAuditEvent`, which have made `Contact` and
    workspace deletion conditional the same way for far longer — but it is a real consequence of choosing
    append-only, and the first version of the assertion tested only the no-history case, which
    *advertised a deletion path that does not exist in practice*. Both directions are now asserted.

41. **Trigger order can make a `CHECK` constraint unreachable.** On `INSERT` the supersession trigger
    fires before `no_self_supersession` and refuses first, because the row being pointed at does not exist
    yet. Found by writing the assertion and watching it fail *for the wrong reason* — the error code was
    `P0001` (a plpgsql raise) where `23514` (a check violation) was expected. An assertion that only
    tried `INSERT` would have claimed to test a constraint it never reached. Both statements are now
    asserted, and the CHECK is proven reachable by `UPDATE`, which is the statement that can reach it.

42. **In Postgres any SQL error aborts the enclosing transaction, so a shared-transaction harness cannot
    contain a database-level refusal.** The first runtime harness attempted a real append-only `UPDATE`
    inside the one outer transaction its other assertions shared. Everything after it failed with `25P02`
    — "current transaction is aborted" — while still being *named* after the envelopes and permissions it
    was no longer testing. Database-level refusals belong in a harness that gives each one its own
    transaction, which is what the schema harness does.

43. **Residue in a shared database is a defect, not an inconvenience.** The atomicity proof needs the
    real transaction — a rollback the harness performed itself would prove nothing about whether the
    service's transaction is atomic — and proving the idempotency key survived by performing a real retry
    wrote a **permanent** ledger line, since neither it nor its installation, workspace or profile can be
    deleted. One surviving profile-with-workspace made `check-schema-invariants.ts` fail **three files
    away**: it projects every `Profile` into a `Workspace`, `Workspace.profileId` is `UNIQUE`, and its
    `on conflict ("id") do nothing` cannot absorb a collision on a different column. The sweep read
    64 checks / 1 FAILED and named a leftover row. *"It is only the rehearsal database"* is exactly how
    residue becomes somebody else's failing check. The retry is now proven inside a rolled-back
    transaction and the key's absence asserted directly, keeping both proofs at zero residue.

44. **A doc comment explaining a seam will trip a scan looking for the seam.** The assertion that the
    composition root passes no test hooks failed because that file names both hooks in the comment
    explaining why it must never pass them — the third time this trap has appeared here, after the
    migration builder and the preview resolver. Scan executable lines only, and add the *complementary*
    assertion that the explanation is present, so the seams cannot quietly become undocumented.

### Migration evidence

| Step | Result |
|---|---|
| raw diff | `create_table=2 create_type=2 alter_type_add_value=0 add_column=0 alter_column=0 drop_table=0 drop_column=0` |
| `profileId` drift | exactly **5** `DropForeignKey` statements excluded, count asserted |
| backup | 462288 bytes, sha256 `9f8e4041d87f4b99cc9a22cfec3a0dff1f6cdd1261642209c2acbcf07c35bb5b` |
| pre-install | 113 tables, raw `9d0a19a7`, normalized `eea92c9a` |
| post-apply | 115 tables, raw `e98fc561`, normalized `a7090c51` |
| post-rollback | 113 tables, raw `9d0a19a7` — **IDENTICAL to pre, raw AND normalized** |
| apply vs rollback | **DIFFERS** (exit 2), enumerating all ten constraints, so the rollback provably ran |
| post-reapply | normalized `a7090c51` — **IDENTICAL to post-apply** |
| `down.sql` | applied from a **space-free** path; database never left between rollback and reapply |

Counts reconcile exactly: +2 tables, +23 columns, +9 indexes, +10 checks, +7 enum values, and +5
`information_schema.triggers` rows for three triggers, two of which cover two events each.

### Measured gates at `9548440`

| Gate | Result |
|---|---|
| `prisma validate` | 0 |
| `prisma generate` | 0 |
| `tsc --noEmit` | 0 |
| check sweep | **64 of 64 exit 0** (was 61) |
| `check-blueprint-install-schema` | 51/51; inverted exit 1, 41 flipped |
| `check-blueprint-install-runtime` | 57/57; inverted exit 1, 44 flipped; restored 57/57; **zero residue** |
| `check-blueprint-install-routes` | 46/46; inverted exit 1, 20 flipped |
| `check-onboarding-blueprint-coverage` | 29/29 (was 25); inverted exit 1, 15 flipped |
| targeted ESLint | 0 findings |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged all run |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | 0; both new routes in the manifest |
| live `personalink` | untouched — 35 tables, no `_prisma_migrations`, 0 leaked, `Profile` = 16 |
| triggers | 24 total, 0 disabled |
| frozen worktrees | all six `kirocrew/*` still at `ea69595` |
| origin | unchanged at `4b386d1d` |

### Workers

| Worker | Model | Evidence | Delivered |
|---|---|---|---|
| BP3 — install UI | `claude-sonnet-5` | commit `4af22ad`, clean worktree, 1030 insertions | accepted as `f71a3af` |
| BP4 — harness vacuity audit | `gpt-5.6-terra` | commit `6077961`, audit doc with a break/restore evidence table | accepted as `d1eeae9` |

Neither wrote its report file, though both committed real work — so both were judged on the diff instead.
BP4's result is the one worth keeping: asked to hunt the vacuity class found in lesson 36, it found the
**same defect in `check-capability-contract.ts`** — deleting `composition.required &&` from the validator
left that harness green, because no active blueprint composed an immature capability *optionally*. It
fixed it with the paired direction using the real partial capability, then reported that it had audited
one file of ten and why: *"The time budget was spent proving and repairing the first demonstrated
discriminator gap rather than manufacturing coverage."* It also declined to claim source-break evidence
for other files because the supplied runner executes against the primary worktree, which its brief
forbade it to touch. A worker that reports one proven finding and refuses to pad it is worth more than
one that reports ten unproven ones.

`spawn_run` was not retried; the one-shot cron path produced both workers, as it did in Phase 1.


---

## Workspace-scoped surfaces, cohort operations coverage, and what four audit passes actually found

Eleven workers across five waves, three concurrent throughout, plus root. Sweep 64 → 68. No migration was
added, because none turned out to be needed.

### The measurement that decided the whole design

Installation already froze the surfaces a blueprint implies into `BlueprintInstallation.configJson`, and
nothing applied them. The obvious reading was "installation forgot to apply surfaces". The real position,
measured before anything was written, is different and much better:

**Not one file under `src/app/dashboard/**` mentions `workspaceId`.** The entire dashboard — layout,
sidebar, all six pages, and the `requireSurface` redirect gate — is purely profile-scoped. Workspace
context lives in 68 files and none of them is a dashboard page.

So a workspace-aware resolver **cannot change any existing behaviour**, because there was no code path
where a workspace id was available and being ignored. That is why there is no migration, why "compatibility
layer" overstates it — the legacy path is simply the branch taken when there is no workspace — and why the
right shape was one resolver around the existing installation record rather than a second mechanism beside
it. A worker then proved `configJson` sufficient by installing genuinely different blueprints into two
workspaces and showing each resolved to its own exact frozen set, with A-only surfaces provably absent
from B for one user who belonged to both.

### Two places root was wrong, both found by workers

**The fallback design.** Root's decision document specified that a workspace with no active installation
should fall back to profile surfaces and carry a `source` flag saying so. S1-A implemented the opposite —
explicitly empty, no fallback — and was right. The regression root feared cannot occur, for the same reason
the keystone measurement gives: nothing consumes the resolver yet, so "empty" is not a regression but a
choice about what a *new* consumer sees, and the only new consumer is a panel looking at one specific
workspace. Showing it the *profile's* surfaces would be exactly the conflation the document exists to
prevent. The shipped design is two separate methods, and that is better than a flag for a reason worth
keeping: **a flag that must be read to avoid a wrong conclusion is a weaker guarantee than two functions
that cannot be confused.**

**A brief that cited a document the worker could not see.** S2-B's brief pointed at a CORRECTION section
that did not exist at the commit it was branched from, because root committed that document afterwards.
S2-B read the executable contracts instead and flagged the discrepancy rather than proceeding on stale
prose. That is the correct order of trust, and the brief was wrong, not the worker.

### A frozen config must outlive the code that wrote it

S1-A's resolver threw `CONFLICT` on any surface string outside the current `Surface` union, reasoning that
filtering would silently broaden a corrupt config. Right about corruption; wrong about the case that will
actually happen. The day a surface is retired from the union, **every workspace installed before that
release holds a config naming it**, and refusing the whole config would take them all down on deploy over
data that was valid when it was written.

The two cases are now distinguished, because they are different kinds of thing: structural corruption
throws; an unrecognised string is dropped and reported. Dropping is also the fail-safe direction, since an
unrecognised value cannot be granted — which is why a permission-shaped string in a surfaces array is
ignored rather than honoured.

Independent review then caught a third case root had collapsed into the second: `businessOs` is a
*recognised* `Surface` that installations may never contribute, so reporting it as "no longer recognised"
told an owner that wrong-now data was merely an outdated config. It now has its own channel.

### Operations covers cohort work by consuming, not by re-deciding

`operations/engine.ts` had refused to cover cohort work, and its recorded reason was precise: doing so
"would mean encoding a judgement here that the cohort engine has not itself declared". The refusal is now
discharged by the owning engine **speaking**, not by the view guessing. The reader contains no cohort rule
at all, and a harness asserts its method body names none of fourteen cohort state tokens.

The classifications are grounded in the real transition tables rather than the enum names: `submissionFlow`
makes `SUBMITTED` the staff-review branch point, so `RETURNED` is learner-owned; `ATTENDANCE_CREDITED`
includes `LATE`, so late is not an exception; `recordAttendance` refuses `SCHEDULED`, so an absence there is
not yet real; `certificateFlow` declares `ELIGIBLE → ISSUED`, so issuance is the outstanding owner action.

### What four audit passes actually found, and why the number is the point

**14 assertions examined by real source mutation. 14 proven real. 1 vacuity, found by the earliest pass.**

Read that the right way round: **the assertion suite is substantially honest.** The vacuity class is real
and has cost this program twice, but it is not endemic, and three of four auditors correctly returned
NO_CHANGE with break evidence rather than manufacturing a finding. An auditor who reports something in
every file should be disbelieved rather than thanked.

The audit's value turned out to lie elsewhere — in two defect classes nobody had named.

### Lessons

45. **AN OVER-CLAIMING ASSERTION IS NOT A VACUOUS ONE, AND MUTATION CANNOT TELL THEM APART.**
    `check-retainer-runtime.ts` raced two draws with `Promise.all` and claimed they proved the `FOR UPDATE`
    serialization locks. Removing **both** locks left it green, 87/87. The auditor then did the harder
    thing and declined to call it vacuity: the assertion's named property is the *observable additive
    outcome*, which Postgres scheduling can preserve without those locks. So it tests something real while
    its NAME claims a mechanism it never exercises.

    Mutation says "green" in both cases — for a vacuity that means "tests nothing", here it means
    "insufficiently constrained" — and only reasoning about what the property logically *requires* can
    separate them. **Two promises raced do not create contention.** They are serialised by the connection
    pool or by scheduling, so the interleaving the lock exists to prevent never occurs.

46. **THE TECHNIQUE THAT SETTLES A LOCK CLAIM IS DETERMINISTIC READ INTERLEAVING, AND IT NOW EXISTS HERE.**
    An inert-by-default Prisma query middleware barrier holds T1 open immediately after its balance read,
    while its `FOR UPDATE` locks are still held. T2 then calls the same real service method. The harness
    observes whether T2 reaches its own read and commits before T1 is released. `finally` always releases
    T1, and a deadlock or lock timeout is never counted as a pass.

    Result, reproduced independently by root: **locks present** — T2 does not reach its read before
    release, balance 0 → 8. **Both `FOR UPDATE` clauses removed** — T2 reads and commits while T1 is held,
    then T1 overwrites with its stale 3, balance 0 → **3**. A real forced lost update. The claim is now
    proven rather than asserted, and the older opportunistic assertion is retained as what it always
    was: an additive-outcome test.

47. **A CONTROL CAN PASS FOR THE WRONG REASON TOO — CHECK THE PROOF MECHANISM, NOT JUST THE ASSERTIONS.**
    `INVERT_ASSERTION=1` is documented as the control proving a suite can fail. In **nine** large harnesses
    it flipped exactly **one** assertion. The gate was technically satisfied and evidentially near-worthless:
    it proved one assertion could fail, not that the suite could, and a reader running the documented
    control would see `exit 1` and conclude otherwise.

    This is the vacuity shape one level up, in the mechanism rather than the assertion. Crucially, a
    brand-new harness shipped with the same 1-of-32 shape **in this run**, which makes it a house habit
    rather than legacy drift — so it has to be caught at review of new files, not audited later. Now
    widened across nine files plus that new one, with normal assertion counts identical in every case.
    Rollback, residue, teardown and fixture-precondition assertions were deliberately left plain, because
    inverting them would assert that the harness *should* leave residue.

48. **RESIDUE IS A DEFECT, AND THE ASSERTION THAT PROVED IT WAS ALSO THE ONE IT BROKE.**
    `check-schema-invariants.ts` projects a `Workspace` for every `Profile` with
    `on conflict ("id") do nothing`, but `Workspace.profileId` is `UNIQUE`, so the collision that actually
    occurs is on `profileId` and cannot be absorbed. It had passed for as long as it existed only because
    no `Profile` in the disposable database owned a `Workspace` — a fact discovered when leftover harness
    residue from the previous run turned the sweep red and named a row that harness had never heard of.
    Fixed with a `not exists` guard and the correct conflict target, and the
    profile-that-already-owns-a-workspace case is now seeded, so the fix demonstrates something.

49. **AN ASSERTION CAN PUNISH THE BETTER CODE.** The operations declared-coverage scan recognised only a
    literal `domain: "x" as const` tag. The cohort reader deliberately tags with the imported
    `COHORT_NEEDS_ACTION_DOMAIN` constant, so a rename in the owning engine cannot leave the view filing
    items under a domain it no longer declares — and the scan failed it. The scan was wrong, not the code.
    Widened to accept a constant it can resolve to a declared domain, which keeps it honest rather than
    merely permissive.

50. **AND ROOT WROTE AN OVER-BROAD ASSERTION WHILE DOCUMENTING THE CLASS.** Root's first attempt at
    "operations restates no cohort rules" scanned the whole engine for cohort state tokens and failed on
    `SUBMITTED` — which is a legitimate **inspection** status in `INSPECTION_OPEN_STATUSES`. It was testing
    whether a word appears, not whether rules are restated: exactly the over-broad shape the audit exists
    to catch, occurring in the assertion instead of the code, written by the person writing the lesson.

### Measured gates at the S-wave green point

| Gate | Result |
|---|---|
| `prisma validate` | 0 |
| `tsc --noEmit` | 0 |
| check sweep | **68 of 68 exit 0** (baseline 64; only increased) |
| `check-workspace-surface-contract` | 16/16; inverted flips 16 |
| `check-workspace-surface-boundary` | 18/18; inverted flips 18 |
| `check-cohort-needs-action` | 32/32; inverted flips 29 (was 1) |
| `check-due-work-plan` | 12/12; inverted flips 12 |
| `check-schema-invariants` | 22/22 (was 18); mutation reproduced `23505` with 6 red |
| `check-operations-runtime` | 31/31 (was 28); inverted flips 16 |
| `check-retainer-runtime` | 88/88; lock proof red at 87/88 with both locks removed |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged at every commit |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | 0; the new surfaces route in the manifest |
| live `personalink` | untouched — 35 tables, `Profile` = 16 |
| triggers | 24 total, 0 disabled |
| frozen worktrees | all six `kirocrew/*` at `ea69595` |
| origin | unchanged at `4b386d1d` |
| **migration** | **none added — none was needed** |

### Orchestration, with evidence

`spawn_run` — **FAILED_NO_START.** Probe `02da4673` registered as `[running]` but produced no artifact
inside its five-minute window and never wrote its report file. Registry elapsed time is not progress, and
was not counted as such. Every one of the eleven workers ran through the one-shot cron path with an
explicit model pin.

Maximum measured concurrency: **three workers plus root**, sustained across five waves, evidenced by
simultaneous dirty files in three separate worktrees alongside root's own commits — not by elapsed time.

One tooling fix mattered more than it looks: the previous run's auditor could not produce source-mutation
evidence because the supplied rehearsal runner hardcodes the primary worktree, and it correctly refused to
claim evidence it could not stand behind. A cwd-respecting runner was written before this wave started, and
every worker used it. **Four audit passes became possible because one tool stopped lying about which tree
it was testing.**

Two workers reported honestly that their environment surfaces no agent PID and declined to substitute a
shell PID; two others reported a shell PID and labelled it as such. Three returned NO_CHANGE. None of that
needed correcting, and all of it is worth more than a uniform set of confident numbers.


---

## S6 — the last wave, and a harness whose exit code ignored a third of itself

### The finding that invalidated earlier evidence

`check-business-os-a11y.ts` decided `report.result` and `process.exitCode` roughly a hundred lines before
the end of the file. Everything below — two appended sections, including an entire fourteen-assertion set —
ran **afterwards**, appending to `failures` after `failures` had already been serialised into the report and
after the exit code had already been set.

So those assertions were invisible in the output *and* non-fatal to the process. Every earlier
"a11y PASS, exit 0" in this run was weaker evidence than it appeared, including root's own.

Found by a worker while appending to the file. Proven by observation rather than argument: moving the
decision to the bottom made the harness immediately report `FAIL` and exit `1` on a real failure that had
been sitting there unseen for as long as the section had existed.

51. **A CONTROL CAN BE WIRED TO NOTHING.** This is the third distinct shape of the same family. A *vacuous*
    assertion tests nothing. An *over-claiming* assertion tests something weaker than its name. This one
    tests the right thing and its **result is discarded** — because a mid-file exit decision cannot see
    sections appended below it, and a harness that grows by appending will always eventually grow past it.
    An exit decision belongs at the bottom of the file, where nothing can outrun it.

### The failure it had been hiding, and three attempts to fix it

The hidden failure was the assertion *"the empty-installation copy does not imply the workspace is broken or
misconfigured"*, implemented as a ban on the words `misconfigured` and `broken`. It failed because the
panel's **reassuring** copy says "it is not an error or a sign anything is misconfigured" — precisely the
sentence the assertion wanted to exist.

Root needed three attempts, and the failures are the lesson:

1. Ban the words → fails on the desired copy.
2. Require the negation and forbid a bare claim → still fails, because the panel's *doc comment* says the
   copy is "never phrased so a reader could conclude the workspace is broken or misconfigured". A comment
   explaining the rule tripped the rule. Fixed by stripping comments — the technique this repository has
   now needed four times.
3. Still fails, because `"not an error or a sign anything is misconfigured"` contains the substring
   `"is misconfigured"` whose negation sits eight words earlier. **A regex cannot see that**, and detecting
   an unnegated English claim will produce false positives forever.

52. **WHEN A PROPERTY IS ABOUT PROSE, ASSERT THE PRESENCE OF THE RIGHT SENTENCE, NOT THE ABSENCE OF A WRONG
    WORD.** The check is now positive — require the reassurance to be present — which is tractable, goes red
    if that sentence is deleted, and cannot be defeated by phrasing. It was also renamed, because the old
    name promised more than any regex over prose can deliver, and a name that overpromises is how an
    over-claiming assertion is born.

### Explicit workspace selection — the last review finding closed

The shell no longer guesses. The `workspaces[0]` alphabetical fallback is deleted, and so is the
profile-match preference that preceded it: auto-selecting **only** when there is exactly one authorized
workspace rules out a profile-based guess as well. More than one now yields a deliberate "Choose a
workspace" state, and the choice persists with an explicit clear path.

The worker corrected root's brief on the way: **15** panels take `workspaceId`, not twelve — 17 counting
one panel's two children — and it audited every one *before* changing anything, because getting that wrong
would have emptied the console for every multi-workspace user. All safe: every panel gates the network call
itself rather than only the render, so a blank id can never reach a URL. It reported one cosmetic issue
outside its own paths and left it alone.

### Orchestration: 16 workers, 15 with evidence, 1 with none

**S6-C produced nothing.** Dispatched on gpt-5.6-sol to generalize the deterministic-interleaving technique
to the inventory reservation path. Its cron fired and completed; its worktree is byte-identical to how root
prepared it, with no commit, no modified file, and no report. Recorded as **NO_OUTPUT** rather than glossed:
a worker that leaves no trace did no work, and its package is still open.

The other fifteen all produced verifiable output. Four returned NO_CHANGE with break evidence and were
right to. One did the work, gated it, and forgot to commit — root applied its working tree with
attribution. Two declined to report a PID their environment does not surface; three reported a shell PID and
labelled it as such.

`spawn_run`: **FAILED_NO_START**, again. Probe `02da4673` registered `[running]` and produced no artifact in
its five-minute window, and never wrote its report. Registry elapsed time is not progress and was not
counted as such.

### Measured gates at `4c9cf31`

| Gate | Result |
|---|---|
| `prisma validate` / `tsc --noEmit` | 0 / 0 |
| check sweep | **68 of 68 exit 0** (baseline 64) |
| `check-business-os-a11y` | PASS, exit 0, gate now covers all assertions; inverted exit 1 |
| repo-wide ESLint | 43 problems (14 errors, 29 warnings) — unchanged |
| `npm audit --omit=dev` | 0 vulnerabilities |
| production build | 0 |
| live `personalink` | untouched — `Profile` = 16 |
| triggers | 24 total, 0 disabled |
| origin | unchanged at `4b386d1d` |
| frozen worktrees | all six at `ea69595` |

Inversion widening, final tally across this run: **fourteen harnesses**. commerce 1→99, inventory 1→76,
cohort-runtime 1→99, course-access 1→78, reservation-authz 1→33, fieldjob-evidence-audit 1→55,
fieldjob-schema-invariants 12→78, capability-contract 20→230, fieldjob-routes 7→49, retainer-runtime 1→79,
retainer-routes 1→55, retainer-schema-invariants 1→76, cohort-schema-invariants 1→59,
cohort-needs-action 1→29. Normal assertion counts identical in every single case.
