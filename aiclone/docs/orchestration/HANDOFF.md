# PersonaAI / PersonaLink — Session Handoff

Written 2026-08-28 by the root orchestrator at the end of the overnight run. Everything below was
verified by command at write time, not recalled. If you are a new session, read this file first,
then `RUNLOG.md` (newest entries at the bottom) and `TASKS.json`.

Contains no secrets. Clerk keys, claim tokens, database URLs and `.env` contents are referred to by
name only and must never be printed, committed or repeated.

---

## 1. Where things stand

| | |
|---|---|
| Repo | `C:\Users\shubh\Desktop\Projects\personal projects\personai` (app in `aiclone/`) |
| Local primary | `recovered/aug20-wt-pr-32` @ **`9b8ba64`** |
| Origin | **`4b386d1`** — never pushed, and pushing is forbidden |
| Next.js | **16.3.3** (SEC-001 hotfix, do not revert) |
| Clerk | **`@clerk/nextjs` 6.39.6** (SEC-002) |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| Working tree | clean except preserved `.codex-remote-attachments/` (untracked, leave alone) |
| Public preview | **DOWN by owner directive.** cloudflared count 0, ports 3000/3100 no listeners |
| Cron jobs | none registered |
| Supervisor loop | none. `~/.kiro/crew/supervisor.lock` absent |

Live database `personalink` verified **untouched**: 35 public tables, `_prisma_migrations` absent
(0 migrations applied), 0 of the new P2 tables, `Profile` = 16.

---

## 2. THE BLOCKER — read before writing any product code

`P1-014` (adversarial auth audit, lane 4, model `gpt-5.6-terra`, evidence commit `edb65fa`) found
**critical, unpatched authorization defects in production code paths**. Its recommendation is
explicit: **block public launch**. This is why the Business OS UI lane (`P2-003`) was deliberately
not dispatched.

| Severity | Location | Defect |
|---|---|---|
| **Critical** | `src/app/actions/content.ts` | creates / updates / deletes / syncs profile content with no server-derived identity and no owner predicate |
| **Critical** | `src/app/actions/onboarding.ts` | `createProfile(userId, data)` trusts a caller-supplied `userId` — the caller selects the profile owner |
| High | `src/app/api/image-to-3d/route.ts` | anonymous external-compute / public artifact endpoint, no identity, quota or ownership control |
| Medium | `src/app/api/chat/route.ts` | accepts an existing conversation ID without binding it to profile + verified visitor/member identity |

A static sweep also found **11 Server Action modules with no apparent identity guard**.

Important nuance: the tenant-isolation work that already passed (`P1-008`, `P1-011`) covers
**in-memory contracts only**. It does not cover the production Clerk/session, Prisma, filesystem or
HTTP boundaries where these defects live. Do not treat those green harnesses as evidence that these
paths are safe.

Recommended remediation, in this order: introduce a reusable server-side `requireOwnedProfile` /
`requireOwnedDocument` pattern, apply it to `content.ts`, `onboarding.ts`, course completion, live
chat and chat conversation reuse, then expand the adversarial harness into production-handler
integration tests using two tenants and real Clerk/session test doubles before lifting the blocker.

The audit deliberately left source **unpatched** — it was a read-only lane. Remediation is the next
package.

---

## 3. What is integrated on primary

Wave 1 (six packages), SEC-001, SEC-002, P2-001 schema, and wave-2 lanes 1 and 2.

| Package | Model (observed) | Commit | Notes |
|---|---|---|---|
| P1-011 tenancy contracts | gpt-5.6-sol | `66e4945` | `src/lib/tenancy/**`, deny-by-default, audited escape hatch |
| P1-010 capability/blueprint contract | gpt-5.6-sol | `eb188d2` | granular IDs, `planned\|partial\|available` maturity, active-blueprint enforcement, `restaurant-venue-v2` |
| P1-012 contact/activity/task foundation | claude-sonnet-5 | `82f562e` | `src/lib/foundation/**`, read-only adapters |
| P1-016 Business OS UI remediation | claude-sonnet-5 (pinned; unobservable) | `3120048` | a11y, honest error boundary, loading skeleton |
| P1-008 mocked auth/authz/isolation evals | gpt-5.6-terra | `757dea3` | falsifiable under `INVERT_ASSERTION=1` |
| P1-015 copilot ledger/runtime contracts | gpt-5.6-terra | `eda4249` | state machines, approval gate, append-only ledger |
| SEC-001 Next 16.0.6 → 16.3.3 | root | `cc41883` | GHSA-p293-qw3h-jr36 unauth RCE |
| P2-001 additive schema | gpt-5.6-sol | `9965479` | 14 tables, rehearsed on disposable DB |
| SEC-002 Clerk → 6.39.6 | gpt-5.6-sol | `4f816f1` | audit to 0; also fixed the dashboard gate |
| P2-002 persisted adapters (lane 1) | — | `687b369` | merged at `6c3229c` |
| P2-004 executable runtime (lane 2) | — | `04ec86a` | merged at `42e31fb` |

### SEC-002 also closed the dashboard-gate mystery
Root cause was **(c) a mis-ordered / ineffective outer gate**, not the middleware-bypass advisory.
On 6.39.6 Clerk reported signed-out with reason `protect-rewrite`, proving `auth.protect()` ran; its
keyless dev-browser-missing rewrite was preempting the layout/page redirects and returning HTTP 200
with the `Profile Not Found` shell. Fix: `auth.protect()` retained and an explicit
`unauthenticatedUrl` derived from `req.url` passed for `/sign-in`, so those requests now return
**307** instead of a 200 shell. API 401 behaviour unchanged.

### P2-001 schema, for reference
14 additive tables — `Workspace`, `Location`, `Membership`, `MembershipLocation`, `Contact`,
`ContactSourceLink`, `ActivityEvent`, `TaskJob`, `WorkflowRun`, `AgentRun`, `WorkflowStep`,
`ToolCall`, `Approval`, `CopilotAuditEvent` — plus a `MembershipRole` enum and append-only triggers
on `ActivityEvent` and `CopilotAuditEvent`. All new FKs onto pre-existing tables are **nullable**.
Applied to the disposable rehearsal DB only; 18/18 invariants; rollback and reapply both rehearsed;
zero residue; catalog diff clean.

---

## 4. Branches awaiting a decision (committed, NOT integrated)

| Branch | Worktree | Commit | Decision needed |
|---|---|---|---|
| `worker/w10-observability` | `personai-w10-observability-wt` | `595afc3` | **P1-013.** Makes the orchestration dashboard truthfully snapshot-only: removes the perpetual `while ($true)` loop and `Start-Sleep` polling, writes one timestamped snapshot, and explicitly reports that no monitor is running. It honestly does **not** claim three automatic ticks. Verify and integrate, or reject. |
| `worker/w9-auth-adversarial` | `personai-w9-auth-adversarial-wt` | `edb65fa` | Evidence-only commit for the audit in section 2 (harness + report, source intentionally unpatched). Decide whether the evidence lands on primary. |
| `worker/w11-integration-review` | `personai-w11-review-wt` | `9291e93` (= base) | Read-only reviewer, produced a 24 KB report and no code. Nothing to integrate. |

Reports for these are in `%TEMP%\personalink-phase0\wave2-reports\` (`LANE-4-AUTH-ADVERSARIAL.md`,
`LANE-5-OBSERVABILITY.md`, `LANE-6-INTEGRATION-REVIEW.md`). Wave-1 and SEC/P2 reports are in
`%TEMP%\personalink-phase0\wave1-reports\`.

---

## 5. Next READY work, in priority order

1. **Authorization remediation** (blocker from section 2). Highest priority. `gpt-5.6-sol`, high.
   Owns `src/app/actions/**`, the new `requireOwned*` helper, and its tests. Must not weaken any
   existing API check.
2. **Integrate or reject `worker/w10-observability`** (P1-013) — small, self-contained.
3. **P2-003 Business OS UI connected to real APIs** — `claude-sonnet-5`. **Blocked** until item 1 is
   accepted, because the onboarding action it would drive trusts caller-supplied identity.
4. Production-handler auth integration tests with two tenants and real Clerk/session doubles.
5. End-to-end local demo tenant + onboarding flow, disposable DB only.
6. Approval inbox and auditable action execution.
7. `P1-009` scoped repo-wide lint cleanup — only after product lanes stop touching overlapping files.
8. `P1-006` restaurant reservation correction — only through the existing patch queue.

Do not start broad vertical implementation to inflate line count. A vertical may begin only when
every required shared engine passes its activation gate.

---

## 6. How to run workers here (hard-won, do not relearn)

- **`spawn_run` is unusable.** `parent_session` is unresolved in this ACP CLI session, so subagents
  are registered hollow (`started=null`, `pid=null`, `turns=0`) and reaped as `failed` without ever
  executing. Do not use it.
- **`monitor_start` cannot arm here.** It returns a "requested" message but
  `~/.kiro/crew/autonudge.json` stays `{"loops":[]}`. Never claim a loop is running without checking
  that file.
- **Use `cron_add` with an explicit `model`.** This is the proven path and it honours the pin.
  Never `auto`, never an omitted model. Record requested vs observed model.
- `cron_add` message length is fine, but **`spawn_run.task` was capped at 5000 chars** — the pattern
  that works is a full brief written to `%TEMP%\personalink-phase0\...` (outside the repo, so a
  worker cannot commit its own brief) plus a short pointer in the job message.
- **No `todo_list` tool exists in this profile.** `TASKS.json` is the authoritative ledger.
- Set `approval_mode='auto'`, `persistent_session=false`, `hide_in_chat=true`, and a generous
  `timeout_secs` (5400–7200) for build-bearing work.
- If a worker needs a durable multi-cycle owner, register a single recurring supervisor cron with an
  **execution lock** and a stale-lock timeout, and always release the lock before ending the turn —
  a leaked lock silently halts all progress.

### Environment gotchas
- Worker worktrees created with a shared `node_modules` junction must **never** run `npm install` or
  `npx prisma generate` — concurrent generates collide on `query_engine-windows.dll.node` with
  EPERM and break every sibling. Give a worker its own real `node_modules` (`npm ci`) whenever it
  must regenerate Prisma or change dependencies.
- `Start-Process -ArgumentList` mangles paths containing spaces. Passing the extensionless `next`
  bin directly made node split the path at `personal projects` and die `MODULE_NOT_FOUND`. Invoke
  through `npm.cmd` instead.
- **Next 16 cannot bind loopback-only.** Its proxy layer forwards upstream to `localhost:<port>`, so
  `-H 127.0.0.1` becomes a self-proxy loop and every request dies `ECONNRESET`; `HOSTNAME` is
  ignored. It only works listening on `::`, so off-machine reach must be denied at the firewall.
- If a tunnel is ever authorized again: point cloudflared at the IPv4 literal
  `http://127.0.0.1:3000`, not `localhost`, and use `--protocol http2`. Pointing at `localhost`
  resolved to `::1` and produced intermittent 522s.
- A firewall rule `personalink-preview-block-lan-3000` may still exist. Remove with
  `Remove-NetFirewallRule -DisplayName 'personalink-preview-block-lan-3000'`.

---

## 7. Databases

| Database | Role | Rule |
|---|---|---|
| `personalink` | **LIVE / production** | Absolutely forbidden in any casing. No migration, backfill, cutover, reset or destructive statement. Currently 35 tables, 0 migrations. |
| `personalink_phase0_rehearsal_20260826_210704` | disposable, P2 schema rehearsal | The only authorized migration target. Currently has the P2 migration applied (56 tables). |
| `personalink_phase0_clean_20260826_221845` | disposable, general test use | Safe for harnesses that write. Has less product data than live, which is why the shop page renders smaller against it. |

Before **any** destructive database command, use `scripts/one-off/p2-guarded-sql.ts`, which enforces
five preflight steps with no bypass: print only the redacted name, `assertDisposableTarget`, exact
target equality, backup exists + SHA-256, else abort. It also re-asserts `select current_database()`
**after connecting**, so the attached database is proven rather than trusted. The guard is verified
to refuse `personalink`, `PersonaLink` and `PERSONALINK`, and to refuse even the other disposable
copy when it is not the authorized target.

Rehearsal backup: `%TEMP%\personalink-p2-rehearsal-backup\pre-migration-2026-08-27T13-52-27-343Z.dump`,
149,270 bytes, SHA-256 `77c6eeb27b065b84fdab1cd0e77f820540ff5c1e53ac54dc6da286ab1fb4cc69`. Never
delete it.

---

## 8. Standing boundaries

- No public tunnel. Temporary **local** servers only, stopped immediately after use.
- No live database migration or cutover. No `DROP DATABASE`. No unguarded SQL.
- No `git push`, PR, force operation, deployment, or origin change.
- Never delete the six frozen evidence worktrees (`personai-kirocrew-business-os-*`, all at
  `ea69595`). Their untracked files are expected pre-existing state.
- Never print, commit or repeat Clerk keys, claim tokens, database URLs, credentials or `.env`
  contents.
- No auth bypass, no test backdoor, no env flag that disables auth.
- One exclusive Prisma writer at a time; one owner per writable path.
- Never accept a worker's prose as evidence — re-run its diff and its gates yourself.
- Preserve untracked user files, especially `.codex-remote-attachments/`.

---

## 9. Verification commands

Run from `aiclone/`. Repo-wide `npm run lint` exits 1 with ~124 problems at baseline; that is an
accepted owner decision, so use **targeted** lint instead.

```
npx prisma validate
npx prisma generate
npx tsc --noEmit --pretty false
npx eslint <changed paths>
npm run build
$env:TS_NODE_PROJECT='scripts/tsconfig.checks.json'
npx ts-node -r tsconfig-paths/register scripts/one-off/<harness>.ts
```

Harnesses: `check-tenancy-contracts`, `check-foundation-contracts`, `check-copilot-runtime`,
`check-capability-contract`, `check-business-os-surface`, `check-business-os-render`,
`check-business-os-a11y`, `check-auth-authz`, `check-tenant-isolation`, `check-disposable-db-guard`,
`check-schema-invariants`.

Two need care:
- `check-schema-invariants` requires the rehearsal DB and **correctly refuses** any other target,
  including live. That refusal is a feature.
- `check-order-stream` and `check-restaurant-order-transaction` require a running local server and
  **write orders**. Never run them against `personalink`.

Two are pre-existing failures, not regressions: `check-restaurant-phase0-behavior` fails
`TS2550 Property 'replaceAll' does not exist` — a `lib` target defect in
`scripts/tsconfig.checks.json`, reproducible at older commits.

---

## 10. Honest gaps

- `P1-013` observability is committed but **not integrated**, and there is still no durable monitor.
  Continuous supervisors = 0. `LIVE_ACTIVITY.md` is a one-shot snapshot.
- `P1-014` is complete as an audit but its findings are **unremediated** — see section 2.
- `P2-003` UI lane never started.
- SEC-002 could not exercise the real authenticated browser HTTP row (no native browser / CDP
  endpoint available); the equivalent entitled-200 and no-surface-403 cases were covered by
  deterministic server-boundary harnesses instead.
- Nothing has ever been deployed or pushed. There is no production footprint from this work.
