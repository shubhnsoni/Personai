# Owner Copilot: Shipped Surface and Runtime Contract

Updated: 2026-08-27

This document describes only behavior evidenced by the repository. It separates the shipped
Business OS surface from the pure in-memory runtime reference contract in `src/lib/copilot/`.
The reference contract is executable and database-free; it is not yet wired to a production
route, provider loop, or Prisma persistence.

## Shipped access and navigation

`businessOs` is a registered `Surface` in `src/lib/surfaces.ts`. Both
`surfaceForPath("/dashboard/business-os")` and `navHrefToSurface("/dashboard/business-os")`
resolve it. The shared `navGroups` list in `src/components/dashboard/sidebar.tsx` registers
Business OS, and `visibleNavItems` filters it through `hasSurface`.

Access is intentionally closed by default:

- `businessOs` is absent from `ALL_SURFACES` and every role kit.
- `CUSTOM`, unknown, `null`, and empty roles therefore deny the surface by default.
- `CUSTOM` is especially important: it is the Prisma default for `Profile.roleTemplate`, the
  onboarding “Something else” option, the try-kit role, and the fallback for unknown roles.
- Access requires an explicit per-profile opt-in through `extras.surfaces`; there is no
  implicit role-based entitlement.

`src/app/dashboard/business-os/page.tsx` applies `requireSurface` on the server. API routes
reuse `requireBusinessOsAccess` from `src/lib/business-os/api/guard.ts`. A caller with no
session receives `UNAUTHORIZED`/401; an authenticated caller without a profile or without
the `businessOs` surface receives `FORBIDDEN`/403, via the mapping in
`src/lib/business-os/api/responses.ts`.

## Shipped blueprint validation

`validateBusinessBlueprint` in `src/lib/business-os/validation.ts` validates required
blueprint fields and engine capabilities. It also rejects:

- duplicate workflow ids;
- event triggers without an event name;
- schedule triggers without a schedule; and
- a required approval with a blank reason.

The current blueprint workflow planner is in-memory and plan-time only. It does not provide a
persisted owner-copilot conversation, provider tool loop, route, or production run ledger.
Those remain unimplemented integration work.

## Executable reference runtime contract

`src/lib/copilot/runtime.ts` provides a pure in-memory reference for the future owner copilot
runtime. It has no database, Prisma, route, auth, or business-engine dependency.

- `WorkflowRun` has a total lifecycle: `queued → planning → awaiting_approval → executing`,
  with legal terminal paths to `completed`, `failed`, or `cancelled`; an executing run with a
  running step can recover as `interrupted`, then legally resume to `executing`. Every other
  transition is rejected.
- `AgentRun` has a total lifecycle: `queued → running → waiting_for_approval`, plus legal
  terminal paths to `completed`, `failed`, or `cancelled`. Every illegal transition is
  rejected.
- Steps and tool calls have stable one-based ordering. Tool calls require an executing run and
  a running step.
- An approval is a distinct record, not a boolean. Its reason must be one of the validated
  approval reasons. An ungranted approval blocks the workflow from entering `executing`.
- Audit events are ordered, immutable, and append-only. The runtime refuses mutation and
  deletion APIs. Rebuilding the runtime from its event ledger reconstructs runs, approvals,
  steps, agents, and tool calls; a run interrupted mid-step returns as `interrupted` and can
  resume through the state machine.
- A repeated `idempotencyKey` returns the original start outcome and does not append a second
  workflow or ledger entry.

`scripts/one-off/check-copilot-runtime.ts` exercises these positive and negative guarantees.
It is a local contract harness, not a database test or migration.

## Explicitly not shipped as production behavior

No owner-copilot route, chat session, provider execution loop, durable database table,
background worker, schedule-trigger executor, or production audit storage is represented by
this reference implementation. No claim in this document should be read as deploying those
capabilities. The additive schema proposal for a later owner-controlled migration is in
`docs/orchestration/COPILOT_RUNTIME_PROPOSAL.md`.
