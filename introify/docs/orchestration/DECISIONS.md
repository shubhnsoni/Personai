# Decisions

Updated: 2026-08-27 03:38 +05:30

## ADR-001: Separate AI Planes

Decision: PersonaAI will keep customer-facing AI persona and owner-facing Business Copilot as separate runtime planes.

Reason: Visitor chat is discovery/support/sales under public business boundaries. Owner copilot is a permissioned operations manager with private data, tools, approvals, audit, and durable run state.

## ADR-002: Blueprint Composition Over Industry Forks

Decision: Business verticals are versioned blueprints composed from six shared engines.

Reason: The current src/lib/surfaces.ts role/pack model proves the lightweight version of this idea, but it must evolve into versioned engine composition, workflows, policies, KPIs, integrations, and prompt bundles.

## ADR-003: Dirty Tree Requires Documentation-First Phase 0

Decision: Current implementation work is blocked for shared schema/order/chat files until the active restaurant diff is owned or integrated.

Reason: The checkout contains uncommitted edits and untracked restaurant-order files. The prompt forbids stashing, resetting, reverting, or letting workers edit the primary checkout.

## ADR-004: Runtime Agent Runs Need App-Owned Ledger

Decision: Long-running owner-copilot work should persist an application-owned run ledger even if model/provider background execution exists.

Reason: PersonaAI needs resumability, approvals, audit, and human-visible status independent of a provider session.


## ADR-005: Canonical blueprint model is engine composition

Updated: 2026-08-27 07:20 +05:30

Decision: `BusinessBlueprint` is a versioned composition of the six shared engines, with workflows, approval policies, and owner-copilot prompts. This is the model drafted in the `core` lane (`src/lib/business-os/types.ts`, `engines.ts`, `blueprints.ts`).

Reason: Three lanes independently invented three incompatible types under one `business-os` namespace:

- `core` — engine composition plus workflows and approval policies. Matches PROGRAM.md.
- `api` — `BusinessOsBlueprint` as a playbook of `steps` with `stage`, `ownerRole`, and `estimatedMinutes`. A useful checklist shape, but it is not engine composition and does not express the six engines at all.
- `ui` — a dashboard card type with `owner`, `stage`, `health`, and `nextStep`, backed entirely by hardcoded sample data.

PROGRAM.md defines the product as "reusable operating engines and versioned business blueprints", so the composition model is the one that carries the program. The other two are demoted: the `api` step model may return later as a workflow template, and the `ui` shape is a view model that must be derived from the canonical type rather than authored beside it.

## ADR-006: Keep the API plumbing, discard its domain model

Decision: Adopt the `api` lane's transport layer — the `{ ok, data }` / `{ ok, error }` envelope, the `BAD_REQUEST`/`NOT_FOUND`/`INTERNAL_ERROR` code-to-status map, and validated `limit` parsing — and bind it to the ADR-005 type.

Reason: That plumbing is better than the `core` lane's route, which returned a bare object and was marked `force-static` despite being a data endpoint. Two lanes wrote the same file, `src/app/api/business-os/blueprints/route.ts`, with different implementations and different cache semantics; this resolves the collision by taking the better half of each.

## ADR-007: Worker lanes must branch from a commit that builds

Decision: Lanes are rebased onto a base commit where `tsc --noEmit` and `next build` both exit 0. From today that is `e97edf4` or later.

Reason: All six lanes branched from `ea69595`, which still carried ten long-standing type errors in unrelated files. `npm run build` was therefore impossible to pass in any lane, and QUALITY_GATES.md makes that build a precondition for integration. The gate was unachievable by construction, which is the most likely reason the `quality` lane produced nothing. Evidence: `tsc` in each of the three code lanes reports the same 19 error lines, and not one of them names a `business-os` file — the lanes' own code is type-clean, the failures are inherited. Commit `96ebf4b` removes those errors.

## ADR-008: The dirty-tree blocker from ADR-003 is lifted

Decision: ADR-003's documentation-only restriction no longer applies. Restaurant order work is committed as `ea69595`, `96ebf4b`, and `e97edf4` on `recovered/aug20-wt-pr-32`.

Reason: ADR-003 existed because the restaurant diff was uncommitted and unstashable, so any worker touching shared files risked destroying unrecoverable work. That risk is gone: the work is in history, and the lanes already branched from it. Restaurant and Prisma paths stay owner-reviewed under OWNERSHIP.md, but the reason is now ordinary code review rather than data loss.


## ADR-009: Repo-wide lint baseline exception, time-limited

Updated: 2026-08-27 13:30 +05:30

Decision: `npm run lint` may exit non-zero while its totals match the accepted baseline of
124 problems / 63 errors. Targeted lint on changed files stays **mandatory and must be
clean**. Unrelated and restaurant-owned files must not be edited merely to make the global
count green. A separately scoped lint-cleanup package is queued as P1-009.

Reason: owner-accepted. The 63 errors predate this work and live in files this scope has no
mandate over. Editing them to satisfy a counter would mix unrelated risk into feature
commits and would touch owner-reviewed restaurant paths. The measurable standard that does
mean something — no regression, nothing new — is enforced instead.

Enforcement: every integration records both totals. If the consolidated total ever exceeds
the baseline, that is a regression and blocks integration regardless of targeted lint.

## ADR-010: Mocked authentication, not real credentials

Decision: missing Clerk keys are not a blocker for local development. Authentication,
authorization and tenant isolation are proven by deterministic mocked tests, queued as
P1-008. Real credentials are neither introduced nor requested to make local tests pass.

Reason: owner-decided. Local gates must be reproducible without secrets, and a test that
depends on a live identity provider is neither deterministic nor safe to run anywhere. The
authorization predicate, the guard's `UNAUTHORIZED` versus `FORBIDDEN` split, and per-tenant
scoping are all pure functions of inputs, so they are testable by injecting a principal.

Consequence: any claim about signed-in behaviour must cite a mocked test, not an assumption.
Where a real HTTP path genuinely cannot be exercised, say so rather than implying coverage.

## ADR-011: Additive schema only, in isolation, against a provably disposable database

Decision: Prisma schema and migration development is approved **only** in a fresh isolated
worktree and **only** against a uniquely named disposable PostgreSQL database. Approval
explicitly excludes: applying anything to `personalink`; live backfill or cutover; changing
or deleting existing restaurant records or models; resetting, dropping or cleaning an
unidentified database; and any deployment or push.

Mandatory precondition: before any migration command, parse the connection target and prove
from the parsed database name that it is the intended disposable database and is **not**
`personalink`. If that cannot be proven, the database action stops. Proof means the parsed
name is compared and recorded, not that a variable was set somewhere.

Reason: owner-decided, and it matches how the restaurant work was rehearsed. One live
database exists and there is no staging instance, so isolation has to be structural rather
than procedural.

## ADR-012: Capability ids become granular, with the three-item groups kept as UI categories

Decision: capability ids grow to a granular, stable set that matches the engine ownership
contracts in ENGINE_CONTRACTS.md. Deposits, waitlist, documents, variants, fulfilment,
returns and their peers become independently selectable ids. The existing three-item
groupings may remain as **UI categories** for presentation, but they must not hide
independently selectable capabilities.

Reason: supersedes the open question raised in `VERTICAL_BLUEPRINT_MAP.md` section 6, which
measured the gap: three capability ids per engine against eight or nine owned nouns, so a
blueprint could not express "appointments with deposits but no waitlist". Descriptions were
carrying load that ids should carry, and validation cannot check a description.

Owner: P1-010, the capability and blueprint contract worker, exclusively. No other worker
may edit the shared Business OS contract files while that package is open.

## ADR-013: Capability maturity is explicit, and gates blueprint activation

Decision: every capability descriptor carries an explicit maturity of
`planned | partial | available`, with evidence. Validation **rejects an `active` blueprint
when any required capability is not `available`**. `draft` blueprints may reference
`planned` or `partial` capabilities freely.

Reason: `restaurant-venue-v1` was marked `active` while two of its required capabilities were
a JSON blob on a generic `Booking` and a single nullable `stock` column. Validation passed
because it only checked that ids exist, never that anything backed them, so `status: active`
was an assertion nobody verified. Maturity plus enforcement turns it into a checkable claim.

## ADR-014: Correct the restaurant blueprint by versioning, not by pretending

Decision: a new version of the restaurant blueprint is created whose `active` required
capabilities reflect only shipped behaviour — `venueOrders`: `qrOrdering`, `guestTracking`;
`commerce`: `catalog`, `orders`. Reservations and real inventory move to the planned backlog
until backed by engine-grade implementation. Restaurant **runtime** paths are not edited for
this correction.

Reason: owner-directed, and it is the honest option. The alternative — declaring
`reservations` and `inventory` required on an active blueprint — advertises capability that
does not exist. Versioning records the correction instead of rewriting history, and keeping
runtime paths untouched keeps the shipped ordering flow out of a contract-only change.
