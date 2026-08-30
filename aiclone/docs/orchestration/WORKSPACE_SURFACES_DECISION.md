# Workspace-scoped surfaces — the canonical precedence and compatibility decision

Root decision, written before implementation, from measurement rather than from the design intent. Root
owns `src/lib/surfaces.ts` and every shared type; this document is what any worker or later session must be
held to.

## The problem, stated exactly

Installation records which blueprint a **workspace** runs, and freezes the surfaces that blueprint implies
into `BlueprintInstallation.configJson`. Nothing applies them. The reason is in `install-types.ts`:
surfaces are stored **per profile** as JSON on `Profile.personalityConfig`, an installation is **per
workspace**, and a user reaches many workspaces through `Membership` — which is keyed by `userId`, not
`profileId`. Writing workspace-scoped intent into a profile-scoped store would change what that user sees
in workspaces the install said nothing about.

So the gap is not "installation forgot to apply surfaces". It is that **surface resolution has no notion of
a workspace at all.**

## The measurements that decide the design

Every one of these was measured at `8b4d8e3`, not assumed.

**1. `surfacesFor` is pure and workspace-blind.** `surfacesFor(role, extras)` takes a role string and
extras. There is no workspace parameter anywhere in `src/lib/surfaces.ts`.

**2. Twenty files consume `src/lib/surfaces.ts`.** Navigation (`sidebar.tsx`), the dashboard layout, six
dashboard pages, the `requireSurface` gate, the public profile view, the chat route, the copilot runtime,
analytics, and the `businessOs` API guard.

**3. NOT ONE FILE UNDER `src/app/dashboard/**` MENTIONS `workspaceId`.** This is the keystone. The entire
dashboard — layout, sidebar, every page, and the `requireSurface` redirect gate — is purely profile-scoped
and has no workspace context to resolve against.

**4. Workspace context exists in 68 files, and none of them is a dashboard page.** It lives in
`src/lib/business-os/**`, `src/components/business-os/**`, `src/app/api/platform/**`,
`src/lib/persistence/**`, and the workspace-scoped engine runtimes under `src/lib/**`.

**5. `business-os-shell.tsx` holds `selectedWorkspaceId` in React state** and fetches per workspace. The
Business OS console is the one surface that already knows which workspace it is looking at.

**6. `src/app/actions/onboarding.ts` is the single intersection point.** It writes profile-level surfaces
via `writeExtras(extrasFromAddons(role, addons))`, creates a `Workspace`, and creates an OWNER
`Membership` — and it installs **nothing**. That is enforced by `check-onboarding-blueprint-coverage.ts`.

## What measurement 3 buys, and it is the whole compatibility story

Because no existing surface consumer has a workspace id, a workspace-aware resolver **cannot change any
existing behaviour**. There is no code path where a workspace id is available and being ignored. The
resolver is strictly additive, and "compatibility layer" overstates it: the legacy path is not wrapped,
adapted or deprecated, it is simply the branch taken when there is no workspace — which today is every
dashboard request.

This is why no migration is needed, and why the correct move is one workspace-aware resolver built around
the existing installation record rather than a second mechanism bolted onto it.

## Canonical precedence

Evaluated in this order. Each rule states what it refuses as well as what it grants.

**1. Security and RBAC remain authoritative, and surfaces are not a permission.** A surface answers "is
this product area part of this business", never "may this user do that". `PERMISSION_KEYS` is 18 and must
stay 18; nothing here consults or produces a `PermissionKey`. A caller that has a surface and lacks the
permission is still refused by tenancy, and the resolver must be incapable of changing that because it
returns surfaces and nothing else.

**2. A workspace's ACTIVE installation determines that workspace's product surfaces.** Read from
`configJson.surfaces` — the config FROZEN at install time, not re-derived. Re-deriving would silently
change what a workspace shows when the registry moves, which is exactly the drift `driftedFromRegistry`
exists to *report* rather than to enact.

**3. Legacy profile-level surfaces apply ONLY where there is no workspace context.** Unchanged behaviour
for all twenty existing consumers.

**4. No workspace context must never guess from another membership.** If the caller has not named a
workspace, the resolver must not pick one — not the only one, not the first, not the most recent. A user
with one workspace today may have two tomorrow, and a resolver that guessed would change its answer
silently. Absence of context resolves to the profile-level answer, never to an inferred workspace.

**5. `SUPERSEDED` and `REMOVED` installations contribute nothing.** Only `ACTIVE` is read. An upgrade uses
the new frozen config alone; old and new are never unioned, because a union would produce a set of surfaces
no blueprint ever declared.

## The fourth state the directive does not name, and it is the common one

The five rules cover "no workspace" and "workspace with an active installation". Measurement 6 forces a
third case: **a workspace that exists and has NO active installation.** Onboarding creates workspaces and
never installs, so today that is *every* workspace in the product.

Three options, and only one is honest:

- **Return no surfaces.** A regression for 100% of existing workspaces.
- **Silently fall back to profile surfaces.** Indistinguishable from a configured workspace, so the console
  would claim a workspace is set up when nothing was installed. This is the failure mode this codebase
  spends its harnesses preventing.
- **Fall back, and say so.** The resolver returns the profile-level surfaces AND a `source` discriminating
  `"workspace-installation"` from `"profile-fallback"`, so a caller can render "this workspace has no
  blueprint installed" instead of implying it does.

**Decision: fall back, and say so.** The resolved value carries its provenance, exactly as preview tags
every derived value `role-derived`. A caller that wants to render configured-vs-not can; a caller that only
wants surfaces still works.

So the resolver has four outcomes, and they must be distinguishable rather than collapsed:

| Context | Source of surfaces | `source` |
|---|---|---|
| no workspace id | profile role kit + extras | `profile-legacy` |
| workspace, ACTIVE installation | `configJson.surfaces`, frozen | `workspace-installation` |
| workspace, no ACTIVE installation | profile role kit + extras | `profile-fallback` |
| workspace not accessible | nothing; fails closed | refusal, not a source |

## Refusals

A missing workspace and a foreign workspace must fail **closed** and **byte-identically**, reusing the
shared tenancy bridge so this surface cannot become a workspace oracle. Failing closed means refusing —
never "returned the profile surfaces because the workspace lookup failed", which would turn an
authorization error into a silent downgrade that still shows product areas.

## What must NOT be built

- **No second surface table, and no second install table.** `configJson` already holds the resolved
  surfaces for the workspace. If it is genuinely insufficient, that must be *demonstrated* before anything
  durable is added — and root becomes the exclusive schema owner for it.
- **No write to `Profile.personalityConfig` from any installation path.** Proven byte-for-byte unchanged by
  `check-blueprint-install-runtime.ts`, and that proof must keep passing.
- **No new permission key.** Adding one to `PERMISSION_KEYS` extends the OWNER and ADMIN closures
  automatically, since both derive from `ALL_PERMISSIONS`, and forces a decision about every other role.
- **No change to `businessOs`.** It is absent from `ALL_SURFACES`, so no role kit grants the owner console,
  and installing must not become a way to obtain it. `configJson.businessOsExcluded` is asserted true.
- **No mutation of `surfacesFor`'s signature.** Twenty consumers depend on it. The workspace-aware resolver
  is a new function that *uses* it, not a replacement that breaks them.
