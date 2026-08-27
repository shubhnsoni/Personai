# Ownership

Updated: 2026-08-27 07:20 +05:30

## Current Snapshot

- Branch: recovered/aug20-wt-pr-32
- HEAD: e97edf4 (ahead of origin by three commits; nothing pushed)
- Worktree: primary checkout at C:\Users\shubh\Desktop\Projects\personal projects\personai\aiclone
- Status: clean apart from `docs/orchestration/**` and `docs/strategy/**`.

The restaurant work that made this tree dirty is now committed:

- `ea69595` restaurant order model, dashboard cut-over, backfill
- `96ebf4b` cleared the pre-existing type errors that blocked `next build`
- `e97edf4` live order transport

`tsc --noEmit` and `npm run build` both exit 0 at this HEAD. Six lane worktrees are
checked out at `ea69595`; see INTEGRATION_QUEUE.md.

## Owner-Reviewed Paths

These are committed and under active ownership. Workers may propose patches against
them but must not edit them in the primary checkout.

- prisma/schema.prisma
- prisma/migrations/**
- src/app/[slug]/shop/**
- src/app/actions/products.ts
- src/app/actions/orders.ts
- src/app/dashboard/money/page.tsx
- src/app/dashboard/orders/**
- src/app/api/events/** (order streams and cursors)
- src/components/shop/restaurant-menu.tsx
- src/components/dashboard/restaurant-*.tsx
- src/components/dashboard/order-stream-indicator.tsx
- src/lib/nav-counts.ts
- src/lib/restaurant-*.ts
- src/lib/realtime.ts
- src/lib/sse-stream.ts
- src/lib/use-order-stream.ts
- scripts/README.md
- scripts/one-off/*restaurant*.ts
- scripts/one-off/check-order-stream.ts
- docs/strategy/**

## Shared Contracts — Patch Only

Small, reviewed diffs only. A change here affects every role and surface.

- src/lib/surfaces.ts
- src/lib/require-surface.ts
- src/lib/onboarding-needs.ts
- src/app/api/chat/route.ts
- src/lib/rag.ts

## Orchestrator-Owned Paths

- docs/orchestration/**

`docs/orchestration/MONITOR_STATUS.md` and `docs/orchestration/LIVE_ACTIVITY.md` are
regenerated every ~30 seconds by `Watch-KiroCrewOrchestration.ps1` and
`Live-KiroCrewDashboard.ps1`. They are live status output, not source files: they are
git-ignored in this directory and must not be hand-edited.

## Lane-Owned Paths

Each lane owns these inside its own worktree only.

- src/lib/business-os/**
- src/app/api/business-os/**
- src/components/business-os/**
- src/app/dashboard/business-os/**

## Worker Policy

- Workers edit isolated worktrees on dedicated branches, never the primary checkout.
- Lanes must branch from a commit where `tsc` and `next build` pass. See ADR-007.
- No pushing, no production writes, no destructive git operations, and no migrations
  against non-ephemeral data without the owner's approval.
- A task needing an owner-reviewed or patch-only path is WAITING_FOR_OWNER until the
  owner assigns it explicitly.


## Wave 1 Module Ownership (integrated 2026-08-27 at `4649ff1`)

These modules landed in wave 1. Each was owned by exactly one worker, and the disjointness held —
six `--no-ff` merges produced zero conflicts.

| Module / path | Wave-1 owner | Package |
|---|---|---|
| `src/lib/tenancy/**` | slot 1 (gpt-5.6-sol) | P1-011 |
| `src/lib/business-os/{types,engines,blueprints,validation}.ts` | slot 2 (gpt-5.6-sol), EXCLUSIVE | P1-010 |
| `scripts/one-off/check-business-os-{surface,render}.ts` | slot 2, EXCLUSIVE | P1-010 |
| `src/lib/foundation/**` | slot 3 (claude-sonnet-5) | P1-012 |
| `src/components/business-os/**`, `src/app/dashboard/business-os/{error,loading}.tsx` | slot 4 (claude-sonnet-5) | P1-016 |
| `src/lib/testing/**` | slot 5 (gpt-5.6-terra) | P1-008 |
| `src/lib/copilot/**` | slot 6 (gpt-5.6-terra) | P1-015 |

### Contract-layer rule (carry forward)
`src/lib/business-os/**` is a CONTRACT LAYER with a single owner at any time. Consumers — notably
`src/components/business-os/**` — treat it as read-only and may rely only on symbols it already
exports. Changes to it must be ADDITIVE: no exported field, type, symbol or enum member may be
renamed, removed or narrowed while a consumer is being built concurrently. Wave 1 proved this
works: slot 2 reshaped the capability vocabulary while slot 4 rendered it, in parallel, and both
compiled after merge.

### Still root-owned
`docs/orchestration/TASKS.json`, `RUNLOG.md`, `INTEGRATION_QUEUE.md`, `OWNERSHIP.md`,
`DECISIONS.md`. Workers never edit these; they write their own design/ADR documents instead.

### Never worker-owned, in any wave
`prisma/**` (single exclusive schema owner only, and only against a provably disposable database),
`src/middleware.ts`, `src/lib/auth/**`, `src/lib/clerk/**`, `src/lib/surfaces*`, restaurant runtime
(`src/app/api/orders/**`, `src/app/api/restaurant/**`, `src/app/api/bookings/**`,
`src/lib/restaurant/**`, `src/components/restaurant/**`), shared chat/RAG
(`src/app/api/chat/**`, `src/app/api/persona/**`, `src/lib/rag*`, `src/lib/embeddings/**`),
`package.json`, `package-lock.json`.

### Shared-toolchain hazard (learned in wave 1)
Worker worktrees share ONE `node_modules` via a directory junction. Therefore no worker may run
`npm install` or `npx prisma generate` — concurrent generate runs collide on
`query_engine-windows.dll.node` with EPERM and break every sibling. `prisma generate` is a
root-only step, run once at integration after all workers have stopped. Workers run
`prisma validate` only, which is read-only.
