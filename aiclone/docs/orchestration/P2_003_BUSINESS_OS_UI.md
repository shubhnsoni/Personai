# P2-003 — Persisted Business Onboarding and Business OS UI

## Scope

- Branch: `feature/p2-003-business-os-ui-fresh`
- Verified base: `e91471f467fa7cb3ad7bb456e2e1e2bc4e0f6aea`
- No Prisma schema, migration, package-manifest, middleware, shared-auth, restaurant, chat/RAG, or frozen-evidence change.
- No live-database write or migration, external provider call, public tunnel, origin change, push, PR, or deploy.

## Delivered behavior

- `createProfile(data)` derives identity only from the authenticated server actor.
- Onboarding atomically creates the Profile, matching Workspace, and OWNER Membership together with any role-specific starter rows.
- Browser callers no longer send a `userId` claim from either onboarding entry point.
- `GET /api/platform/tasks?workspaceId=…` lists only exact-envelope tasks after persisted membership and `profile.read` authorization.
- The Business OS console reads persisted workspaces, contacts, activities, tasks, Copilot runs, approvals, execution records, and audit events.
- Explicit loading, empty, 401, 403, dependency-error, and retry states are rendered without substituting sample operational data.
- Workflow templates are labelled as declared configuration. The only executable action exposed is the server-owned `recordAudit`; notification, payment, publication, and other declared actions are not presented as live.

## Executable evidence

`check-business-os-p2-e2e.ts` uses only the designated disposable rehearsal database and a transaction that is deliberately rolled back. It executes:

1. anonymous and authenticated canonical onboarding;
2. Profile + Workspace + OWNER Membership provisioning with a forged caller identity ignored;
3. real platform workspace/contact/activity/task route and service boundaries;
4. anonymous, foreign-workspace, missing-workspace, and valid-owner reads;
5. a Prisma-backed Copilot run with a pending approval;
6. blocked pre-approval execution with zero agent/step/tool/audit side effects;
7. owner approval and the real server-owned `recordAudit` action;
8. append-only audit reads and foreign/missing run non-disclosure;
9. zero external network calls; and
10. rollback to zero across users, profiles, workspaces, memberships, contacts, activities, tasks, workflow runs, approvals, and audit events.

Result: normal/inverted/restored `0/1/0`, 33 assertions per normal pass, `externalCalls=0`, and every tracked rollback count `0`.

## Verification

- Prisma validate: `0`
- Prisma generate: `0`
- TypeScript: `0`
- Targeted ESLint: `0` errors; one inherited `@next/next/no-img-element` warning in the onboarding wizard
- Updated action authorization harness: `0/1/0`, 115 assertions, all onboarding provisioned row types rolled back to zero
- Updated persisted-adapter harness: `0/1/0`, 33 assertions
- Executable Copilot runtime: `0/1/0`
- Business OS surface, render, and accessibility harnesses: `0`
- Seven production action/route security harnesses plus HTTP boundary: each `0/1/0`; HTTP `portCleared=true`
- Seven shared ownership/auth/tenant/Business OS/disposable-target regressions: `0`
- `npm audit --omit=dev`: `0` vulnerabilities
- Production build: `0`
