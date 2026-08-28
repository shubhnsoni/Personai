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
