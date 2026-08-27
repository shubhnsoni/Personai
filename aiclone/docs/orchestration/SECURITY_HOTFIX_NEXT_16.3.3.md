# Security hotfix — Next.js 16.0.6 → 16.3.3 (Active LTS)

## Why

`GHSA-p293-qw3h-jr36` affects Next.js `>=16.0 <16.3.3` and permits **unauthenticated remote code
execution**, with no workaround available. This deployment is a Windows-hosted Next.js App Router
server, squarely in scope.

The Windows Firewall LAN block that protects the local preview (`personalink-preview-block-lan-3000`)
does **not** protect traffic delivered through a Cloudflare tunnel: cloudflared connects outbound
from the host and hands requests to the origin over loopback, which bypasses the inbound rule
entirely. Publishing the vulnerable build through a quick tunnel therefore exposed the RCE to the
internet. The tunnel was torn down before this upgrade began.

## Change

Only the dependency graph changed. No product code, no Prisma schema, no Clerk logic.

| Package | Before | After |
|---|---|---|
| `next` | `16.0.6` | `16.3.3` (exact pin, matching prior convention) |
| `eslint-config-next` | `16.0.6` | `16.3.3` (exact pin) |
| `react` | `^19.2.3` (unchanged range) | resolved `19.2.4` |
| `react-dom` | `^19.2.3` (unchanged range) | resolved `19.2.4` |

React and react-dom ranges were left alone; `19.2.4` is what the resolved graph selected and it
satisfies Next 16.3.3's peer requirement. No unrelated dependency upgrades were performed.

## Verification (isolated `node_modules`, 482 packages)

| Gate | Result |
|---|---|
| `npm ls next` | `next@16.3.3` |
| `npm ls react react-dom` | `react@19.2.4`, `react-dom@19.2.4` |
| `npx prisma validate` | 0 |
| `npx prisma generate` | 0 |
| `npx tsc --noEmit --pretty false` | 0 |
| targeted `npx eslint` (14 paths) | 0 |
| `npm run build` | 0 — compiled successfully, `BUILD_ID 4pnIIfPuW-IGfD8KJixNV` |

Harnesses — 10 of 13 pass; the 3 failures are pre-existing or environmental, none caused by this
upgrade:

| Harness | Result |
|---|---|
| business-os surface / render / a11y | 0 |
| capability-contract | 0 |
| tenancy-contracts, tenant-isolation, auth-authz | 0 |
| foundation-contracts, copilot-runtime | 0 |
| disposable-db-guard | 0 |
| `check-restaurant-phase0-behavior` | **pre-existing failure.** `TS2550: Property 'replaceAll' does not exist …` at line 215. Reproduced identically at base on 16.0.6, so it is a `lib` target defect in `scripts/tsconfig.checks.json`, not an upgrade regression. Out of hotfix scope. |
| `check-order-stream` | environmental. Its own guard refuses any database not named the rehearsal target. Not pointed at the rehearsal DB on purpose: that database belongs to the in-flight P2-001 schema owner and this harness writes orders. |
| `check-restaurant-order-transaction` | environmental. Fails a data precondition (`No public restaurant with an available product was found`) thrown by an assert on a Prisma query result, before any Next code path. The disposable copy lacks the fixture. Not baselined against live, deliberately, because it can write. |

Local HTTP checks on the patched build (port 3100, verification server since torn down):

| Route | Status | Notes |
|---|---|---|
| `/` | 200 | `PersonaLink` |
| `/skydine-cafe/shop` | 200 | 21,365 bytes — smaller than the 429,734 seen at base because this worktree was pointed at the disposable copy, which has less product data. Not a regression; re-verified against the live-data preview after merge. |
| `/dashboard/orders` | 200 | `Profile Not Found` shell, no business data |
| `/dashboard/business-os` | 200 | `Profile Not Found` shell, no business data |
| `/api/business-os/blueprints` | 401 | `UNAUTHORIZED` envelope intact |

`Failed to proxy` errors: 0.

## Database safety

This worktree never pointed at `personalink`. Its inherited `.env` did, so `DATABASE_URL` and
`DIRECT_URL` were repointed to the unused disposable copy
`personalink_phase0_clean_20260826_221845` **before** any harness ran, and that target was proven
disposable through the committed guard (`assertDisposableTarget` → ALLOWED). The rehearsal database
was deliberately avoided because P2-001 owns it. The live `.env` was left untouched.

## STILL OUTSTANDING — not fixed here, owner decision required

`npm audit --omit=dev` reports **5 remaining vulnerabilities (2 critical, 3 high)**, all in the
Clerk SDK. `next` no longer appears in the audit at all and `GHSA-p293-qw3h-jr36` is gone, so the
mandated objective is met — but the remaining criticals are security-relevant to authentication:

| Package | Installed | Severity | Advisory |
|---|---|---|---|
| `@clerk/nextjs` | 6.39.0 | **critical** | `GHSA-vqx2-fgx2-5wq9` — Middleware-based route protection bypass (affects 6.0.0 – 6.39.2) |
| `@clerk/shared` | 3.47.2 | **critical** | same, plus transitive `js-cookie` |
| `@clerk/backend` | — | high | `GHSA-w24r-5266-9c3c` — authorization bypass combining organization/billing/reverification checks |
| `@clerk/clerk-react` | 5.61.3 | high | `GHSA-w24r-5266-9c3c` |
| `js-cookie` | ≤3.0.5 | high | `GHSA-qjx8-664m-686j` — prototype hijack enabling cookie-attribute injection |

`GHSA-vqx2-fgx2-5wq9` is a **middleware-based route protection bypass**, and the installed 6.39.0
is inside the affected range. That is a plausible explanation for the observed behaviour that
unauthenticated `/dashboard/*` returns HTTP 200 with a `Profile Not Found` shell instead of
redirecting to sign-in. Measured exposure is currently limited — `Business OS`, `Blueprint`,
`Engine` and `restaurant-venue` each occur 0 times in the public HTML, and the API correctly
answers 401 — but the gate is not behaving as designed.

This was NOT fixed here because the hotfix scope explicitly excludes Clerk authentication logic and
unrelated broad dependency upgrades. A Clerk SDK upgrade is recommended as its own scoped hotfix
with its own verification, since it can change real authentication behaviour.
