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
