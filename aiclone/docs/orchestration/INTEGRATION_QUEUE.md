# Integration Queue

Updated: 2026-08-27 10:15 +05:30

The consolidation exists and has been independently reviewed. Nothing has been merged into
`recovered/aug20-wt-pr-32`, and nothing has been pushed.

## Ready for owner review — `orchestrator/business-os-consolidation`

Branched from `a4d9fba`. Worktree `../personai-business-os-consolidation-wt`.

| Commit | Scope |
|---|---|
| `627b826` | P1-001 consolidation onto the canonical domain model |
| `8c58870` | P1-002 surface registration and server-side gate |
| `3ded129` | session-free verification harness |
| `95839a5` | fixes from independent review |

Gates at `95839a5`, each run in that worktree: `prisma validate` 0, `prisma generate` 0,
`tsc --noEmit` 0, targeted `eslint` 0, both check scripts 0 reporting PASS, `next build` 0
with all three routes registered dynamic. Repo-wide `npm run lint` exits 1 with 124
problems and 63 errors — **identical to the `a4d9fba` baseline**, with zero findings in any
new file. That gate cannot pass at this baseline; see blocker 1.

Accepted, rejected and added files are enumerated in the commit messages. No restaurant
path, no Prisma file and no migration is touched.

## Blockers

1. **`npm run lint` cannot pass.** The baseline carries 63 pre-existing errors across
   unrelated and owner-reviewed files (`profile-editor.tsx` 12, `product-form.tsx` 6,
   `actions/profile.ts` 5, `actions/courses.ts` 4, and others). Clearing them means editing
   files outside this scope, including restaurant-owned ones. The achievable standard was met
   instead: targeted lint clean, and provably no regression against baseline. Decide whether
   to fund a separate lint-cleanup task.
2. **No Clerk keys in this environment.** The signed-in path cannot be exercised, so the
   `FORBIDDEN`, `BAD_REQUEST` and `NOT_FOUND` API branches and the authenticated page render
   are verified by direct function assertion rather than over HTTP. Unauthenticated 401 with
   the envelope was confirmed over HTTP on both routes.

   Correction to an earlier claim: a **literally** malformed percent sequence in the URL
   (`/api/business-os/blueprints/%E0%A4%A`) never reaches the application. Next.js rejects it
   at the framework level with **400 `text/html`** before the handler runs, so it does not
   produce the Business OS JSON envelope. Only an *encoded* percent
   (`/%25E0%25A4%25A`, which decodes to the literal string `%E0%A4%A`) reaches the route and
   returns the 401 envelope. Both were measured. The `parseBlueprintId` guard and its unit
   assertions are still correct and still worth keeping — they defend the decode step for
   inputs that do reach the handler — but no claim should be made that all malformed URLs
   surface through the application envelope.

   Owner decision recorded: missing Clerk keys are not a blocker. Deterministic mocked
   authentication, authorization and tenant-isolation tests are queued as P1-008 instead of
   requesting real credentials.
3. **The workflow layer does not execute.** `planWorkflowRun`, `listApprovalGates` and
   `AuditEvent` have no consumers. The UI now says so explicitly, but any vertical whose
   safety boundary involves money or outbound messaging is gated on this becoming real. See
   `OWNER_COPILOT_SPEC.md` section 2 for the ledger that would back it.
4. **Capability vocabulary is coarser than the contract.** `engines.ts` declares three
   capability ids per engine while `ENGINE_CONTRACTS.md` names eight or nine owned nouns, so
   deposits, documents, variants and returns are not addressable by any blueprint. Needs an
   ADR either way — see `VERTICAL_BLUEPRINT_MAP.md` section 6.
5. **Two active-blueprint capabilities overstate reality.** `venueOrders.reservations` is a
   JSON blob on a generic `Booking` with no relation to `RestaurantTable`, and
   `commerce.inventory` is one nullable `stock` column. Both are declared required on
   `restaurant-venue-v1`, the only `active` blueprint. Either implement them or drop them
   from that blueprint.

## Superseded, retained as evidence

The six original lane worktrees remain at `ea69595` with their uncommitted drafts intact and
untouched — not rebased, not stashed, not deleted. A read-only snapshot with a SHA-256
manifest is at `../personai-lane-evidence-20260827/` (16 files). The rejected
`BusinessOsBlueprint` steps-and-stages model still exists there by design; retire those
worktrees only after the consolidation is merged.

## Ready for read-only worker analysis

- Engine contract versus capability-id reconciliation (blocker 4), producing an ADR.
- Owner copilot ledger schema review ahead of any migration request (blocker 3).


## Wave 1 — INTEGRATED 2026-08-27 at `4649ff1`

Queue is empty: all six wave-1 branches were accepted and merged. Nothing is awaiting integration.

| Order | Branch | Commit | Package | Merge |
|---|---|---|---|---|
| 1 | `worker/w1-tenancy-security` | `66e4945` | P1-011 tenancy contracts | `--no-ff`, clean |
| 2 | `worker/w2-capability-contract` | `eb188d2` | P1-010 capability/blueprint contract | `--no-ff`, clean |
| 3 | `worker/w3-contact-activity` | `82f562e` | P1-012 contact/activity/task foundation | `--no-ff`, clean |
| 4 | `worker/w4-business-os-ui` | `3120048` | P1-016 Business OS UI remediation | `--no-ff`, clean |
| 5 | `worker/w5-auth-evals` | `757dea3` | P1-008 mocked auth/authz/isolation evals | `--no-ff`, clean |
| 6 | `worker/w6-copilot-runtime` | `eda4249` | P1-015 copilot ledger/runtime contracts | `--no-ff`, clean |

Integration branch `orchestrator/integration-wave1b`, cut from primary `a2afe0d`. Zero merge
conflicts across all six. Local primary `recovered/aug20-wt-pr-32` fast-forwarded to `4649ff1`
after the full gate set passed. Not pushed; `origin/recovered/aug20-wt-pr-32` remains `4b386d1`.

Gates on the merged result: `prisma validate`=0, `prisma generate`=0, `tsc --noEmit`=0, targeted
`eslint`=0, 10/10 harnesses=0, `npm run build`=0.

Rejected: none. No path violations were found in any worker.

Retained for audit, not deleted: the six worker worktrees and the earlier
`orchestrator/integration-wave1` (`5ed4fa9`) and `orchestrator/business-os-consolidation`
(`5f47a61`) lanes, plus the six frozen evidence lanes at `ea69595`.

### Next in queue
`P2-001` (exclusive schema owner, `gpt-5.6-sol`) is now `ready` — it was unblocked by this
integration. It is the ONLY task permitted to touch `prisma/**`, it must run alone with no
concurrent schema worker, and every migration command must first prove its target is disposable
via `assertDisposableTarget` from `scripts/lib/disposable-db.ts`. It may never target `personalink`.



## Security remediation wave and P2-003 — INTEGRATED 2026-08-28

Queue is empty for Phase 2 UI work. Nothing is awaiting integration. Nothing has been pushed;
`origin/recovered/aug20-wt-pr-32` remains `4b386d1`.

| Order | Branch | Commit | Package | Integration |
|---|---|---|---|---|
| 1 | `security/ownership-foundation` | `f05e197` | SEC-F ownership foundation | `ac93e2c` |
| 2 | `security/lane-b-uploads` | `3c720b7` | Lane B uploads & external compute | `f69fa24` |
| 3 | `security/lane-a-actions` | `21f53a9` | Lane A tenant-owned Server Actions | `4d24076` |
| 4 | `security/lane-c-resources` | `9e14fcd` | Lane C resource & enrollment authz | `b9b2794` |
| 5 | `security/lane-e-middleware-boundary` + Lane E harness | root-resolved | Lane E health/auth HTTP + middleware | `b3afc2a` |
| 6 | `security/lane-d-conversations` | `a53d3cb` | Lane D conversation ownership | `4435da6`, `05ead37` |
| 7 | `security/actions-catalog-authz` | `2ed49d8` | catalog actions authz | `6ec8db5` |
| 8 | `security/actions-course-profile-authz` | `7e768b1` | course/profile actions authz | `f97dce2` |
| 9 | `security/actions-import-library-authz` | `18f37e1` | import/library actions authz | `e91471f` |
| 10 | `feature/p2-003-business-os-ui-fresh` | `147b2d1` | **P2-003 Business OS on persisted data** | **`64ec987`** |

P2-003 was implemented, gated and reviewed **by root**, because job `918886b6` delivered nothing
and the gateway then refused connections. This is recorded as a root-serial delivery, not as an
independent worker verification. Gates on the merged tip: `prisma validate`/`generate` 0, `tsc` 0,
targeted `eslint` 0 errors with 1 inherited `<img>` warning, `check-actions-authz` /
`check-persisted-adapters` / `check-business-os-p2-e2e` each 0/1/0 with 115/33/33 assertions, all
remaining production security boundaries 0, HTTP `portCleared=true`, shared regressions 0,
`npm audit --omit=dev` 0 vulnerabilities, `npm run build` 0.

Rejected: none in this batch. Lane E's first two attempts and the first middleware dispatch were
rejected earlier and are recorded in `RUNLOG.md`; their eventual resolution is row 5.

## Blocker status update

- **Blocker 1 (repo-wide lint) — still open.** Baseline 124 problems / 63 errors, unchanged.
  Queued as P1-009 for path-disjoint cleanup packages.
- **Blocker 2 (no Clerk keys) — closed by owner decision.** Deterministic mocked auth/authz/
  isolation tests shipped as P1-008; executable boundary harnesses now cover the signed-in paths.
- **Blocker 3 (workflow layer does not execute) — partially closed.** P1-005 landed an executable
  copilot runtime and P2-003 surfaces real Copilot runs, approvals and audit. Only server-owned
  `recordAudit` is exposed; notification/payment/publication actions are still declared-not-
  executable, and the UI says so.
- **Blocker 4 (coarse capability vocabulary) — closed.** P1-010 grew capabilities to granular
  stable ids with `planned|partial|available` maturity and active-blueprint enforcement.
- **Blocker 5 (two active-blueprint capabilities overstate reality) — HALF being addressed now.**
  Wave A implements `venueOrders.reservations` for real. `commerce.inventory` stays `partial` and
  is explicitly NOT claimed; it remains a single nullable `stock` column. Blocker 5 closes only
  when Wave A integrates green, and then only for the reservations half.

## Next in queue — Wave A, READY

Base `64ec987e1935c99460dc7b1261829bcaf39877b7`. Branch
`feature/wave-a-restaurant-reservations`, worktree `../personai-wave-a-reservations-wt` with its
own real `node_modules` (`npm ci`, not a junction) so Prisma generation cannot collide.

Wave A is largely serial: each package consumes the previous package's types or runtime. Packages
are integrated one at a time, each with a `--no-ff` merge and a full combined gate re-run.

| Pkg | Owner paths | Depends on | Required proof |
|---|---|---|---|
| A1 | `prisma/**` (EXCLUSIVE), `scripts/one-off/check-reservation-schema-invariants.ts` | — | external backup taken; `assertDisposableTarget` before every command; apply → rollback → reapply on the disposable target only; `pg_catalog` drift zero; invariants 0/non-zero/0 |
| A2 | `src/lib/reservations/**`, its harness | A1 | tenant+venue isolation, capacity fail-closed, overlap refusal proven by two genuinely interleaved transactions, guarded transitions, idempotent replay returns the original row and writes no second event, append-only ledger, refusals leave zero rows/events |
| A3 | `src/app/api/platform/reservations/**`, its harness | A2 | real route factories, four verbs × anonymous/wrong-tenant/authenticated-without-surface/valid-owner, byte-identical foreign-vs-nonexistent responses, envelope revalidated after storage filtering |
| A4 | `src/components/business-os/**` reservations panel + page wiring | A3 | explicit loading/empty/401/403/dependency-error wording, no sample operational data, capacity and overlap refusals surfaced as actionable messages, surface/render/a11y 0 |
| A5 | `src/lib/business-os/{engines,blueprints}.ts` + validation | A2 | strictly additive; `venueOrders.reservations` → `available`; `commerce.inventory` stays `partial`; negative test proves an `active` blueprint requiring a `planned` capability is still rejected |
| A6 | adversarial re-run, no new product paths | A2–A5 | every A2–A5 harness re-run by root; restaurant Phase 0–1 surface unbroken; `check-restaurant-phase0-behavior` 0; secret scan clean; `npm audit --omit=dev` 0; build 0 |

Standing constraints for every Wave A package: no live `personalink` mutation, no migration or
cutover against it, no push/PR/deploy, no tunnel, no concurrent Prisma writers, and no
modification of the six frozen evidence worktrees or the preserved untracked user files.

### Then, in dependency order
Wave B appointments engine (B1 schema → B2 availability/conflict → B3 lifecycle/deposits/waitlist/
reminders → B4 UI/customer API), Wave C cases/projects engine (C1–C3), Wave D content/cohorts
engine (D1–D3), Wave E truthful vertical activation (E1–E4 after their engines are green, E5 retail
stays `draft` while `commerce.inventory` is `partial`). Healthcare/clinics/hospitals remain
blueprint-only. P1-007 live cutover is NOT executed.



## Wave A — INTEGRATED 2026-08-29 at `79abb14`

Queue is empty for Wave A. Nothing awaits integration. Nothing pushed; origin remains
`4b386d1`.

| Order | Package | Commit | Scope |
|---|---|---|---|
| 1 | A1 schema (exclusive `prisma/**`) | `d4cfe40` | `Reservation`, `ReservationEvent`, 3 enums, exclusion constraint, append-only trigger |
| 2 | A2 engine | `1a306b6` | `src/lib/reservations/**` |
| 3 | A3 API | `7456491` | `src/app/api/platform/reservations/**` |
| 4 | A5 blueprint | `4972424` | capability maturity truthfulness |
| 5 | A4 UI | `8da2294` | owner reservations panel |
| 6 | A6 report | `4ff7ff4` | `WAVE_A_RESERVATIONS.md` |

Merged `--no-ff` at `79abb14716000726276743b5a77098f349f10a0c`, zero conflicts, 20 files,
all inside declared Wave A ownership. **Root implemented and reviewed every package; no
worker independence is claimed.** A5 preceded A4 because it depends only on A2.

Rejected: none.

## Blocker status update

- **Blocker 5 — HALF CLOSED.** `venueOrders.reservations` is now a real persisted model
  related to `RestaurantTable`, with tenant/venue isolation, fail-closed capacity, overlap
  refusal at the write boundary, guarded transitions and an append-only ledger.
  `commerce.inventory` remains `planned` and is explicitly not claimed — it is still a
  single nullable `stock` column. **Blocker 5 stays open for the inventory half.**
- Blockers 1 (repo-wide lint) and the new FK-drift item below remain open.

## New open items discovered during Wave A

1. **Pre-existing `profileId` FK drift.** `prisma migrate diff` wants to drop the
   `profileId` foreign keys on `ActivityEvent`, `Contact`, `ContactSourceLink`,
   `WorkflowRun` and `Workspace`, because `schema.prisma` declares those columns with no
   relation field while `20260827140000_phase0_foundations` created real FK constraints.
   Wave A deliberately excluded those statements rather than strip referential integrity
   from five existing tables inside a reservations migration. Needs its own decision:
   either add the relation fields to `schema.prisma` or intentionally drop the FKs.
2. **`check-order-stream` requires a running dev server.** It exits 1 with `fetch failed`
   against `127.0.0.1:3000`. Confirmed pre-existing — it fails identically at the
   pre-Wave-A source. Needs a documented precondition or an in-process transport stub so
   it stops reading as a failure.
3. **Reservations with history cannot be deleted** while the append-only trigger is armed,
   because `Reservation` cascades onto `ReservationEvent`. Correct for an audit ledger, but
   it means no delete path exists; if one is ever needed it requires an explicit archival
   decision.

## Next in queue — Wave B appointments engine, READY

Base `79abb14`. Must **wrap** the existing `Booking`, `AvailabilitySchedule`,
`CalendarOverride` and `ServiceOffering` models. Do not fork a parallel industry-specific
appointment system.

| Pkg | Owner paths | Depends on | Required proof |
|---|---|---|---|
| B1 | `prisma/**` (EXCLUSIVE) + schema harness | — | additive only; external backup; `assertDisposableTarget` before every command; apply/rollback/reapply on the disposable target; catalog drift zero |
| B2 | `src/lib/appointments/**` availability + conflict | B1 | availability windows with overrides; conflict refusal proven under genuinely interleaved transactions; tenant isolation; idempotency; append-only events |
| B3 | lifecycle, deposits, waitlist, reminders | B2 | guarded transitions incl. cancellation/no-show; **no real Stripe call and no real email/SMS**; harness asserts the provider was NOT invoked on refusal |
| B4 | appointments UI + customer API | B3 | four principal classes; byte-identical foreign-vs-nonexistent; surface/render/a11y 0; explicit loading/empty/401/403/error wording |

The Wave A row-lock-then-predicate pattern should be reused for B2 conflict prevention, and
the same two-layer approach considered, since it is now proven in this codebase.

Then Wave C cases/projects, Wave D content/cohorts, Wave E truthful vertical activation
(retail stays `draft` while inventory is `partial`). Healthcare/clinics/hospitals remain
blueprint-only. P1-007 live cutover is NOT executed.



## Wave B B1-B2 — INTEGRATED 2026-08-29 at `e1372a3`

Nothing pushed; origin remains `4b386d1`. **Root implemented and reviewed both packages;
no worker independence is claimed** — the gateway listener on port 5476 was absent and no
model-pinning dispatch tool was exposed.

| Order | Package | Commit | Scope |
|---|---|---|---|
| 1 | B1 appointment schema (exclusive `prisma/**`) | `3ebe8a1` | 7 enums, 6 tables, 11 Booking columns, 4 Booking indexes, partial exclusion constraint, append-only trigger |
| 2 | B2 availability + conflict engine | `8e76bf0` | `src/lib/appointments/**`, plus a correction to the already-integrated Wave A reservations engine |

Merged `--no-ff` at `e1372a3d764d1daa92e44211bfe58039880d6f6d`, zero conflicts.

### Wave A correction shipped in B2 — read this before trusting any overlap check

The Wave A reservations engine's application-level overlap check was **inert**. Against a
`timestamp without time zone` column, Prisma writes a `Date` by its UTC components but
binds a `Date` parameter in raw SQL as local wall-clock; on a UTC+05:30 host the predicate
was silently false and `Reservation_no_overlap` was the only thing preventing
double-booking. Wave A's drop-the-constraint experiment had appeared to prove otherwise,
but it used raw parameters for both its insert and its select, so it was self-consistent
and did not reproduce the real engine's asymmetry.

Both engines now use Prisma's typed `count()`. Each records which layer refused, and both
harnesses assert an application-detected conflict, so this cannot regress silently.

**Standing rule for future waves:** do not pass JS `Date` objects as raw-SQL parameters
against `timestamp without time zone` columns. Use the typed query API, or bind explicit
naive-UTC strings with a `::timestamp` cast.

## Next in queue — Wave B B3 and B4, READY

Base `e1372a3` (or newer primary). The Wave B worktree
`../personai-wave-b-appointments-wt` is clean at `8e76bf0` with its own real
`node_modules` and can be reused.

| Pkg | Owner paths | Depends on | Required proof |
|---|---|---|---|
| B3 | `src/lib/appointments/**` lifecycle/waitlist/deposit/reminder services + harness | B2 | guarded deposit and waitlist transitions; reminder scheduling idempotent on the `(bookingId, channel, sendAt)` unique key; **no real Stripe/email/SMS/WhatsApp call**; harness asserts the provider was NOT invoked on refusal; append-only event per accepted transition |
| B4 | `src/app/api/platform/appointments/**`, `src/components/business-os/appointments-panel.tsx` + shell mount, route and a11y harnesses | B3 | four principal classes; byte-identical foreign-vs-nonexistent; 400/409/503 split; zero writes and zero provider calls on refusal; explicit loading/empty/401/403/conflict/dependency wording; no fabricated persisted data |

The schema for waitlist, deposits and reminders already exists from B1, so B3 is runtime
and service work only — no further migration is required.

Then Wave C cases/projects, Wave D content/cohorts, Wave E truthful vertical activation.
Healthcare/clinics/hospitals remain blueprint-only. P1-007 live cutover is NOT executed.

### Open items carried forward
1. **Pre-existing `profileId` FK drift** — now excluded by TWO waves. Any future
   `prisma migrate diff` will re-emit the five `DropForeignKey` statements against
   `ActivityEvent`, `Contact`, `ContactSourceLink`, `WorkflowRun`, `Workspace`. Exclude
   them again until this gets its own decision.
2. **`commerce.inventory` still `planned`** — blocker 5 remains half open; retail cannot
   honestly leave `draft`.
3. **`check-order-stream` needs a running dev server** — pre-existing, confirmed identical
   at the pre-Wave-A source.
4. **Appointments and reservations with history cannot be deleted** while their append-only
   triggers are armed. Correct for an audit ledger; needs an explicit archival decision if
   a delete path is ever required.



## Wave B COMPLETE — B3-B4 INTEGRATED 2026-08-29 at `ce6348c`

Nothing pushed; origin remains `4b386d1`. **Root implemented and reviewed all four
packages; no worker independence is claimed.**

| Order | Package | Commit | Scope |
|---|---|---|---|
| 3 | B3 services | `2789e50` | waitlist, deposits, reminders, injected inert providers |
| 4 | B4 API + UI | `0b33887` | ten routes, owner panel, twelve new a11y assertions |

Merged `--no-ff` at `ce6348c62d1f9c17a7b72eb26b2b3e551f73b34d`, zero conflicts. `P2-005` is
`done`. Wave B queue is empty.

Gate summary on the integrated tip: four appointment harnesses `0/1/0` with 39, 43, 49 and
56 assertions; 13/13 no-DB and 19/19 DB-backed regressions 0; audit 0 vulnerabilities;
build 0 with all ten routes dynamic; 21 files changed, zero forbidden paths.

### Standing rule earned in this wave
External capability that costs money or reaches a customer must be an **injected interface
with an inert default**, not an inline call. That is what makes "no provider was contacted"
a countable assertion instead of a promise, and it is why an unavailable provider here
leaves a deposit `REQUIRED` and a reminder `SCHEDULED` rather than recording something that
did not happen.

## Next in queue — Wave C cases/projects engine, READY

Base `ce6348c` or newer primary. Needs a fresh isolated worktree with real `node_modules`
(never a junction).

**Inspect and REUSE before adding anything.** These already exist and must not be
duplicated: `Contact` and `ContactSourceLink`; `ActivityEvent` (append-only);
`TaskJob` durable queue; `Approval` with `WorkflowRun`/`WorkflowStep`; `Workspace`,
`Location`, `Membership`, `MembershipLocation`; `ProfileDocument`; `Payment` and
`ProductPurchase`; `CopilotAuditEvent`. Wave C should compose these, not create parallel
contact, task, approval or audit systems.

| Pkg | Owner paths | Required proof |
|---|---|---|
| C1 | `prisma/**` EXCLUSIVE + schema harness | additive only; fresh external backup; `assertDisposableTarget` before every command; apply → rollback → reapply with normalized catalog comparison; **exclude and count-assert the five pre-existing `profileId` DropForeignKey statements**; reuse `reject_append_only_mutation()` |
| C2 | `src/lib/cases/**` + harness | intake → brief → case; milestone/deliverable/document-request transitions; compose existing tasks and approvals; billing state; tenant isolation; non-enumerating refusals; idempotency; append-only events; zero effects on refusal; `0/non-zero/0` |
| C3 | `src/app/api/platform/cases/**`, Business OS panel + harnesses | four principal classes; byte-identical foreign-vs-nonexistent; explicit loading/empty/401/403/dependency states; persisted data only; no real storage/payment/messaging call |

### Open items carried forward
1. **Pre-existing `profileId` FK drift** — excluded by TWO waves now. Any future
   `prisma migrate diff` re-emits five `DropForeignKey` statements against `ActivityEvent`,
   `Contact`, `ContactSourceLink`, `WorkflowRun`, `Workspace`. Exclude again until decided.
2. **`commerce.inventory` still `planned`** — blocker 5 half open; retail cannot leave
   `draft`.
3. **`check-order-stream` needs a running dev server** — pre-existing, confirmed identical
   at the pre-Wave-A source.
4. **No durable scheduler** — `dispatchDueReminders` and hold expiry are implemented and
   tested but nothing invokes them periodically. Needs either a real worker or explicit
   documentation that they are manual.
5. **No payment or messaging provider wired** — deliberate. Wiring one requires editing
   `src/lib/appointments/runtime.ts` and must come with tests that the live adapter is only
   reached on accepted paths.



## Wave C C1 — INTEGRATED 2026-08-29 at `d08a5a4`

Nothing pushed; origin remains `4b386d1`. **Root implemented and reviewed; no worker
independence is claimed.**

| Order | Package | Commit | Scope |
|---|---|---|---|
| 1 | C1 cases schema (exclusive `prisma/**`) | `fc5bcef` | 8 enums, 10 tables, append-only trigger |

Merged `--no-ff` at `d08a5a4aa18ac33c1fb2f8374e03ce3cf4a1ede6`, zero conflicts. Gates:
invariant harness `0/1/0` with 36 assertions; relation-rename verifier 0 across 63
pre-existing models; 13/13 no-DB and 20/20 DB-backed regressions 0; audit 0; build 0.

### Standing rule earned in this package
**`prisma migrate diff` is not sufficient to prove a schema edit was safe.** It compares
DATABASE schema, and Prisma relation *field names* are client-side only, so a rename that
breaks every consumer produces a clean SQL diff. After any `prisma format` or bulk schema
edit, also run the relation-name verifier at
`%TEMP%\personalink-phase0\wave-c\verify-no-renames.js`, which compares field names between
the committed schema and the working copy across all models.

Related: do not use PowerShell `-replace` with a double-quoted capture-group reference —
the shell interpolates it as an undefined variable and silently deletes the matched text.
Use an editing tool. And send long commit messages through `git commit -F <file>`; a
literal `$1` in `-m` broke escaping badly enough that git read part of the message as a
path.

## Next in queue — Wave C C2 and C3, READY

Base `d08a5a4` or newer primary. The Wave C worktree `../personai-wave-c-cases-wt` is clean
at `fc5bcef` with its own real `node_modules` and can be reused. **No further migration is
required** — C1 created everything C2 and C3 need.

| Pkg | Owner paths | Required proof |
|---|---|---|
| C2 | `src/lib/cases/**` + harness | intake → brief → active case; milestone, deliverable and document-request transitions; compose existing `TaskJob` and `Approval` rather than reimplementing; `CaseInvoiceState` transitions; tenant isolation on `workspaceId`; non-enumerating foreign-vs-missing refusals; idempotency on `(workspaceId, idempotencyKey)`; append-only `CaseEvent` per accepted change; zero effects on refusal; `0/non-zero/0` |
| C3 | `src/app/api/platform/cases/**`, `src/components/business-os/cases-panel.tsx` + shell mount, route and a11y harnesses | four principal classes; byte-identical foreign-vs-nonexistent; 400/409/503 split; explicit loading/empty/401/403/dependency wording; persisted data only; contacts, tasks and approvals rendered through the existing shared systems; no real storage, payment or messaging call |

Reuse the patterns already proven here: Prisma **typed** queries for any time comparison
(never raw `Date` parameters), injected inert adapters for anything external, and a
layer-attribution field on conflict errors so a harness can prove the application check is
live rather than masked by a database constraint.

Then Wave D content/cohorts, Wave E truthful vertical activation, commerce inventory
hardening, P1-009 scoped lint. Healthcare/clinics/hospitals remain blueprint-only. P1-007
live cutover is NOT executed.


---

## Wave C COMPLETE — C2 and C3 INTEGRATED 2026-08-29 at `862e5ef`

| Pkg | Commit | Paths | Proof |
|---|---|---|---|
| C2 runtime | `9bd9529` | `src/lib/cases/{lifecycle,shared,engine,workflow,index}.ts`, `scripts/one-off/check-case-runtime.ts` | 67 assertions, 0/1/0 |
| C3 APIs + UI | `6187893` | `src/lib/cases/{http,runtime}.ts`, 18 routes under `src/app/api/platform/cases/**` and `/case-intakes/**`, `src/components/business-os/{cases-panel,case-detail-panel,cases-shared}`, shell mount, `scripts/one-off/check-case-routes.ts`, 19 new assertions in `check-business-os-a11y` | 75 assertions, 0/1/0 |

Neither package required a migration. The disposable rehearsal database is **fully applied**
and was used only to run harnesses.

Combined gates on `862e5ef`: `prisma validate`/`generate` 0 · `tsc` 0 · targeted `eslint` 0 ·
relation-rename verifier 0 renamed across 73 pre-existing models · **35/35** check harnesses
exit 0 · `npm audit --omit=dev` 0 · `npm run build` 0 · secret scan 0 real hits.
`check-order-stream` remains excluded as a known non-blocking precondition.

P2-006 is `done`.

### Standing rules earned in this package

1. **Validate an enum against its lifecycle table at the HTTP boundary, not in the engine.**
   Otherwise "that is not a status" and "that is not a legal move from here" collapse into one
   409 and the owner cannot tell a typo from a workflow error. `http.ts` does this with a
   single `status()` helper that takes the flow's own type guard.
2. **Let the server compute `allowedTransitions` and have the UI render only those.** A client
   that re-derives the transition table will eventually offer a button the write boundary
   refuses. `CaseRecord.allowedTransitions` closes that gap for cases; the sub-flows import the
   same `lifecycle.ts` the server enforces.
3. **Compare non-enumerating refusals by string equality of the whole body.** Asserting two
   403s is not the same claim as asserting two *identical* 403s, and only the second one is
   falsifiable.
4. **Where a NOT NULL foreign key forces a parent row, create the real parent.** `Approval`
   requires a `WorkflowRun`, so case approvals create one. Inventing a nullable column or a
   placeholder row would have forked the approval ledger.

---

## Next in queue — Wave D content/cohorts, READY

Base `862e5ef` or newer primary.

Before writing any schema, inspect the existing `Course`, `CourseModule`, `CourseLesson`,
`CourseEnrollment`, `LessonCompletion` and `Member` models plus
`check-course-profile-actions-authz`. Promote what exists behind shared content/cohort
contracts. **Do not create a coaching-only fork**, and do not rename a pre-existing model or
Prisma relation field.

| Pkg | Owner paths | Required proof |
|---|---|---|
| D1 | `prisma/schema.prisma`, one migration, `scripts/one-off/check-cohort-schema-invariants.ts` | only the genuinely missing persistence for programs/courses, cohorts/batches, enrolment/membership, attendance, assignments and submissions, progress, certificates, renewal/reminder state, append-only cohort events, idempotency and tenant scoping; fresh external backup; exact disposable-target guard; apply → rollback → reapply; catalog comparison; relation-name verifier; exclude and count-assert the five known pre-existing `profileId` `DropForeignKey` statements against `ActivityEvent`, `Contact`, `ContactSourceLink`, `WorkflowRun`, `Workspace` |
| D2 | `src/lib/cohorts/**` + harness | enrolment lifecycle, cohort membership, attendance, assignment submission, progress computed from persisted records only, certificate eligibility/issuance state, renewal/reminder scheduling, tenant isolation, idempotency, append-only history, zero provider calls; `0/non-zero/0` |
| D3 | cohort console + learner-safe APIs + harnesses | four principal classes, byte-identical foreign-vs-nonexistent, 400/409/503 split, explicit loading/empty/401/403/dependency states, persisted data only. The coaching blueprint stays **draft** until every capability it claims is genuinely available |

Do not begin D1 with less than 90 minutes of safe time remaining: it is the only package in
this wave that mutates a database.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged.
- Pre-existing `profileId` FK drift: still five `DropForeignKey` statements that any generated
  migration will include. Excluded and count-asserted, never applied. Untouched here.
- `check-order-stream` precondition: still unmet, still non-blocking.
- P1-009 repo-wide lint cleanup: still deferred until feature waves cannot safely start.
- Gateway on port 5476: still absent. Every wave so far has been root-serial.


---

## Wave D COMPLETE — D1, D2 and D3 INTEGRATED 2026-08-29 at `c516703`

| Pkg | Commit | Paths | Proof |
|---|---|---|---|
| D1 schema | `48e448d` | `prisma/schema.prisma`, `prisma/migrations/20260829130000_content_cohorts_foundation`, `scripts/one-off/check-cohort-schema-invariants.ts` | 60 invariants, 0/1/0 |
| D2 runtime | `4d35deb` | `src/lib/cohorts/{lifecycle,shared,progress,engine,workflow,index}.ts`, `scripts/one-off/check-cohort-runtime.ts` | 114 assertions, 0/1/0 |
| D3 APIs + console | `12d3f2f` | `src/lib/cohorts/{http,runtime}.ts`, 15 routes under `src/app/api/platform/cohorts/**` and `/course-enrollments`, `src/components/business-os/{cohorts-panel,cohort-detail-panel,cohorts-shared}`, shell mount, `scripts/one-off/check-cohort-routes.ts`, 22 new assertions in `check-business-os-a11y` | 87 assertions, 0/1/0 |

D1 rehearsed apply → rollback → reapply on the disposable target only, left **fully
applied** at 82 tables. Rollback was byte-identical to the pre-migration snapshot.

Combined gates on `c516703`: `prisma validate`/`generate` 0 · `tsc` 0 · targeted `eslint` 0 ·
relation-rename verifier 0 renamed across 81 pre-existing models · **38/38** check harnesses
exit 0 · `npm audit --omit=dev` 0 · `npm run build` 0 · secret scan 0 real hits.

P2-008 is `done`.

### Standing rules earned in this package

1. **`prisma migrate diff` is not proof that a `prisma format` run was cosmetic.** Diff the
   schema *semantically*: parse every `model` and `enum` block, normalize whitespace, and
   report which blocks changed. That is how this wave showed the five auto-inserted opposite
   relation fields plus one deliberate column were the only changes to pre-existing models.
   The tool is at `%TEMP%\personalink-phase0\wave-c\schema-semantic-diff.js`.
2. **Assert the exact expected diff shape in the migration builder, not just the absence of
   drops.** This wave's builder aborts unless it sees exactly one `ADD COLUMN`, and only the
   named one. A generic "no DROP" filter would have let an unintended column through.
3. **A nullable column plus a unique index is a safe way to add idempotency to a legacy
   table** — but prove it, because the claim rests on NULLs being distinct in Postgres. The
   harness inserts three NULL-key rows in the same course.
4. **Do not cache a derived figure.** Progress has no column; it is computed from the
   completion, submission and attendance rows on every read, and the schema harness fails if
   a `progress` or `percent` column ever appears on a cohort table.
5. **Store the policy, not the threshold.** Certificate eligibility reads
   `attendanceThresholdPct`, `requireAllAssignments` and `requireAllLessons` off the cohort,
   so an owner can see and change the rule instead of it living in a function.
6. **A state that asserts an external effect must require the record of that effect.**
   `REMINDED` requires a linked `TaskJob`; without that rule the state would claim a
   reminder that was never queued.

---

## Next in queue — Wave E truthful vertical activation, READY

Base `c516703` or newer primary.

Wave A gave restaurants reservations, Wave B gave appointments, Wave C gave cases and
projects, Wave D gave cohorts. That is enough for four blueprints to stop being aspirational,
**provided each claimed capability is checked against what actually exists** rather than
against what a wave was named after.

| Pkg | Owner paths | Required proof |
|---|---|---|
| E1 | blueprint/capability definitions + `check-capability-contract` | for each of restaurant, coaching, consulting and CA: enumerate the capabilities the blueprint claims, and show a persisted runtime and a route or surface for every one. Activate only those. A blueprint with one unmet capability stays draft. |
| E2 | `check-capability-contract`, `check-business-os-surface` | the contract harness must FAIL if a blueprint is marked active while any capability it claims has no runtime. Prove it by inverting. |

**Retail stays draft** while `commerce.inventory` is planned rather than built. Do not
activate it to make a table look complete.

Commerce inventory hardening is the next feature package after Wave E, and needs at least 90
minutes because it touches schema.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged.
- Pre-existing `profileId` FK drift: still five `DropForeignKey` statements that any generated
  migration will include. Excluded and count-asserted for the fourth wave. Untouched.
- `check-order-stream` precondition: still unmet, still non-blocking.
- P1-009 repo-wide lint cleanup: still deferred until feature waves cannot safely start.
- Gateway on port 5476: still absent. Every wave so far has been root-serial.


---

## Wave E COMPLETE — INTEGRATED 2026-08-29 at `e91f6c7`

Single package `239a4e0`. No migration, no runtime change. P2-009 is `done`.

Active blueprints after this wave: `restaurant-venue-v2`, `coaching-studio-v2`,
`consulting-agency-v1`, `ca-practice-v1`. Deprecated: `restaurant-venue-v1`,
`coaching-studio-v1`. Draft: `retail-storefront-v1`.

Gates on `e91f6c7`: `tsc` 0 · targeted `eslint` 0 · `check-capability-contract` PASS with
`INVERT_ASSERTION=1` failing all five overclaim guards · 38/38 check harnesses exit 0 ·
`npm audit --omit=dev` 0 · `npm run build` 0.

### Standing rules earned in this package

1. **A maturity flag is not evidence; check the evidence path exists on disk.** This caught
   `appointments:availability` citing a file that had been deleted. Nothing else had noticed.
2. **`partial` must be rejected for an active blueprint's required capability, not just
   `planned`.** A persisted record with an inert provider is exactly the case a single
   planned/available split cannot express.
3. **When a capability is promoted, split out anything its description promised but does not
   do.** `retainers` and `accessLevels` became their own planned capabilities rather than
   staying as words inside a capability now marked available. A description is unchecked; a
   capability is checked.
4. **Give every negative test a non-vacuity assertion.** The planned-rejection test targets
   `commerce:inventory` and the partial-rejection test targets `appointments:reminders`; the
   harness fails if either stops having that maturity, so the test cannot start passing for
   free the way the original reservations-based test would have.
5. **Prefer a new version over rewriting a contract that overclaimed.** `coaching-studio-v1`
   is deprecated and retained; `v2` claims only what exists. Same pattern as restaurant
   v1→v2.

---

## Next in queue — commerce inventory hardening, READY

Base `e91f6c7` or newer primary. This is the last thing blocking a truthful retail vertical.

**What exists today:** `DigitalProduct.stock Int?` — one nullable column. Nothing decrements
it, nothing reserves against it, there is no location dimension, no movement history and no
oversell refusal. `OrderLine` carries `qty` and adjusts no stock.

| Pkg | Owner paths | Required proof |
|---|---|---|
| F1 | `prisma/schema.prisma`, one migration, `scripts/one-off/check-inventory-schema-invariants.ts` | per-location stock records; an append-only movement ledger; reservations with expiry tied to an order line; idempotency and tenant scoping; reuse `DigitalProduct`, `Order`, `OrderLine` and `Location` rather than forking a product or order model; full apply → rollback → reapply rehearsal on the disposable target with catalog comparison and the relation-name verifier; the five known `profileId` `DropForeignKey` statements excluded and count-asserted |
| F2 | `src/lib/inventory/**` + harness | reserve, release and consume against a locked row so two concurrent orders cannot oversell the last unit; refuse oversell at the write boundary; idempotent replay; tenant isolation; non-enumerating refusal; append-only movements; zero residue on refusal; no external call |
| F3 | routes + Business OS panel + harnesses | four principal classes, byte-identical foreign-vs-nonexistent, 400/409/503 split, explicit loading/empty/401/403/dependency states, persisted data only |

**Only after F3 exists may `commerce:inventory` become `available` and
`retail-storefront-v1` become active.** After F1 and F2 alone it should be `partial`, which
the contract harness will automatically keep retail in draft for, because a required
capability of an active blueprint must be `available`.

Do not begin F1 with less than 90 minutes remaining: it mutates a database.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged.
- Pre-existing `profileId` FK drift: five `DropForeignKey` statements, excluded and
  count-asserted for four waves running. Untouched.
- `check-order-stream` precondition: still unmet, still non-blocking.
- P1-009 repo-wide lint cleanup: still deferred.
- `appointments:reminders` and `appointments:deposits` are partial because their providers
  are inert. Wiring a real provider is a separate, owner-gated decision.
- `casesProjects:retainers` and `contentCohorts:accessLevels` are newly visible planned gaps.
- Gateway on port 5476: still absent. Every wave has been root-serial.


---

## Wave F COMPLETE — F1, F2 and F3 INTEGRATED 2026-08-29 at `7bfc868`

| Pkg | Commit | Paths | Proof |
|---|---|---|---|
| F1 schema | `ca90b9a` | `prisma/schema.prisma`, `prisma/migrations/20260829150000_commerce_inventory_foundation`, `scripts/one-off/check-inventory-schema-invariants.ts` | 50 invariants, 0/1/0 |
| F2 runtime | `0d59dc8` | `src/lib/inventory/{lifecycle,shared,engine,index}.ts`, `scripts/one-off/check-inventory-runtime.ts` | 85 assertions, 0/1/0 |
| F3 APIs + console | `a723078` | `src/lib/inventory/{http,runtime}.ts`, 6 routes under `src/app/api/platform/inventory/**`, `src/components/business-os/inventory-panel.tsx`, shell mount, `scripts/one-off/check-inventory-routes.ts`, 20 new assertions in `check-business-os-a11y`, contract updates | 58 assertions, 0/1/0 |

Disposable target left **fully applied** at 85 tables; rollback was byte-identical to the
pre-migration snapshot.

Combined gates on `7bfc868`: `prisma validate`/`generate` 0 · `tsc` 0 · targeted `eslint` 0 ·
relation-rename verifier 0 renamed across 84 pre-existing models · **41/41** check harnesses
exit 0 · `npm audit --omit=dev` 0 · `npm run build` 0 · secret scan 0 real hits.

P2-010 is `done`. Active blueprints: `restaurant-venue-v3`, `coaching-studio-v2`,
`consulting-agency-v1`, `ca-practice-v1`. Draft: `retail-storefront-v1`.

### Standing rules earned in this package

1. **Put a guarantee in a CHECK constraint, then prove the constraint refuses a direct
   write.** `reserved <= onHand` is not a convention any more. The harness bypasses the
   engine entirely to show the database enforces it, which means the guarantee survives a
   future bug in application code.
2. **Store deltas AND resulting balances in a ledger.** A delta-only ledger cannot be
   checked against the row it explains. Both inventory harnesses replay the deltas and
   require them to reproduce the stored after-values.
3. **Measure a concurrency claim by running it concurrently.** Two parallel `reserve()`
   calls at one unit of stock, asserting exactly one winner, is the only honest form of "we
   take a row lock".
4. **Refuse a state that asserts an effect the record cannot support.** An untracked stock
   record cannot hold a reservation; a hold with no expiry cannot be expired.
5. **A `plannedCapabilities` entry for something that now exists is a false statement.**
   When Wave F made inventory real, restaurant v2 had to be superseded rather than quietly
   edited, because its backlog entry became untrue.
6. **When you promote a capability, re-point every negative test that depended on it being
   unbuilt.** The planned-rejection test has now moved twice. The non-vacuity assertion
   beside it is what makes that a build failure rather than a silent hole.
7. **Avoid schema objects Prisma cannot express only when there is a real alternative.** A
   required `locationId` was chosen over a partial unique index precisely because this
   repository already pays a drift tax on every generated migration.

---

## Next in queue — three candidates, none started

Base `7bfc868` or newer primary. In rough order of value:

| Pkg | Scope | Notes |
|---|---|---|
| G1 | commerce variants + fulfilment + returns | The last three capabilities blocking `retail-storefront-v1`. `variants` and `fulfilment` are currently *partial* with evidence pointing at a quick-add sheet; `returns` is planned. Needs schema, so allow 90+ minutes. Finishing all three is what lets retail become active, and the contract harness will then need its retail assertions repointed the same way Wave F repointed the inventory ones. |
| G2 | appointments reminders + deposits providers | Both are *partial* because their provider boundaries are inert. Wiring a real messaging or payment provider is an **owner-gated** decision — it means real messages and real money — so this should not be started without explicit approval. Until then, `coaching-studio-v2` correctly lists them as planned. |
| G3 | `casesProjects:retainers`, `contentCohorts:accessLevels` | The two gaps Wave E split out of over-broad capability descriptions. Smaller than G1; each needs schema plus runtime. |

Do not begin any schema package with less than 90 minutes remaining.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged.
- Pre-existing `profileId` FK drift: five `DropForeignKey` statements, excluded and
  count-asserted for five waves running. Untouched.
- `check-order-stream` precondition: still unmet, still non-blocking.
- P1-009 repo-wide lint cleanup: still deferred.
- Gateway on port 5476: still absent. Every wave has been root-serial.


---

## Wave G integrated - G1 is done, so the queue above is superseded

Merge `dd84acc` on `recovered/aug20-wt-pr-32`, `--no-ff`, from base `34f8561` via
`feature/wave-g-commerce`. Root-serial; gateway recovery attempted once, bounded, recorded
`ORCHESTRATION_UNAVAILABLE`.

| Commit | Slice | Gate result at commit time |
|---|---|---|
| `816b8f7` | G1.1 schema | `check-commerce-schema-invariants` 85/85; rollback byte-identical; reconciliation 10/10 / 7/7 / 10/10 |
| `c0a183f` | G1.2 runtime | `check-commerce-runtime` 110/110 |
| `37991e6` | G1.3 APIs + UI | `check-commerce-routes` 78/78 (inverted 77/78, exit 1); a11y 127 assertions; build 0 with 16 routes |
| `5f189e6` | G1.4 capability | `check-capability-contract` PASS; inverted 18 failures; 44/44 sweep |
| `dd84acc` | integration | full combined suite green - see RUNLOG for the table |

**`retail-storefront-v1` is now ACTIVE.** That was the single item this queue listed as the
highest-value remaining package, and it is closed. `commerce:variants`, `:fulfilment` and
`:returns` are all `available` with evidence files that exist on disk.

### Next in queue - revised after Wave G

| Pkg | Scope | Notes |
|---|---|---|
| G3 | `casesProjects:retainers`, `contentCohorts:accessLevels` | The two remaining truthful capability gaps. Each needs schema plus runtime, so allow 90+ minutes; one schema owner, same rehearsal discipline as G1. Promotion only after runtime evidence exists. Neither may execute a real payment. |
| G4 | shared `fieldJobs` engine foundation | `fieldJobs:intake`, `:dispatch` and `:inspection` are all planned, and nothing in the repo implements them. Note that `fieldJobs:dispatch` is now the target of the capability-contract planned-capability negative test, so whoever makes it real must repoint that test again - the non-vacuity assertion will fail loudly if they do not. |
| G2 | appointments reminders + deposits providers | Still **owner-gated**. Wiring a real messaging or payment provider means real messages and real money. `appointments:reminders` remains the target of the partial-capability negative test. |

Do not begin any schema package with less than 90 minutes remaining.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged. Not executed.
- Pre-existing `profileId` FK drift: five `DropForeignKey` statements, excluded and
  count-asserted for **six** waves running. Untouched.
- **New drift entry, deliberate:** `InventoryItem.productId` is kept alongside `variantId` and
  their agreement is enforced by a trigger rather than a composite foreign key, because Prisma
  cannot express one. This is a trigger the schema diff must keep surviving, like the five
  before it.
- `check-order-stream` precondition: still unmet, still non-blocking.
- P1-009 repo-wide lint cleanup: slice 1 done at `108846e`; 91 problems remain and the count is
  unchanged by Wave G. Slice 2 not started.
- Gateway on port 5476: now **LISTENING** (pid 54756), but no KiroCrew MCP server is registered
  with the client, so no model-pinned dispatch tool is exposed. Owner action: register it in
  `~/.kiro/settings/mcp.json` and restart the client. Every wave so far has been root-serial.


---

## Wave G3 integrated - the last two truthful capability gaps are closed

Merge `5a26b6b` on `recovered/aug20-wt-pr-32`, `--no-ff`, from base `1f172eb` via
`feature/wave-g3-retainers-access`. Root-serial.

| Commit | Slice | Gate result at commit time |
|---|---|---|
| `c4fb417` | G3.1 schema | retainer 73/73 and access 72/72 invariants; rollback byte-identical; 12-table row md5 identical at every stage |
| `d07c41d` | G3.2 runtime | retainer runtime 87/87, access runtime 79/79; second additive migration proven apply/rollback/reapply |
| `dd5b9ee` | G3.3 capability | `check-capability-contract` PASS, inverted 19 failures; 48/48 sweep |
| `5a26b6b` | integration | full combined suite green - see RUNLOG for the table |

`casesProjects:retainers` and `contentCohorts:accessLevels` are now `available` with evidence
files that exist. Three active blueprints stopped listing them as planned backlog entries.

### Next in queue - revised after Wave G3

| Pkg | Scope | Notes |
|---|---|---|
| G4 | shared `fieldJobs` engine foundation | The only engine with nothing built: `intake`, `dispatch` and `inspection` are all planned with evidence `none`. **Trap:** `fieldJobs:dispatch` is the current target of the capability-contract planned-capability negative test, so whoever makes it real must repoint that test. The non-vacuity assertion beside it will fail loudly if they do not, and the new sweeping check will fail if any blueprint is left listing it as planned. |
| P1-009 slice 2 | repo-wide lint | 91 problems remain and the count is unchanged by Waves F, G and G3. `no-unused-vars` (24) is the safest slice; `no-img-element` (25) and the react-hooks family (18) change behaviour and need judgement. |
| G2 | appointments reminders + deposits providers | Still **owner-gated**. Wiring a real messaging or payment provider means real messages and real money. `appointments:reminders` remains the target of the partial-capability negative test. |

Do not begin any schema package with less than 90 minutes remaining.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged. Not executed.
- Pre-existing `profileId` FK drift: five `DropForeignKey` statements, excluded and
  count-asserted for **eight** waves running. Untouched.
- `InventoryItem.productId` alongside `variantId`, agreement enforced by trigger because Prisma
  cannot express the composite key. Introduced in Wave G, unchanged.
- **New in G3, same category:** four cross-row invariants are triggers rather than composite
  foreign keys - a draw's period must belong to its retainer, a draw's case must be covered by
  it, a case link must not cross workspaces, and an entitlement's tier must belong to the
  enrolment's course. Each is a rule a composite FK would express if Prisma could describe one.
- **`restaurant-venue-v2` lists `commerce:inventory` as planned, and that is left alone on
  purpose.** It is a deprecated historical contract whose backlog was accurate when written. The
  capability-contract harness exempts it by name and asserts the exemption only ever covers
  deprecated blueprints.
- `check-order-stream` precondition: still unmet, still non-blocking.
- Gateway on port 5476: LISTENING (pid 54756), but no KiroCrew MCP server is registered with the
  client, so no model-pinned dispatch tool is exposed. Owner action: register it in
  `~/.kiro/settings/mcp.json` and restart the client. Every wave so far has been root-serial.


---

## Wave G4 integrated - the fieldJobs foundation

Merge `ef17770` on `recovered/aug20-wt-pr-32`, `--no-ff`, from base `61670da` via
`feature/wave-g4-fieldjobs`. Root-serial.

| Commit | Slice | Gate result at commit time |
|---|---|---|
| `20c509e` | G4.1 schema | 79/79 invariants; rollback byte-identical; strictly additive |
| `8d966af` | G4.2 runtime + promotion | 75/75 runtime assertions; contract PASS; 50/50 sweep |
| `ef17770` | integration | full combined suite green - see RUNLOG |

`fieldJobs:intake` and `fieldJobs:dispatch` are now `available`.
**`fieldJobs:inspection` is still `planned`, because it is not built.**

### Next in queue - revised after Wave G4

| Pkg | Scope | Notes |
|---|---|---|
| G5 | `fieldJobs:inspection` | Asset checks, parts, completion notes, invoice handoff. **Read the warning first:** inspection is the last `planned` capability in the registry, so promoting it leaves the capability-contract planned-capability negative test with nowhere to point. That test will need rewriting against a synthetic engine descriptor rather than repointing, and a new assertion already fails loudly with the surviving-planned list in its detail field when that happens. |
| APIs and UI | retainers, access levels, field jobs | Three engines now exist with no owner surface at all. No schema is needed, so any of them fits a short window. Follow the Wave G pattern: `src/lib/<domain>/{http,runtime}.ts` for one envelope and one resolve-then-authorize step, then a panel, then a11y assertions in `check-business-os-a11y.ts`. |
| P1-009 slice 2 | repo-wide lint | 91 problems, unchanged across Waves F, G, G3 and G4. `no-unused-vars` (24) is the safest slice. |
| G2 | appointments reminders + deposits providers | Still **owner-gated**. `appointments:reminders` remains the target of the partial-capability negative test. |

Do not begin any schema package with less than 90 minutes remaining.

### Open items carried forward

- P1-007 live cutover: still owner-gated, unchanged. Not executed.
- Pre-existing `profileId` FK drift: five `DropForeignKey` statements, excluded and
  count-asserted for **nine** waves running. Untouched.
- Trigger-instead-of-composite-FK entries, now six in total: `InventoryItem.productId` vs
  `variantId` (Wave G), the four G3 guards, and `FieldJobAssignment` job/technician profile
  agreement (G4). Each is a rule a composite foreign key would express if Prisma could describe
  one.
- `restaurant-venue-v2` lists `commerce:inventory` as planned, left alone on purpose. It is a
  deprecated historical contract; the harness exempts it by name.
- `check-order-stream` precondition: still unmet, still non-blocking.
- Gateway on port 5476: LISTENING (pid 54756), no KiroCrew MCP server registered with the client.
  Owner action. Every wave in this run has been root-serial.


---

## Retainers completed end to end

Two commits directly on `recovered/aug20-wt-pr-32`, not through a feature branch. That deviation
is recorded in RUNLOG and in P2-014 rather than glossed; neither commit carried a migration, and
every gate was run on exactly the integrated tree.

| Commit | Slice | Gate result |
|---|---|---|
| `9ca772e` | 10 HTTP routes | `check-retainer-routes` 62/62 (inverted 61/62); `check-case-routes` 75/75; 51/51 sweep |
| `4ebaf2a` | owner panel | `check-business-os-a11y` PASS at 150 assertions; 51/51 sweep; build 0 |

Retainers now have schema, runtime, an HTTP surface and an owner panel.

### Next in queue

| Pkg | Scope | Notes |
|---|---|---|
| Access-level surface | API + panel for `contentCohorts:accessLevels` | The engine exists with no surface. **Extra wrinkle:** there are TWO principals. `CourseAccessService` is the owner path and composes `CohortContext`; `LearnerAccessService` takes no `workspaceId` at all and must not start accepting one, because that would hand a learner a probe for other people's tenancy. Two route trees, not one. |
| Field-job surface | API + panel for `fieldJobs:intake` and `:dispatch` | The engine exists with no surface. Single principal, so simpler than access levels. |
| G5 | `fieldJobs:inspection` | Read the empty-registry warning in NEXT_ACTION first: it is the last `planned` capability anywhere, so promoting it means REWRITING the capability-contract planned negative test against a synthetic descriptor, not repointing it. |
| P1-009 slice 3 | repo-wide lint | 78 problems. `no-unused-vars` is down to 11 and the survivors are documented in P1-009 as needing judgement; `no-explicit-any` (24) is the next largest tractable rule. |
| G2 | appointments providers | Still **owner-gated**. |

The retainer package is the worked example for the two surface packages above, and it shows the
cheaper route: add methods to the domain's EXISTING api service rather than creating a second HTTP
boundary, because a second boundary is a second place for the envelope, the status map and the
server-derived actor to drift.


---

## Field jobs completed end to end

Two commits directly on `recovered/aug20-wt-pr-32`: `3185a58` (10 routes,
`check-fieldjob-routes` 53/53) and `3de518b` (owner panel, `check-business-os-a11y` at 175
assertions). 52/52 sweep on both.

Field jobs and retainers now each have schema, runtime, an HTTP surface and an owner panel.

### Next in queue

| Pkg | Scope | Notes |
|---|---|---|
| Access-level surface | API + panel for `contentCohorts:accessLevels` | The last promoted capability with no surface. **TWO principals:** `CourseAccessService` is the owner path and composes `CohortContext`; `LearnerAccessService` takes no `workspaceId` at all and must not start accepting one. Two route trees. The learner tree also has a different identity source — `Member` via the `pl_member` cookie, not Clerk — so it cannot reuse `PersistedTenancy` at all. |
| G5 | `fieldJobs:inspection` | Read the empty-registry warning first: it is the last `planned` capability anywhere, so promoting it means REWRITING the capability-contract planned negative test against a synthetic descriptor, not repointing it. |
| Wire visibility into the reader | `src/app/library/courses/[id]/page.tsx` | The access-level engine exists and computes visibility, but the actual learner content page still returns every lesson. Until that page calls `LearnerAccessService`, tiers are enforceable but not enforced. **This is the most honest remaining gap in the whole program** and it is not a capability-registry problem - `contentCohorts:accessLevels` claims tiers and entitlements, which exist, not that the library page consults them. |
| P1-009 slice 3 | repo-wide lint | 78 problems. `no-explicit-any` (24) is the next largest tractable rule. |
| G2 | appointments providers | Still **owner-gated**. |


---

## Access levels completed end to end — and orchestration measured, not assumed

Three commits directly on `recovered/aug20-wt-pr-32`, root-serial. Base `d04644f`, head `2b76c3e`.

| Commit | Slice | Gate result |
|---|---|---|
| `4ad49f3` | 10 owner routes + 14 api methods | new `check-course-access-api` 86/86 (inverted → exit 1); `check-cohort-routes` 87/87 after the widened ctor |
| `3891e8b` | owner panel + 2 console reads | `check-course-access-api` 96/96; `check-business-os-a11y` PASS with a new 24-assertion G6 block; render + surface PASS |
| `2b76c3e` | P1-009 slice 3 | repo-wide lint 78 → 55, errors 39 → 16; 53/53 sweep |

`contentCohorts:accessLevels` now has engine, enforcement, an HTTP surface and an owner panel. That
was the last of the three gaps NEXT_ACTION listed as honestly missing; the other two are the
owner-gated appointment providers.

The check sweep is now **53**, not 52. `check-course-access-api.ts` is picked up by the
`check-*.ts` glob, so the driver count moved on its own.

### Two things this package changed about the plan

**One HTTP boundary, not two.** The queue entry above said "two route trees". That was wrong, and
the retainer lesson quoted at the top of this file is why: the owner path was added to the EXISTING
`CohortApiService`, and the learner path was left exactly where it already was, at the library page
with its `pl_member` cookie. Two route trees would have meant two envelopes and two status maps to
keep in step. The harness asserts the boundary never imports or constructs `LearnerAccessService`,
which is the property "two trees" was trying to buy, bought more cheaply.

**Two read-only endpoints were unavoidable.** `/course-access/courses` exists because there was no
tenant-scoped course list anywhere under `/api/platform`, so a course picker had nothing to read.
`/course-access/console` exists because `listLessonRules` returns ONLY lessons that already carry a
rule — correct for reporting, and useless for an editor, since an owner could never add the first
rule. Widening the reporting endpoint would have blurred what it means, so the console read returns
the null-rule lessons too and the harness measures exactly that.

### Correction to an earlier entry in this file

The section above lists "Wire visibility into the reader" as the most honest remaining gap. That is
**stale**. `src/app/library/courses/[id]/page.tsx` calls `LearnerAccessService.visibleLessons`;
P2-016 closed it. Left in place rather than edited, because rewriting old orchestration history is
on the do-not-do list — this note is the correction.

### Orchestration: dispatch tools are exposed and still do not work

The KiroCrew MCP servers are now registered client-side and `spawn_run`, `spawn_list`,
`spawn_status`, `spawn_continue`, `resource_status`, `cron_add` and `cron_list` all respond. The
previous run recorded `ORCHESTRATION_UNAVAILABLE` because no dispatch tool was exposed at all. That
is no longer the reason, and the reason has moved:

A read-only control worker was dispatched (requested `gpt-5.6-terra`, `keep: true`, cwd = repo root)
whose whole job was three `git rev-parse` calls. It never executed a turn.

- `spawn_run` returned `parent_session UNRESOLVED`, so completion events cannot arrive.
- The OS process was real — `kiro-cli.exe acp --agent kirocrew`, child of the gateway — and froze at
  **1.6 s CPU over six minutes**, while `spawn_list` kept reporting `[running]`. False liveness.
- `spawn_status` returned no transcript and no result directory was ever created.
- `spawn_release` refused with `conversation_busy`; `spawn_steer` returned
  `session_starting: the run is alive but its session has not registered within 15.0s`.
- The launch command line carries **no `--model` argument**, so even a working worker could not have
  its observed model proved — which is fatal for a model-pinned run specifically.

Root cause: the worker process starts but its ACP session never registers with the gateway, so no
turn can run, no model can bind, and the run can never be released. Repair was stopped at 6.5 of the
15-minute budget. **No parallelism was claimed and none was used.** The hollow process was
terminated; the gateway on 5476 was left alone and verified still listening afterwards.

Do not spend another run on worker dispatch without owner involvement: the failure is in identity
plumbing (`KIROCREW_HOST_PID` / `session_pid` / claim-push) and in the missing `--model` argument,
neither of which is reachable from inside a session.

### Next in queue

| Pkg | Scope | Notes |
|---|---|---|
| G5 | `fieldJobs:inspection` | The last genuinely large package. Read the empty-registry warning in NEXT_ACTION **first**: it is the last `planned` capability anywhere, so promoting it means REWRITING the capability-contract planned negative test against a synthetic descriptor, not repointing it a fifth time. Needs a migration, so budget a full rehearsal cycle — it was deliberately NOT started in this run because a half-finished one would leave the disposable database mid-rehearsal, which the preservation invariants forbid. |
| P1-009 slice 4 | repo-wide lint | 55 problems (16 errors, 39 warnings). `no-explicit-any` is down to **1**: `src/app/[slug]/page.tsx:70`, `profile={profile as any}`. It is a judgement call, not an oversight — `ProfileViewProps.profile` is a hand-written structural type and the page's query is a deep nested include, so making them agree is design work. `no-img-element` (25) is now the largest rule and every one of them changes layout behaviour. |
| G2 | appointments providers | Still **owner-gated**. |


---

## Wave H0 + H1 integrated - fieldJobs:inspection is complete, and the registry has no planned capability left

Resumed after the previous night-run died mid-flight. Base `435a5e9`, head `7b15cd3`.

**The resume began by measuring, and three things the brief said turned out to be wrong.** They are
worth reading before trusting any inherited state description:

1. **The disposable database was NOT mid-rehearsal.** The brief implied inspection was in-progress
   root work; in fact the schema and its migration had already landed in `8b33a6a` and the rehearsal
   database was left **fully applied** - 18 migrations, all finished, none rolled back, 113 tables.
   No rehearsal was redone, and none needed to be.
2. **`wave-c\run-on-rehearsal.js` is hardwired to the STALE wave-c worktree** (`8d966af`, 17
   migrations). Running `prisma migrate status` through it reports "17 migrations found" against a
   database that has 18, which looks exactly like a missing migration and is not. This is the
   documented sweep-driver trap, applied to the DB runner rather than the gate driver. Use
   `wave-a-briefs\run-on-rehearsal-primary.js` for anything primary.
3. **The first H0 rehearsal cycle proved nothing.** Snapshot `h0-rollback` is byte-identical to
   `h0-post`, so that "rollback" was a no-op. The SECOND cycle is the real evidence: `h0-rollback2`
   equals `h0-pre` exactly, and `h0-reapply2` equals `h0-post` apart from 39 OID-derived internal
   NOT NULL constraint names on the recreated inspection tables - zero non-OID differences, 1194
   constraints on both sides. A migration's invertibility evidence is only as good as the snapshot
   that was taken AFTER the rollback actually ran.

| Commit | Slice | Gate result |
|---|---|---|
| `0151575` | inspection runtime, 13 routes, two harnesses | runtime 96/96, routes 54/54, both invertible |
| `7648473` | merge W4 owner panel (`7af39f8`) | a11y PASS, tsc 0, targeted lint 0 |
| `be176d4` | mount the panel in the shell | a11y + render + surface all exit 0 |
| `adebddd` | merge W5 lint slice 5 (`ea28089`) | repo-wide lint 45 -> 43, errors 16 -> 14 |
| `7b15cd3` | promotion + `field-service-v1` blueprint | capability contract PASS, sweep 57/57 |

Final combined suite: **57 of 57 check harnesses exit 0**, `tsc --noEmit` 0, repo-wide ESLint 43
problems (down from 45), `npm audit --omit=dev` 0 vulnerabilities, production build exit 0 with all
9 inspection route files registered as dynamic server routes, live `personalink` re-verified
untouched (35 tables, no `_prisma_migrations`, 0 wave tables leaked, no `btree_gist`, `Profile` = 16).

### The empty-registry trap never fired, because W1 had already defused it

`fieldJobs:inspection` was the last `planned` capability, and promoting it leaves the
capability-contract planned negative test with nothing real to point at. That was flagged for four
waves. It cost nothing here: W1's synthetic engine descriptor (`9238270`, merged `d4322b2`) had
already rewritten the test against a capability that is planned **by construction**. Nothing needed
repointing. The registry now has zero `planned` capabilities and two `partial` ones, both
owner-gated.

### field-service-v1 exists because a working engine had no vertical

No blueprint composed the `fieldJobs` engine at all. Intake and dispatch had been available since
Wave G4 and nothing offered them. `field-service-v1` requires
`fieldJobs:intake+dispatch+inspection` and composes `commerce:inventory` as **not required**,
because a business that only wants a record of what was fitted does not need stock tracking.

It also caught the `fieldJobs` engine **description** overclaiming: it read "Intake, quotes,
technicians, routing, assets, inspections, parts, and invoices", naming two things the engine has
never had and its own capabilities never claimed - no routing, and no invoices. Fixed.

### A check that was measuring a gap instead of a behaviour

Installing the blueprint turned `check-business-os-render` red on `marks unused engines honestly`.
The assertion was `populated.includes("unused")` against the real registry, so it only passed while
SOME engine had no blueprint. Closing the gap made the badge correctly stop saying "unused" and the
check failed **on an improvement**.

Rewritten to prove the badge rather than the gap: the real engine list is rendered against a
blueprint list with every fieldJobs-composing blueprint removed - the pre-H1 situation reproduced
deliberately - and the badge must then appear, with a companion assertion that no real engine is
uncomposed and a third that a blueprint really was dropped. This is the same failure mode as the
"ETA" string ban in Wave G4 and the `.every(async ...)` vacuity in G6: **an assertion that encodes
today's shortcomings will fail the day they are fixed.**

### Three gaps found while implementing, written down here rather than left to be discovered

| Gap | Where | Why it matters |
|---|---|---|
| **The panel and the server disagree about when editing is possible** | `inspection-panel.tsx` vs `src/lib/fieldjobs/inspection.ts` | The server allows recording only in `DRAFT` and `IN_PROGRESS` (`RECORDABLE_STATUSES`); the panel disables its forms only once the inspection is **terminal**. On a `SUBMITTED` inspection the panel therefore offers enabled controls that the server refuses with 409. Nothing breaks, because the refusal message is rendered verbatim, but a disabled control is better than a refused one. The panel should gate on `allowedTransitions` containing `IN_PROGRESS`, or the server should expose a `canRecord` flag. |
| **A lint-style string ban that will fail on honest copy** | `check-business-os-a11y.ts`, W4's block | One assertion bans the WORD `invoiced` from the panel and its shared module. By this file's own recorded lesson, a ban on a string is not a ban on a behaviour and it cuts both ways - copy that honestly explains nothing is invoiced would trip the check that exists to protect that property. It passes today. Harden it to ban the CONSTRUCTION (an invoice total, a payment call) rather than the word. |
| **The wave-c rehearsal runner points at a stale worktree** | `<temp>\personalink-phase0\wave-c\run-on-rehearsal.js` | Hardwired `APP_DIR` to `personai-wave-c-cases-wt`, which is 12 commits behind. Any DB harness run through it executes the WRONG checkout against the current schema. It should be repointed at primary or deleted in favour of `run-on-rehearsal-primary.js`. This burned real time in this run. |

### Worker evidence, stated honestly rather than levelled up

Five worker packages were integrated across H0 and H1. Their evidence is **not** of equal quality
and the difference is recorded rather than smoothed:

- **W5** (`gpt-5.6-terra`, lint slice 5) is the strongest: a real shell PID (7668), a named model,
  and it **corrected the brief's baseline** - the brief said 44 problems / 16 errors / 28 warnings,
  W5 measured 45 / 16 / 29, and root's independent measurement at `435a5e9` was 45 / 16 / 29. W5 was
  right and the brief was wrong.
- **W4** (inspection panel) is weaker: its model was `claude-sonnet-5` **by brief instruction, not
  by observation**, it said so explicitly, and it had **no observable PID**. It was also candid that
  it could not exercise anything against a live route, because the routes did not exist yet.

Root observed none of these workers executing - they ran in the run that failed. What root verified
is artifacts, and W4 and W5 were each checked independently in their own worktrees before merging,
including the cross-check W4 could not do: every URL, method and payload field name against the
routes that now exist.

**This also corrects a standing claim in `TASKS.json` and `NEXT_ACTION.md`.** Those say worker
dispatch is hollow and "no parallelism was claimed or used". That remains true of the **MCP
`spawn_run` path**. It is not true of the shell-launched worker path, which produced five clean
single-commit branches in five worktrees. The cost of that path is the one already recorded: it
exposes no `--model` argument, so a worker's model cannot be proved.

### Next in queue

| Pkg | Scope | Notes |
|---|---|---|
| Panel/server recording mismatch | `inspection-panel.tsx` | Small and well understood. Gate the record forms on the server's answer rather than on `isTerminal`. The cheapest honest fix is a `canRecord` boolean on the inspection record, since the panel already renders every other action from server-computed state. |
| Harden the `invoiced` string ban | `check-business-os-a11y.ts` | Ban the construction, not the word. See the gap table above. |
| P1-009 slice 6 | repo-wide lint | 43 problems (14 errors, 29 warnings). What is left is the hard part: `no-img-element` 25 warnings where every conversion changes layout behaviour, `set-state-in-effect` 10 errors needing effect redesign, `preserve-manual-memoization` 3, `exhaustive-deps` 3, `no-explicit-any` 1 (the documented judgement call at `src/app/[slug]/page.tsx:70`), `no-unused-vars` 1. **There is no cheap slice left.** |
| Repoint or delete `wave-c\run-on-rehearsal.js` | tooling, outside the repo | Prevents a whole class of misattributed failure. |
| G2 | appointments providers | Still **owner-gated**: real messages and real money. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |


---

## H1 follow-ups: all three recorded gaps closed, plus the cross-vertical join proved

Base `b25b955`, head `f8ee611`. Every item the previous section listed as "next in queue" that was
not owner-gated or judgement-heavy is now done.

| Commit | What | Evidence |
|---|---|---|
| `a5906ab` | server-computed `canRecord` replaces the panel's `!isTerminal` guess | runtime 100/100, routes 55/55, a11y PASS |
| `eea2f7b` | the `invoiced` ban now targets the behaviour, not the word | proven able to fail by injecting a violation, then reverted |
| `f8ee611` | the inspection/inventory join proved from the INVENTORY side | routes 59/59 |
| (tooling, outside the repo) | drift guard on `wave-c\run-on-rehearsal.js` | fires correctly: "17 on disk, 18 applied" |

### The canRecord fix, and why it was not cosmetic

The panel gated five record forms on `!inspection.isTerminal`. `SUBMITTED` is not terminal but is not
recordable either, so the panel offered enabled controls the server refused with 409. `canRecord` is
now computed server-side from `RECORDABLE_STATUSES` and the panel renders from it; `isTerminal` is no
longer referenced in the panel at all, and an a11y assertion enforces that.

The load-bearing assertion is that **a SUBMITTED inspection reports `canRecord: false` while
`isTerminal: false`** - the two flags must DISAGREE somewhere, or the new field would be redundant.
A second assertion attempts a real `recordItem` on that inspection and requires the 409, so the flag
is checked against behaviour rather than against the table it was derived from.

### The string ban, third time this lesson has been paid for

`!/\binvoiced\b/i` was a ban on a word. It now bans three constructions - a claim that this record was
invoiced, a call to an invoicing/payment/charge endpoint, and the patterns are **self-tested in both
directions**: they must match "this inspection was invoiced on Tuesday", and must NOT match "Nothing
here creates an invoice and no money moves." Then the whole thing was proven able to fail by appending
a violating line to the panel (exit 1, naming the assertion) and reverting it.

### The cross-vertical join

Every earlier inspection assertion was measured from inside fieldJobs, which cannot distinguish
"composed the inventory engine" from "wrote its own private row while inventory carried on unaware".
The route harness now asks the **inventory vertical's own HTTP surface**: the `-3` `ADJUSTMENT` appears
in that stock record's movements, the movement's reason names the inspection, inventory reports the
same `onHand` the fieldJobs side computed, and the part recorded WITHOUT `consumeStock` produced no
movement at all - exactly one `ADJUSTMENT` across the whole record, not two.

That last one is what makes the `consumeStock: false` default meaningful from the other side: a
"recorded only" part is invisible to inventory, which is precisely what "stock did not move" has to
mean.

### Next in queue - and an honest note on what is left

| Pkg | Scope | Notes |
|---|---|---|
| P1-009 slice 6 | repo-wide lint | 43 problems (14 errors, 29 warnings). **There is no safe mechanical slice left.** `no-img-element` 25 warnings each change layout, loading and remote-image configuration; `set-state-in-effect` 10 errors each need the effect redesigned per component; `preserve-manual-memoization` 3 need memoized-collection identity analysis; `exhaustive-deps` 3 need per-effect behaviour analysis; `no-explicit-any` 1 is the documented judgement call at `src/app/[slug]/page.tsx:70`; `no-unused-vars` 1 is a live DOM query in a puppeteer script. Clearing any of these to move a number would violate this file's own standing rules. |
| Template-authoring UI | `inspection-panel.tsx` or a sibling | The 5 template endpoints (`/inspection-templates/**`) have NO owner surface. Checklists can currently only be created through the API. This is the honest remaining gap in the H1 package and it is a real one - an owner cannot author a checklist from the product. |
| Onboarding surface for `field-service-v1` | onboarding flow | The blueprint is active and selectable by the registry, but nothing walks an owner through choosing it. Note the critical `createProfile` identity defect HANDOFF.md records is **already fixed** - it derives the actor from `requireAuthenticatedUser()` and no longer accepts a caller-supplied `userId`. |
| G2 | appointments providers | Still **owner-gated**: real messages and real money. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |

**HANDOFF.md is stale and should not be used for planning.** All four defects in its critical/high
table are closed: `content.ts` and `image-to-3d` use `requireOwnedProfile`, `onboarding.ts` derives its
actor from the session, and the chat route binds a conversation to a signed per-profile capability
cookie covered by `check-conversation-authz`. Its "next steps" list still describes P2-003 as blocked,
which it has not been for several waves.


---

## Integrated at `086c835` — the two named H1 gaps

Both items came straight off the previous "Next in queue" table and are now **done**:

| Was queued as | Commit | What landed |
|---|---|---|
| Template-authoring UI | `5822aa8` | `inspection-templates-panel.tsx`, mounted in the shell. Create a checklist, add lines with kind / guidance / required / unit / expected range, rename, deactivate and reactivate. 16 new a11y assertions. The server stays the authority: the panel does not re-implement the measurement-unit or range rules, and an assertion fails if it ever starts. |
| Onboarding surface for `field-service-v1` | `086c835` | `FIELD_SERVICE` role template with need entry, icon and addons, plus `CORRESPONDING_BLUEPRINT` and a 20-assertion harness that enforces every ACTIVE blueprint being reachable from onboarding in both directions. |

Sweep is now **58**. Repo-wide lint unchanged at 43 (14 errors, 29 warnings) — both packages add none.

### Next in queue — revised after `086c835`

| Pkg | Scope | Notes |
|---|---|---|
| **Blueprint installation runtime** | `src/lib/business-os/**` + new routes | The largest genuinely-missing package, and the prerequisite for everything vertical-facing. **Measured, not assumed:** `business-os` is a static registry (`blueprints.ts` 418, `engines.ts` 261, `types.ts` 90, `validation.ts` 86, `workflow.ts` 42) with **zero API routes**. Installation does not exist even in part. It needs durable state — an installed-blueprint record with workspace/profile association, version, terminology, surfaces, modules, workflow templates and an audit trail — so it needs a MIGRATION and the full disposable-DB rehearsal cycle. Allow 90+ minutes minimum and read rule 23 first: hash the post-rollback snapshot against BOTH pre and post. Until it exists, `CORRESPONDING_BLUEPRINT` in `src/lib/onboarding-needs.ts` is a correspondence only, and its harness asserts no route installs anything — **that assertion is what should make whoever builds this revisit the wording there.** |
| **Unified daily operations runtime** | new `src/lib/operations/**` | A tenant-scoped read-only view over records that already exist: reservations needing action, upcoming appointments and waitlist openings, case milestones and approvals, cohort tasks and renewals, fulfilments and returns, inventory exceptions, field-job and inspection exceptions, overdue durable tasks. **Needs no schema** — it aggregates eight domains that are all already persisted, which makes it the largest available package that cannot be blocked by a migration window. Use inert adapters only; do not claim a scheduler exists without real execution evidence. |
| P1-009 slice 6 | repo-wide lint | Unchanged: 43 problems and **no safe mechanical slice remains**. This is a refusal. `no-img-element` 25 each change layout, loading and remote-image configuration; `set-state-in-effect` 10 each need the effect redesigned; `preserve-manual-memoization` 3 need memoized-collection identity analysis; `exhaustive-deps` 3 need per-effect analysis; `no-explicit-any` 1 is the documented call at `src/app/[slug]/page.tsx:70`; `no-unused-vars` 1 is a live DOM query in a puppeteer script. |
| Repoint or delete the wave-c rehearsal runner | tooling, outside the repo | `<temp>\personalink-phase0\wave-c\run-on-rehearsal.js` hardcodes `APP_DIR` to a worktree 12+ commits behind and reports "17 migrations found" where there are 18 — indistinguishable from a missing migration. It gained a drift guard, but the honest fix is to repoint or delete it. It has now misled two separate resumes. |
| G2 | appointments providers | Still **owner-gated**: real messages and real money. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |


---

## Integrated at `ff50658` — the unified daily operations view

Taken off the previous queue table and now **done, end to end**:

| Commit | What landed |
|---|---|
| `dac6a23` | `src/lib/operations/**` + `/api/platform/operations/today` + 23-assertion runtime harness |
| `0387d86` | `operations-panel.tsx`, mounted first in the shell, 14 new a11y assertions |
| `d06e122` | case milestones covered; tenant boundary reported per domain (`scope`, `mixedScope`) |
| `ff50658` | `check-operations-routes.ts`, 26 assertions at the HTTP boundary |

Sweep **58 → 60**. Repo lint unchanged at 43 (14 errors, 29 warnings) across all four.

Covers reservations, appointments, field jobs, inspections, stock, shipments, returns and case
milestones. Does **not** cover cohort tasks or the durable TaskJob queue, and says so in the response
and in the UI, with the reason for each.

### Next in queue — revised after `ff50658`

| Pkg | Scope | Notes |
|---|---|---|
| **Blueprint installation runtime** | `src/lib/business-os/**` + new routes | Now the largest genuinely-missing package by a wide margin, and the prerequisite for everything vertical-facing. **Measured:** `business-os` is a static registry (`blueprints.ts` 418, `engines.ts` 261, `types.ts` 90, `validation.ts` 86, `workflow.ts` 42) with **zero API routes** — installation does not exist even in part. Needs durable state (installed-blueprint record with workspace/profile association, version, terminology pack, surface and navigation config, dashboard modules, workflow templates, installation history and audit), therefore a MIGRATION and the full rehearsal cycle. **Allow a fresh window of 3+ hours, not 90 minutes** — the comparable inspection package took most of a night with three workers. Read rule 23 before the rollback step. `check-onboarding-blueprint-coverage` asserts that no route installs a blueprint today; that assertion is deliberately what will force whoever builds this to revisit the wording of `CORRESPONDING_BLUEPRINT` in `src/lib/onboarding-needs.ts`. |
| Extend operations coverage to cohort tasks | `src/lib/operations/engine.ts` | The remaining honest gap in the view, and NOT a mechanical addition. Cohort task and renewal state is spread across several models whose "needs action" condition is not a single field, so covering it means either the cohort engine declaring that condition first, or this view encoding a judgement the owning engine has not made. Do the former. The declared-coverage harness will force the domain to be added in both directions at once. |
| Operations due-work processing | new, owner-gated in spirit | The directive that produced the view also asked for idempotent internal due-work processing. That is **not** built and the view claims no scheduler — asserted absent, including `setInterval`/`setTimeout`. Anything that runs on a timer needs real execution evidence before it may be described as existing. |
| P1-009 slice 6 | repo-wide lint | Unchanged: 43 problems, **no safe mechanical slice remains**. This is a refusal. One data point from this run: a genuine `set-state-in-effect` fix took three attempts and produced better code — which is exactly why the remaining 10 cannot be swept. |
| Repoint or delete the wave-c rehearsal runner | tooling, outside the repo | Has now misled two separate resumes. |
| G2 | appointments providers | Still **owner-gated**: real messages and real money. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |


---

## Accepted — read-only blueprint preview, `c3f3f44`

Phase 1 of the blueprint installation runtime. Preview resolves; it does not install.

| Commit | What landed | Author |
|---|---|---|
| `f1af3a4` | `preview-types.ts` — the contract, as **types** rather than a document | root |
| `5e29a4c` | onboarding invariant becomes behavioural, plus a schema-model trigger | BP2 `gpt-5.6-terra`, PID 47284 |
| `fbefa17` | resolver, HTTP boundary, `GET /api/platform/blueprints` and `.../[blueprintId]/preview` | root |
| `0798020` | `blueprint-preview-panel.tsx` with distinct 401/403/404/400/503/empty/loading states | BP1 `claude-sonnet-5` |
| `3ea6106` | panel mounted in `business-os-shell.tsx` | root |
| `c3f3f44` | closed two holes the harnesses themselves left open | root |

Sweep **60 → 61**. Repo lint unchanged at 43 (14 errors, 29 warnings) across all six commits.

### Corrections to what this queue previously asserted

The entry below claimed `business-os` has **zero API routes**. That was false when written:
`src/app/api/business-os/blueprints/route.ts` and `.../[blueprintId]/route.ts` have existed since
`627b826`, both GET-only, both behind `requireBusinessOsAccess`. The substantive claim — that
*installation* does not exist even in part — was and remains true, and is now enforced rather than
asserted in prose.

There are deliberately **two** blueprint listing surfaces. `business-os` requires the `businessOs`
owner-console surface (opt-in per profile); `platform` requires only workspace membership, because
onboarding happens before anyone opts into the owner console. Merging them would either lock preview out
of onboarding or silently widen what `businessOs` implies. A harness now pins that.

### What is still genuinely missing, and what now enforces it

No installed-blueprint model, no write route, no install runtime, no history ledger.
`check-onboarding-blueprint-coverage` no longer tests route *names* — it fires when a route both concerns
blueprints and exports `POST`/`PUT`/`PATCH`/`DELETE`, **or** when `prisma/schema.prisma` gains a model
matching `/Install|Blueprint/`. So the first durable installation model added will turn it red, which is
exactly the intended prompt to revisit the wording of `CORRESPONDING_BLUEPRINT`. Do not weaken it to get
past that point; update the wording, because at that moment installation will genuinely exist.

### Next in queue — revised after `c3f3f44`

| Pkg | Scope | Notes |
|---|---|---|
| **Blueprint installation — durable state** | `prisma/schema.prisma` + `src/lib/business-os/**` + write route + owner UI | Preview is done, so this is now unblocked and is the next package. Needs an additive migration and therefore the **full** rehearsal cycle: fresh external backup → pre snapshot → additive build → apply → post snapshot → rollback via a **space-free** `down.sql` path → compare rollback against **both** pre and post → reapply → normalized compare. Every command through `assertDisposableTarget`; exclude and count-assert the five known `profileId` `DropForeignKey` drift statements (`ActivityEvent`, `Contact`, `ContactSourceLink`, `WorkflowRun`, `Workspace`); never leave the database between rollback and reapply. Reuse existing surfaces, workflow, task, approval and audit mechanisms — do **not** add vertical-specific tables or a parallel engine. Required behaviour: idempotent install, atomic install proven by an **injected last-step failure leaving zero partial rows**, upgrade by supersession rather than duplicate reinstall, refusal when a required capability is unavailable, append-only history with `UPDATE`/`DELETE` refused, and no silent permission expansion — `businessOs` must not become grantable by installing. |
| Extend operations coverage to cohort tasks | `src/lib/operations/engine.ts` | Unchanged: have the cohort engine declare its own needs-action condition first. |
| Operations due-work processing | new | Unchanged: not built, and nothing on a timer may be described as existing without execution evidence. |
| P1-009 slice 6 | repo-wide lint | Unchanged, and still a refusal: 43 problems, no safe mechanical slice remains. |
| Repoint or delete the wave-c rehearsal runner | tooling | Unchanged. Has misled two resumes. Note the primary runner is the one that works: `run-on-rehearsal-primary.js`. |
| G2 | appointments providers | Still **owner-gated**: real messages, real money. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |


---

## Accepted — durable blueprint installation, `9548440`

Phase 2. The blueprint installation runtime is complete: schema, migration, runtime, routes and owner UI.

| Commit | What landed | Author |
|---|---|---|
| `2d83e46` | `install-types.ts` — the contract, as **types** rather than a document | root |
| `94f946c` | additive migration + `check-blueprint-install-schema.ts`, full rehearsal cycle | root |
| `d1eeae9` | `check-capability-contract.ts` optional-direction gap closed | BP4 `gpt-5.6-terra` |
| `f71a3af` | `blueprint-install-panel.tsx` + shared module + 156 a11y assertions | BP3 `claude-sonnet-5` |
| `cdd0127` | runtime, HTTP boundary, both routes, panel mount, onboarding invariant reshaped | root |
| `9548440` | harness residue fix — back to zero | root |

Sweep **61 → 64**. Repo lint unchanged at 43 (14 errors, 29 warnings) across all six commits.

### Visible product behaviour

An owner in the Business OS console now sees, under the read-only preview panel, what their workspace has
installed, its frozen configuration, whether that configuration has drifted from what the registry would
resolve today, and the full append-only history including superseded and removed installations. They can
plan an install (which writes nothing), install, upgrade — which supersedes rather than duplicating — and
remove, which retains the row and its history rather than deleting.

### What it deliberately does not do

Installing grants nothing. It does not write `Profile.personalityConfig`, does not switch on the owner
console, does not copy workflow declarations into the database, and does not notify, charge or schedule
anything. `coaching-studio-v1` cannot be installed at all, because it requires `appointments:reminders`
and that capability is genuinely `partial` — which is also what makes the install-time refusal a real
test rather than a vacuous one.

### Next in queue — revised after `9548440`

| Pkg | Scope | Notes |
|---|---|---|
| **Workspace-scoped surfaces** | `src/lib/surfaces.ts` + a scope mechanism | The honest gap installation exposed rather than closed. `configJson` RECORDS the surfaces a blueprint implies and nothing applies them, because surfaces are per PROFILE while an installation is per WORKSPACE and a user reaches many workspaces through `Membership`. Applying them today would change what that user sees in workspaces the install said nothing about. Making install actually *effectful* needs a workspace-scoped surface resolution first — and that is a change to how the whole product reads surfaces, not an installation feature. Do not bolt it onto the install row. |
| **`check-schema-invariants.ts` fragility** | `scripts/one-off/check-schema-invariants.ts` | Found by breaking it accidentally. Its backfill projection inserts a `Workspace` for every `Profile` using `on conflict ("id") do nothing`, which cannot absorb a collision on the UNIQUE `profileId`. It passes today only because no `Profile` in the disposable database owns a `Workspace`. The first one that does breaks it. Small fix, real trap. |
| Extend operations coverage to cohort tasks | `src/lib/operations/engine.ts` | Unchanged: have the cohort engine declare its own needs-action condition first. |
| Operations due-work processing | new | Unchanged: not built, and nothing on a timer may be described as existing without execution evidence. |
| Continue the harness vacuity audit | `scripts/one-off/check-*.ts` | BP4 audited **one** of ten assigned files and proved a real finding in it. Nine remain: `check-fieldjob-inspection-runtime`, `check-fieldjob-runtime`, `check-operations-runtime`, `check-commerce-runtime`, `check-inventory-runtime`, `check-cohort-runtime`, `check-course-access-runtime`, `check-retainer-runtime`, `check-reservation-authz`. The method is in `scripts/one-off/HARNESS_VACUITY_AUDIT.md`. Note the constraint BP4 hit: the rehearsal runner targets the PRIMARY worktree, so a worker in a linked worktree cannot use it for source-break evidence — give the next one a runner that respects its own cwd, or run it as root. |
| P1-009 slice 6 | repo-wide lint | Unchanged, and still a refusal: 43 problems, no safe mechanical slice remains. |
| G2 | appointments providers | Still **owner-gated**: real messages, real money. Also the reason `coaching-studio-v1` is uninstallable. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |


---

## Accepted — workspace-scoped surfaces, cohort operations coverage, and the harness audit

Eleven workers, five waves, three concurrent throughout. Sweep **64 → 68**. **No migration was added,
because none was needed.**

| Commit | What landed | Author |
|---|---|---|
| `11950b8` | the canonical precedence decision, written from measurement before implementation | root |
| `0b71ace` | `check-schema-invariants` backfill collision fixed and the reuse case seeded | S1-B `gpt-5.6-terra` |
| `739fbdb` | Group A audit result recorded (1 proven real, 2 files not reached) | S1-C `gpt-5.6-terra` |
| `ead6741` | Group B audit + root's cross-pass note on the proof mechanism | S2-C `gpt-5.6-terra` |
| `66ddbe8` | contract, candidate resolver, 8-property security evaluation | S1-A `gpt-5.6-sol` |
| `34f5055` | a frozen surface config must outlive the code that wrote it | root |
| `043e7e0` | the GET boundary, route and 18-assertion adversarial harness | S2-B `gpt-5.6-sol` |
| `1b8eb50` | the role-openness claim made measured rather than accidental | root |
| `228c95e` | Group C audit; the over-claiming class named | S3-A `gpt-5.6-terra` |
| `76f8e92` `817ed37` | the owner panel, and root mounting it | S2-A `claude-sonnet-5` / root |
| `f4a86a7` `fc99824` | cohort needs-action declaration; inversion widened 1 → 29 | S3-B `gpt-5.6-sol` / root |
| `0fff301` | Operations covers `cohortTasks` by CONSUMING the declaration | root |
| `f2f7a30` `c1b45c0` | acted on the independent review: two fixed, one recorded open | root (from S3-C `gpt-5.6-sol`) |
| `27b8b21` | deterministic read interleaving; retainer lock necessity PROVEN | S4-B `gpt-5.6-terra` |
| `504799c` `0a0984b` | inversion widened across nine harnesses | S4-A / S5-B `gpt-5.6-terra` |
| `9862439` | the manual due-work planning contract | S5-A `gpt-5.6-sol` |

Repo lint unchanged at 43 (14 errors, 29 warnings) at every commit.

### Visible product behaviour

An owner in the Business OS console now sees, per workspace, which product surfaces the installed blueprint
resolves to, which blueprint they came from, and — when nothing is installed, which is currently every
workspace — a calm statement of that rather than an error. Configuration that names a surface this build no
longer recognises is reported as dropped; configuration that names a surface no blueprint may ever grant is
reported separately as worth investigating. The Operations Command Centre now counts cohort work as its
ninth domain: submitted assignments awaiting review, absences on held sessions, scheduled/reminded/lapsed
renewals, and certificates eligible but not issued.

### Next in queue

| Pkg | Scope | Notes |
|---|---|---|
| **Explicit workspace selection** | `business-os-shell.tsx` | The one MAJOR review finding. The shell prefers the workspace matching the active profile and otherwise falls back to `workspaces[0]`, which tenancy orders alphabetically — so a user in A and B whose profile matches neither is shown A's configuration without choosing it. Not a leak; they are a member of A. **Not local:** twelve panels take `workspaceId` and blanking the selection empties them all on first load, so every panel's empty state must be audited first. Full specification is in `WORKSPACE_SURFACES_DECISION.md` under "OPEN DEFECT". A worker was dispatched on this at the end of the run; check `s6a/explicit-workspace-selection` and `reports/S6A-report.md` before starting. |
| **Observe the panel stale-response race** | `check-business-os-a11y.ts` or a new harness | The panel's defence against a slow response for workspace A landing in B is a **source-level argument**, not an observed one. No harness mounts the panel or reorders real responses. The fix for the eviction bug is reasoned, and the assertion only proves the mechanism is present. Needs a component-level test that actually reorders two responses. |
| **Generalize deterministic interleaving** | `check-inventory-runtime.ts` and other lock claims | The technique now exists (see `RUNLOG.md` lesson 46 and `check-retainer-runtime.ts`). The open question it can now answer: whether two concurrent inventory reservations can interleave to oversell, which `Promise.all` cannot decide. A worker was dispatched on this; check `s6c/inventory-lock-necessity` and `reports/S6C-report.md`. |
| **Finish widening the inversion control** | remaining `check-*.ts` | Nine files done. `check-retainer-runtime` still flips 1 of 88; a worker was dispatched on it plus retainer routes/schema and cohort schema — check `s6b/widen-inversion-3`. Measure the real "before" count per file rather than assuming 1. |
| Wire the due-work plan to a surface | new route + UI | `planDueWork` exists, is pure, and is invoked by nobody. It must stay explicitly invoked: **no timer, no scheduler, no background execution** without measured execution evidence. |
| P1-009 slice 6 | repo-wide lint | Unchanged, still a refusal: 43 problems, no safe mechanical slice remains. |
| G2 | appointments providers | Still **owner-gated**: real messages, real money. |
| P1-007 | live `personalink` cutover | Still **owner-gated**. |


---

## Accepted — S6: explicit workspace selection, and the a11y harness gate

| Commit | What landed | Author |
|---|---|---|
| `c614001` | explicit workspace selection; a11y exit decision moved to the end of the file; the word-ban assertion replaced with a positive check | S6-A `claude-sonnet-5` + root |
| `4c9cf31` | inversion widened on retainer runtime/routes/schema and cohort schema | S6-B `gpt-5.6-terra` |

Sweep stays **68**, FAILED 0. Repo lint unchanged at 43.

**The MAJOR review finding is closed.** The shell auto-selects only when there is exactly one authorized
workspace; the `workspaces[0]` alphabetical fallback and the profile-match preference are both deleted; more
than one workspace yields a deliberate "Choose a workspace" state with a persisted, clearable choice.

**A harness gate defect was fixed and it invalidates earlier evidence.** `check-business-os-a11y.ts` decided
its exit code ~100 lines before the end of the file, so two appended sections were invisible and non-fatal.
Any "a11y PASS" recorded before `c614001` covered only the assertions above that point.

### Next in queue

| Pkg | Scope | Notes |
|---|---|---|
| **Inventory lock necessity — NOT DONE, worker produced nothing** | `check-inventory-runtime.ts` | S6-C was dispatched on this and returned **NO_OUTPUT**: no commit, no modified file, no report, worktree byte-identical to how it was prepared. The package is untouched and still worth doing. The technique exists and is proven — see `RUNLOG.md` lesson 46 and the deterministic assertion in `check-retainer-runtime.ts`. The open question: can two concurrent inventory reservations interleave to oversell? `reserved <= onHand` is guarded in the engine AND by a database CHECK, and an opportunistic `Promise.all` cannot decide it. Re-dispatch with the same brief (`night-run/brief-S6-wave.md`, section S6-C). |
| **Observe the panel stale-response race** | a component-level test | Unchanged and still open. The panel's defence against a slow response for workspace A landing in B is a source-level argument; no harness mounts the panel or reorders real responses. `renderToStaticMarkup` never runs effects, so the existing harness cannot reach it. |
| **Audit the OTHER mid-file exit decisions** | `scripts/one-off/check-*.ts` | New, and directly implied by the `c614001` finding. If one harness decided its exit code before the end of the file, others may too. Grep for `process.exitCode` and check how many lines of assertions follow it in each file. Cheap to check, and the failure mode is silent. |
| **`CommercePanel` double empty state** | `commerce-panel.tsx` | Cosmetic, reported by S6-A from outside its paths: the panel's two children each render their own "Select a workspace" card, so a user sees two stacked identical messages. Not a crash. |
| Wire the due-work plan to a surface | new route + UI | Unchanged. `planDueWork` is pure and invoked by nobody. It must stay explicitly invoked: no timer, no scheduler, no background execution without measured execution evidence. |
| P1-009 slice 6 | repo-wide lint | Unchanged, still a refusal. |
| G2 / P1-007 | providers / live cutover | Still **owner-gated**. |


---

## Accepted - N1: three open packages closed, one of them by finding nothing

Root: `claude-opus-5`, sole integration owner. Baseline for this wave: `14eccca`, sweep 68/68, lint 43.

| Commit | What landed | Author |
|---|---|---|
| `f7008f8` | the due-work preview contract, published as a **type file** rather than a design document | root |
| `be36ea7` | deterministic proof that the inventory reservation `FOR UPDATE` is load-bearing | N1-A `gpt-5.6-sol` |
| `ed5991c` | the workspace-surfaces stale-response race, proven by really mounting the component | N1-B `gpt-5.6-sol` |
| `edc4a20` | AST exit-integrity meta-harness; audit of all 69 harnesses found **0 real defects** | N1-C `gpt-5.6-terra`, applied by root |

Sweep is now **70** checks (68 + the two new harnesses, both passing under the sweep's own stricter
invocation), FAILED 0. Repo lint unchanged at **43 problems (14 errors, 29 warnings)**. tsc 0. build 0.
`npm audit --omit=dev` 0 vulnerabilities.

### The three previously-open packages, and what each turned out to be

**Inventory lock necessity - now measured, not assumed.** Every inventory balance path funnels through the
single `FOR UPDATE` in `InventoryContext.lockItem()` (`src/lib/inventory/shared.ts:183`). A Prisma
middleware barrier parks T1 after its balance read and engine guard but before the absolute `reserved`
write, then lets T2 run the same service method. Normal: 88/88, exit 0. With that sole `for update`
deleted: `item=5/3` instead of `2/6`, `held=2` instead of `6`, 85/88, exit 1, three named assertions red.
Restored: 88/88. Root reproduced this independently rather than accepting the report.

**The panel stale-response race - now observed, not argued.** Previously the defence was a source-level
argument, and `renderToStaticMarkup` cannot reach it because it never runs effects. N1-B mounts the real
component through `react-dom/client` into a small in-memory DOM host with `act()`, and adds **no
dependency** - the repo has no test renderer, jsdom or Testing Library, and none was installed. 31/31
assertions, all 31 flipping under inversion. Three separate source mutations each go red on a distinct
subset, which is what shows the three defences are not duplicates of one another: the `superseded` write
guard stops the *right* data being erased, and the two key gates stop the *wrong* data being shown.

**The mid-file exit audit - the answer is that there is nothing to fix.** This package was queued on the
suspicion that if one harness froze its verdict early, others would too. Across the 69 pre-existing
harnesses: 190 exit/summary candidates, 77 intentional disposable-target or precondition guards, 2 safe
summaries that are recomputed before the real verdict, **0 real defects**. The value delivered is therefore
not a fix but a permanent control: `check-harness-exit-integrity.ts`, which the sweep auto-discovers, so
the defect cannot come back silently.

Root did not accept the worker's five-line synthetic fixture as the whole falsifiability proof. The proof
was re-run against the real file the defect actually occurred in: moving the verdict block of the
1866-line `check-business-os-a11y.ts` ahead of its final assertion turned the audit red, exit 1, naming the
frozen `process.exitCode` **and** both frozen report summaries. Restored, it returns to 0. A control proven
only against a toy resembling the bug is not proven.

### Next in queue - this table supersedes every earlier one

| Pkg | Scope | State |
|---|---|---|
| Due-work preview API | `operations/due-work-*`, new route, new harness | **N2-A in flight.** Contract already published as types (`f7008f8`), so wording and shape are compiler-enforced, not review-enforced. GET only, by construction. |
| `CommercePanel` double empty state | the three commerce components + additive a11y assertions | **N2-B in flight.** Upgraded from cosmetic: the shell no longer auto-selects when a user has several workspaces, so the no-workspace state is now genuinely reachable rather than a momentary flash. |
| Assertion vacuity audit | new `check-assertion-vacuity.ts` | **N2-C in flight.** The layer below exit integrity: an exit code that fires correctly still proves nothing if the assertion cannot fail. Static classification of all 70 harnesses. |
| Inventory barrier review | new `check-inventory-barrier-review.ts` | **Briefed, N3-C.** Adversarial review of `be36ea7`: does T2 block on the row lock, or merely on the connection pool? Is the reserve path even in one transaction? `FOR UPDATE` outside a transaction has no lifetime. Also whether the absolute `reserved` write means the lock is sufficient but not strictly necessary. |
| Owner Due Work panel | UI on top of N2-A | **Briefed pending N2-A**, N3-A. |
| Due-work security and honesty audit | independent review of N2-A | **Briefed pending N2-A**, N3-B. |
| P1-009 slice 6 | repo-wide lint | Still a refusal. Cosmetic work to reduce a count is not worth a worker slot. |
| G2 / P1-007 | providers / live cutover | Still **owner-gated**. Unchanged. |

### Preservation, re-verified this wave

Live `personalink` untouched: 35 tables, `_prisma_migrations` absent, 0 wave tables leaked, `Profile` = 16
rows. 24 guard and append-only triggers, 0 disabled. `origin/recovered/aug20-wt-pr-32` still
`4b386d1d0c5c3ff0b5bf6b6957fce1f032087827`. All six frozen `kirocrew/*` worktrees still at `ea69595`. The
two preserved untracked paths still present and still untracked.


---

## Accepted - N2 to N4: the run turned on its own evidence

Root: `claude-opus-5`, sole integration owner. This is the wave where the interesting
finding was not a feature but the discovery that several of this repository's proofs - including three
root had already accepted and committed - asserted less than they read.

| Commit | What landed | Author |
|---|---|---|
| `b237cc1` | a11y pinned an effect's dependency array by exact text; narrowed to the property, not the text | root |
| `424c85c` | the manually invoked due-work preview API, GET only by construction | root |
| `6d38f8a` | one no-workspace message for commerce, COUNTED; DOM host extracted to `scripts/lib/` | root |
| `558d877` | the inventory lock proof measured an absence, and one conjunct measured nothing | root |
| `fd3d8fc` | the due-work harness proved less than it claimed, in three places | root |
| `792e0ee` | the owner-facing Due Work panel, wired into the shell | N3-A subagent + root |
| `7397919` | five audit findings closed on the due-work surface | N4B subagent + root |
| `1ca0505` | AST scanner for assertions that cannot fail, and the eight it found | N4A subagent + root |

### The through-line: four proofs that could not fail

Found in this order, each one making the next one findable.

1. **A vacuous conjunct in an accepted commit.** `be36ea7`'s inventory lock proof ended in
   `... && !t2SettledBeforeRelease`, where that variable was assigned only inside
   `if (secondPrewriteBeforeRelease)` - false on every passing run. It held its initialiser and asserted
   nothing, on every green run it ever had. Root had integrated that commit after independently
   reproducing its numbers, and the numbers were right; the proof was weaker than it read.
2. **The same proof rested on an absence of signal.** Its evidence was "T2 did not get to its prewrite
   point in 300ms", with T1 allowed 1500ms for the same work, and nothing anywhere pinned
   `connection_limit` - so the effective pool was Prisma's machine-dependent default and the same
   harness could prove different things on different hardware. Both harnesses now ask Postgres what T2
   is waiting ON, through a separate observer connection: `lockWaiters=1`, `ungranted=1 (transactionid)`,
   `backends=3`. Removing the lock gives `lockWaiters=0` and `after-values=3,3` - the lost update itself.
3. **The due-work no-write claim was guaranteed to pass by its own harness.** Counts were taken before a
   `$transaction` that ended in a rollback, so a write would have been erased before the comparison. It
   now uses a committed fixture; inserting one row inside the measured window turns it red and names the
   table. The DSN-leak test never produced a DSN either - the mock died as a TypeError three calls before
   the throw - and now asserts `workspace lookups=1` as its own precondition.
4. **So root built the scanner.** `check-assertion-vacuity.ts` over 3092 assertion calls in 74 harnesses
   found eight more of the serious kind, including the identical conjunct defect in
   `check-retainer-runtime.ts:478` - the harness proving retainer lock necessity - two `x === x` JSON
   comparisons, and five envelope loops that derived their expected value from the observed status, so a
   403 regressing to a 200 flipped the expectation with it and still passed. Two of those five were
   `checkInvertible` and therefore counted as falsifiable evidence.

### A claim narrowed, and a claim corrected

**Inventory:** the lock is load-bearing GIVEN THE ABSOLUTE WRITE. `reserved` is computed in JS as
`locked.reserved + qty`, so two unserialised transactions both write 3 and `CHECK (reserved <= onHand)`
accepts both. A relative write would let Postgres take the row lock itself and that same CHECK would
reject the second write. Necessary given this design, not in principle.

**Retainers:** removing each of the four `for update` clauses in `retainers.ts` ONE AT A TIME left the
harness green at 90/90 every time. Removing all four turns it red, `used` going 0->3 instead of 0->8. The
retainer locks are **jointly necessary and individually redundant** - a different situation from
inventory, and the opposite of what the old assertion name implied.

### Next in queue - this table supersedes every earlier one

| Pkg | Scope | State |
|---|---|---|
| 47 `UNGUARDED_EVERY` assertions | across the harness suite | **Owed, and now counted.** An `arr.every(...)` with nothing pinning the array's length passes on an empty array. 9 are mitigated by a sibling assertion; 38 are not. Deliberately non-gating so the new scanner is not red on arrival - see the comment at its exit decision. Clearing them is mechanical and should be one package. |
| 22 `UNRESOLVED` vacuity findings | same | **Owed.** Each carries per-item reasoning. 15 are `every()` over imported constants where emptiness is decided in another module; 5 bracket a call whose purity only the runtime settles. |
| 405 instead of 400 on the due-work method guard | `PersistenceErrorCode`, shared | **Owed and deliberate.** `preview` refuses a non-GET with 400 because the shared error union has no 405 and hand-building a Response would break the envelope property. A real 405 needs `METHOD_NOT_ALLOWED` in that shared union plus an `Allow` header - a platform-wide change, and root did not take it unilaterally at this hour. |
| Determinism of item ORDER | `operations/engine.ts` | **Owed.** Seven of nine domain queries have no unique tiebreak, and the inventory query is an unbounded `findMany` sliced in TypeScript. Two requests can legitimately return a different item order, or a different SET of items where many tie. The harness's determinism assertion is honest for its fixture and should not be quoted more broadly. |
| Engine-owned text says "scheduled" | `engine.ts:294`, `needs-action.ts:187-188` | **Owed, and the honest gap in the due-work work.** `"scheduled visit"` and `"Renewal is scheduled for..."` are engine-authored templates, copied verbatim by the API and the panel. The contract's own worked example warns about exactly this sentence. The panel's wording claim is a subset relation - it adds no forbidden word of its own - not an absence. |
| 503 log may contain a DSN | `due-work-http.ts` | **Known tradeoff, recorded.** Server-side detail, client-side silence. The client body is still asserted leak-free on seven fragments. |
| P1-009 slice 6 | repo-wide lint | Still a refusal. |
| G2 / P1-007 | providers / live cutover | Still **owner-gated**. |


---

## Accepted - Q-wave: the gate became reproducible, then the gate found the defects

Root: `claude-opus-5`, sole integration owner. Baseline `478d13a` (sweep 74, lint 43) ->
HEAD `a38b56e`. Ten commits, four waves, three parallel stages per wave.

| Commit | What landed | Stage |
|---|---|---|
| `b0233e1` | repository-owned gate driver + manifest; the headline number is reproducible | Q1-A |
| `5bf48f7` | 405 with `Allow`; a server log structurally incapable of carrying a DSN | Q1-B |
| `92d6005` | all eight engine domain readers deterministic; `mixedScope` assertion stops mirroring | Q1-C |
| `66b0dec` | both meta-scanners derive assertion helpers from source | Q2-A |
| `3f696b2` | a real write detector: interception + content fingerprints on a separate connection | Q2-C |
| `5c265d1` | a record's own state told apart from a claim that this platform acted | Q2-B |
| `eeab18f` | the credential scanner could hang; the panel claimed a measurement it never made | Q3-C findings |
| `d93a5c1` | log `error.cause`; keep frame evidence; measure the detector's boundary | Q4-A |
| `055280c` | vacuity scanner iterates to fixed point; real blind spot named | Q4-B |
| `a38b56e` | the ninth domain reader was outside every claim made about the other eight | Q4-C |

### The reproducible gate is the load-bearing change

    cd aiclone && node scripts/gates/run-gates.js

75 harnesses on disk, 75 manifest entries, 74 executed, FAILED 0, one declared skip.
Verified at `a38b56e` from primary AND from an isolated clean worktree: identical
inventory compared list-to-list, identical count, selftest 21/21 in both, no working-tree
mutation, no leaked process, no database residue. It resolves the app directory from its
own location, which was tested by invoking it by absolute path from `C:\Windows`.

Two findings from building it. The old temp runner's live-database guard was UNREACHABLE
DEAD CODE - it compared the rehearsal name it had just assigned against the string
`personalink`, a condition that could never be true - so the safety everyone relied on
came from the constant being right, not from the check. And it is ~5x faster, 200s against
18-20 minutes, because roughly fourteen minutes per sweep was `npx` process startup.

### What the new controls then caught, in their own author's work

The gate driver's first sweep flagged a `process.exit(1)` with 14 assertions after it in
Q1-B's harness - the frozen-verdict shape, correctly identified by the exit-integrity
scanner. On the same day the driver landed.

The vacuity scanner caught its own author's regression: root's first version of the new
manifest expectations used `manifest.entries` where the field is `manifest.harnesses`,
breaking six selftest guards, 19/19 to 13/19. The second version threw a ReferenceError
on the real manifest while the selftest stayed green, because no fixture declared
`harnessesOnDisk`. Two fixtures and two cases now cover both guards: 21/21.

The adversarial review found a HANG in the credential scanner - the last line of defence
inside the driver everything is now measured through. `push` calls `redact`, `redact`
does `.replace()` on the same module-level `/g` regex, and `replace` resets `lastIndex`
to 0, so the `exec` loop matched the identical occurrence forever. Proven both ways: the
pre-fix file dies with heap exhaustion, exit 134; the fixed version terminates on six
shapes in 6ms.

### Claims corrected rather than defended

- **The operations panel** rendered "This total spans two boundaries" to every owner from
  a constant-true `mixedScope`. False for an owner with no case milestones and for one
  whose profile owns a single workspace. The same defect class the wave fixed one file
  over, left live in the surface an owner looks at.
- **"never a stockout"** was false in two places, on a fixture with 24 rows at onHand 0
  and a cap of 20. Four stockouts are dropped and the assertion body already pinned it.
- **"all nine domain readers"** covered eight. The ninth issues SEVEN unbounded reads in
  `needs-action.ts`, and the boundedness assertion counts `.findMany(` in `engine.ts`
  alone. `take` is refused there with measured reasons; the cost is discharged by moving
  row-state predicates into SQL as FILTERS, 505 rows fetched becomes 44.
- **"all 14 injection classes caught"** measured the detector's positives only. Two
  injections are now asserted as KNOWN GAPS that fail if the gap closes.
- **Retainer locks** are jointly necessary and individually redundant, and only two of the
  four are on the path the proof exercises - so two of the original four mutations were
  vacuous by construction.

### Next in queue - this table supersedes every earlier one

| Pkg | Scope | State |
|---|---|---|
| HEAD on the due-work surface | `due-work-http.ts`, its harness, the shared write-verb regex | **Owed, and a decision rather than a fix.** RFC 9110 makes HEAD implied by GET; Next.js derives it from the GET export, so the framework would serve a HEAD the service refuses. The current justification is circular - the header is justified from the guard and the guard from the header - and a harness assertion now pins it. The write-verb regex also classifies HEAD as a write verb, which is a category error. Either add HEAD or record the departure knowingly. |
| Four concurrency-unsafe residue proofs | `check-inventory-routes`, `check-inventory-runtime`, `check-retainer-schema-invariants`, `check-fieldjob-schema-invariants` | **Owed.** They prove residue by GLOBAL before/after row counts. Every transient failure in this wave was one of them, always with counts going DOWN - another stage's teardown between snapshots - and every one passed in isolation. The driver runs serially so the gate is not flaky in normal use. Fix is the pattern `check-operations-runtime` already uses: scope to the run's own prefix. |
| Assertion-evidence gate | `scripts/gates/run-gates.js` | **Owed.** A harness that exits 0 without asserting anything still counts toward "74 checks". Zero bytes is the only content gate. Needs a per-harness output contract first. |
| Credential scan breadth | `scripts/gates/lib/redact.js` | **Owed.** `critical` is reachable only from five env-derived DSN literals. A `CLERK_SECRET_KEY=sk_live_...` in a harness log matches nothing, and a passwordless DSN survives redaction with no finding. |
| `check-harness-exit-integrity` wrapper limit | that file | **Owed.** It still carries the bounded-not-converged wrapper loop that `055280c` removed from its sibling. |
| `mixedScope` itself | `engine.ts` + four consumers | **Owed.** Still constant-true and deliberately not redefined. Correcting the field must move it, `due-work-plan`, the panel and the preview harness in one commit. |
| Sequence snapshot scope | `write-detector.ts` | **Owed.** The sequence component of the fingerprint is unconditionally global, so it reintroduces the concurrency problem the module was built to remove. Shielded today only because the driver runs serially. |
| 11 `UNGUARDED_EVERY`, 19 `UNRESOLVED` | harness suite | **Owed, counted, non-gating.** Two of the eleven are new assertions from this wave. |
| `check-order-stream` leg 1 | that harness + the manifest | **Owed, recommended.** Leg 1 makes no HTTP and no DB call and could run today at sub-second cost; the HTTP legs need a dev server and should stay skipped. |
| P1-009 lint | repo-wide | Still a refusal. 43 findings remain a documented product-judgement backlog. |
| G2 / P1-007 | providers / live cutover | Still **owner-gated**. Unchanged. |



## Accepted - R-wave: the gate began asking whether assertions ran, and an audit priced that answer

Start `6e3979c`, end `a494b1b`. Nine packages dispatched, nine reported, **nine accepted, none
rejected, none reverted**. Every package was developed in its own git worktree on its own branch and
integrated only after root re-ran the complete sweep in the primary tree.

| # | Package | Commits | Merge | What it closed |
|---|---------|---------|-------|----------------|
| A | Residue and sequence evidence scoping | `f75acdc`, `4a92975`, `e445407`, `4e20fe6` | `12f9247` | Four harnesses stopped proving residue by global before/after row counts; write-detector sequence attribution became execution-scoped |
| B | Credential scanner breadth and termination | `58d07cc`, `541b097` | `8152348` | `sk_live_`/`sk_test_`, passwordless and percent-encoded DSNs, six assignment forms; termination made structural; self-test 21→35 |
| C | Exit-integrity fixed point | `62bc141`, `868d3d1` | `634c7ff` | Two capped loops that truncated order-dependently replaced by a monotone worklist with an unreachable, loud residual budget |
| D | mixedScope atomic correction | `51087f9` | `7741bd9` | Producer, four consumers and four harnesses in one commit; the counterexample assertions that pinned the defect were replaced, not deleted |
| F | Vacuity debt, four harnesses | `50d7d11` | `284217b` | 6 findings resolved, 2 justified; included the `?? []` empty fallback in check-capability-contract |
| E | Assertion-evidence contract | `32138c0`, `ee6b79c` | `3c4dce4` | 61/74 harnesses enforced with zero harness edits; 13 named rejection kinds; 13-entry exact-filename allowlist; self-test 35→53 |
| G | HEAD semantics + deferred vacuity | `695b948`, `bcafb08` | `0b39cb9` | HEAD honoured instead of refused; write-verb constants split honestly; the 11 findings deferred from wave 2 |
| I | Lint slices | `f18e2f7`, `b62dd3c`, `b6d7d9d`, `507a444` | `bddff80` | 5 of 14 lint errors fixed and proven; 9 declined with reasons |
| H | Adversarial audit + driver repair | `6c325f5`, `17237c8` | `a2897ba` | Broke the evidence contract; repaired a `requiresDatabase:false` crash that wrote no summary at all |
| root | Scanner false-positive repair | `a494b1b` | — | A short `PGPASSWORD` made the driver flag its own summary critical and corrupt it mid-word; green was unreachable |

### Measured at the close

Sweep 74 executed / 74 passed / **FAILED 0** / 1 declared skip / 0 timeouts / 0 integrity findings.
Self-test **55/55**. Assertion evidence ENFORCED: 61 of 74 carried evidence, 3634 assertions counted,
0 unevidenced, allowlist exactly 13. Credential scan clean over 77 artefacts. Prisma validate and
generate 0. TypeScript 0. Repository lint **38 problems (9 errors, 29 warnings)**, down from 43 (14
errors, 29 warnings). `npm audit --omit=dev` 0. Production build compiled successfully in 57s. An
isolated clean worktree reproduced identical counts with `worktreeClean: true, dirtyPathCount: 0`.
Vacuity debt **11 → 2** UNGUARDED_EVERY and **19 → 11** UNRESOLVED.

### Next in queue - this table supersedes every earlier one

Ordered by value, and each item states the evidence it starts from so the next run does not re-derive it.

| Priority | Item | Why, and what is already measured |
|---|---|---|
| 1 | **Corroborate self-reported assertion counts** | The evidence contract is a cooperative protocol: three harnesses asserting nothing printed evidence and got `verdict PASS` with 104153 assertions counted. All 3634 counted assertions rest on trust. Already measured for you: all **75** production harnesses score non-zero on a source-side assertion signal, and all **5** self-test fixture harnesses score **zero** - which is precisely why the cheap version was not shipped. Either give the fixtures real assertion machinery, or corroborate against `check-harness-exit-integrity`'s static callsite count (order 3361) rather than a source regex. |
| 2 | **Widen the credential vocabulary** | `DB_PW=` and `pw:` are in neither vocabulary and pass through unreported. Bounded, database-free, self-test provable. |
| 3 | **Unify the five HTTP method classifiers** | `check-operations-routes.ts` matches only `export async function`, missing **26** route files using `export function GET` and **5** using `export const <VERB>`, and never mentions HEAD/OPTIONS. It polices the same operations surface as `check-operations-runtime.ts` but strictly more weakly. Latent today: 0 of 156 routes export HEAD. |
| 4 | **Guard the `OperationsApiService.today` surface** | Measured: a direct singleton caller gets 200 + data for OPTIONS and for POST. Nothing is exposed over HTTP (the framework refuses POST and answers OPTIONS itself) and no write occurs, so the read-only guarantee currently rests entirely on that route module's exports. |
| 5 | **Partial assertion under-count is silent** | Exit-integrity escalates only when the recognised count is exactly zero, so losing *some* assertions to a callback or computed key is invisible. A sweep of all 12 helper names found 1 hit and it was a doc string, so the tree is unaffected by style rather than by enforcement. |
| 6 | **Remaining vacuity debt: 2 UNGUARDED_EVERY, 11 UNRESOLVED** | Each retains exact file, line, classification and justification. One of the two UNGUARDED_EVERY is a justified subset argument; the other is inside the declared-skip harness. |
| 7 | **9 remaining lint errors** | All React-hooks rules in UI components with no harness proving their runtime behaviour. Three share one root cause - state seeded from a browser-only source (`localStorage`, `sessionStorage`, `matchMedia`) in an SSR'd client component, which cannot move into render without a hydration mismatch. Declining these was the correct call and stays correct until there is a UI behaviour test. |
| 8 | **`mixedScope` coercion caveat** | The `count > 0` filter is JavaScript coercion, so a string count would defeat it. The guarantee is compile-time only. |
| 9 | **Worktree portability** | 10 absolute paths are baked into `latest.json`; untracked `aiclone/.env` is required to run anything. Cosmetic for correctness, real for reproducibility claims. |

### Owner-gated, untouched by this run

Real reminders, payments and provider messages; the live personalink cutover; push, PR, deployment and
tunnel; deletion or modification of the six frozen KiroCrew evidence worktrees; secrets and external
side effects. `check-order-stream` stays `run: false` - measurement showed no leg is free of both an
HTTP origin and the database, correcting the Q-wave's claim that leg 1 needed neither.


### R-wave round 4 - continuation queue (addendum to the table above)

| Package | Outcome | Commits | Merge |
|---|---|---|---|
| M - vacuity, appointment + blueprint | **ACCEPTED** - 6 UNRESOLVED resolved, UNRESOLVED 11 → 5 | `e1208b0`, `d0a09a1` | `d454c92` |
| J - remaining credential/DSN forms | **SALVAGED AND FINISHED BY ROOT** - stage gave no report and committed nothing; its self-test cases were unwritten | `99e8e06` (root) | direct |
| N - vacuity, fieldjob/retainer/workspace | **PRODUCED NOTHING** - 0 commits, 0 dirty files, no report; its 4 findings remain open | — | — |

10 of 12 stages across the whole wave reported. Both failures were confined to their own worktrees and
the primary tree stayed clean at its integrated HEAD - verified after the fact, not assumed.

**Revised counts at close:** sweep 74 executed / 74 passed / FAILED 0 / 1 declared skip. Self-test
**57/57**. Repository lint 38 (9 errors, 29 warnings). Vacuity debt **UNGUARDED_EVERY 11 → 2**,
**UNRESOLVED 19 → 5**. Credential scan clean: 77 artefacts, 0 critical, 0 shape, 0 fatal.

**Queue item 2 is now closed** (`DB_PW=`, `pw:`, plus Go `@tcp(...)`/`@unix(...)`, bare
`user:pass@host:<db-port>`, libpq keyword strings and JDBC userinfo/query/semicolon forms). **Queue
item 6 shrinks** to 2 UNGUARDED_EVERY and 5 UNRESOLVED, of which three are explicitly justified
(cohort-needs-action ×2, and order-stream which sits inside the declared-skip harness). The four
findings PKG-N was meant to take are unchanged and still first in line:
`check-fieldjob-inspection-runtime.ts`, `check-retainer-runtime.ts`,
`check-workspace-surface-boundary.ts`, `check-workspace-surface-contract.ts`.

**New standing risk to watch:** the widened scanner finds one hit across all 2614 artefact files, in a
stale run directory the driver does not scan, where a harness printed a truncated test DSN inside its
own `PASS` label. Current artefacts are clean, but a harness printing a bare `user:pass@host:5432/db`
fragment in an assertion label will now be flagged.


## Accepted - S-wave phase S0: the auxiliary vertical packs

| Item | Outcome | Commits | Merge |
|---|---|---|---|
| Auxiliary vertical-pack candidates + harness | **ACCEPTED** (cherry-picked, not merged from the parked branch) | `f29c985` (= aux `4d6dcd5`) | `48f3605` |
| Harness adapted to the assertion-evidence contract, registered in the manifest, home-services alias constraint made executable | **ACCEPTED** (root) | `b10a017` | `48f3605` |

Measured in the primary tree **and** an isolated clean worktree at the same SHA: 76 on disk, 76 in
manifest, 75 runnable, **75 executed / 75 passed / 0 failed**, 1 declared skip, 0 integrity findings.
Assertion evidence ENFORCED 62/75, 4086 assertions, 0 unevidenced, allowlist unchanged at 13.
Self-test 57/57. TypeScript 0. Targeted ESLint 0. Repository lint 38 (unchanged). `npm audit --omit=dev`
0. Prisma validate/generate 0 with no schema diff. Production build compiled.

**Registered/active blueprints added: NONE.** All six vertical packs are unregistered, non-visible
candidates. `registered: false` is a pinned literal, nothing imports the package except its own
harness, and the harness asserts `blueprints.ts` does not reference it.

### Queue delta

- **Item 1 (corroborate assertion counts) is now sharper, not closed.** S0 produced the cleanest
  demonstration yet: neutering the harness's assertion helper collapsed its count from 447 to 14 and
  **still exited 0**. The count stayed honest; nothing noticed 433 assertions had stopped running.
- **New, from the S0 environment work:** any isolated verification worktree needs `aiclone/.env` as a
  *file* - `check-auth-http-regressions.ts` opens it directly, so exporting `DATABASE_URL` is not
  enough. And a 503 `DEPENDENCY_UNAVAILABLE` in this suite is usually connection exhaustion from
  back-to-back sweeps, not a defect; re-run before investigating.
- **Do not remove a worktree whose `node_modules` is a junction**, and prefer a real `npm ci` per
  worktree - S0 used an independent install and verified `IsReparsePoint=False`.


## Accepted - S-wave phases S1 + S2: the load-bearing hardening gaps

| # | Package | Outcome | Merge |
|---|---|---|---|
| S1-A | Source-side assertion corroboration (AST) | **ACCEPTED** - `codex/s1a-corroborate`, 4 commits | via S1 chain into `b010d71` |
| S1-B | PERMISSION_KEYS tautology → live boundary proof | **ACCEPTED** - `codex/s1b-permkeys`, 3 commits | `b010d71` |
| S1-C | One canonical HTTP method classifier + `today` guard | **ACCEPTED** - `codex/s1c-methods`, 3 commits; harness registered by root `e73d526` | `b010d71` |
| S2 | Guard the `.every` assertions the S1 harnesses introduced | **ACCEPTED** (root) `b010d71` | direct |

Measured at `b010d71`, primary and isolated clean worktree identical: 77 on disk / 76 executed / **76
passed / 0 failed** / 1 declared skip / 0 integrity findings. Assertion evidence ENFORCED 63/76, 0
unevidenced. **Source corroboration ENFORCED 63/63, 0 contradicted, 0 refused.** Self-test 68/68.
Credential scan clean (79 artefacts). TypeScript 0. Targeted ESLint 0. Repository lint 38. `npm audit
--omit=dev` 0. Prisma validate/generate 0, no schema diff. Build compiled. Vacuity 2 UNGUARDED_EVERY /
2 UNRESOLVED.

### Queue delta

- **Item 1 (corroborate assertion counts) is CLOSED at the structural level** and mutation-proved both
  ways. The residue: a *non-constant* always-true condition could still satisfy both the evidence and
  corroboration layers - that is falsifiability, which is the vacuity scanner's job, and it is the
  named next slice. 71 of 77 harnesses are corroborated statically only.
- **Item 3 (unify HTTP method classifiers) is CLOSED** for six of the seven sites. **Left for a future
  slice:** `check-workspace-surface-boundary.ts` is the seventh site; S1-C measured its migration is
  verdict-neutral (its one export is `export async function GET`) and left the exact edit for root, but
  it was owned by S1-B this wave so it was not migrated. Adding it to the classifier's `OLD_SITES` is
  the only remaining step, plus registering it there.
- **Item 4 (guard `today`) is CLOSED.**
- **Item 6 (vacuity) shrinks to 2/2, all justified.**
- **Still open, and now the top of the queue:** reduce the 13-entry evidence allowlist. Not attempted
  this wave - the entries genuinely emit no count, and corroboration is the safer lever than a rushed
  migration. Each allowlisted harness that can be taught to emit a real count drops the allowlist by
  one and moves to enforced+corroborated.
- **Still open:** the 9 React-hook lint errors (need behavioural tests first); `operations/http.ts`
  lacks the sanitizing failure logger `due-work-http.ts` has (needs its own leak proofs).

### Owner-gated, untouched

Real reminders/payments/provider messages; live personalink cutover; push, PR, deployment, tunnel;
the six frozen KiroCrew worktrees; secrets and external side effects. `check-order-stream` stays
`run: false`. **All six vertical packs remain unregistered, non-visible candidates** - no blueprint
became active in S0, S1 or S2.
