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
