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
