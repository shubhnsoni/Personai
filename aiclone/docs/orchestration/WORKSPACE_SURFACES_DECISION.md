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

**PRECISION, added after independent review.** The sentence "no existing surface consumer has a workspace
id" is imprecise as written, and the reviewer was right to say so. The exact position, verified
independently at `8b4d8e3`: a broad import grep finds **27** source files; of those, **20 are production
read consumers** and none contains `workspaceId`, `selectedWorkspaceId`, a membership lookup or a
workspace-list lookup. The other seven are four type-only importers (`header.tsx`, `content-manager.tsx`,
`mobile-sidebar.tsx`, `onboarding-needs.ts`), the QA page, the testing auth fake, and `onboarding.ts`.

`onboarding.ts` **does** contain `workspaceId` — it is measurement 6 below — but it is not a
counterexample: it WRITES profile extras and creates the workspace, and it never reads effective surfaces
or calls the resolver. The compatibility claim holds for the twenty read consumers, which is the set that
matters, and that is what the claim should have said.

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

### CORRECTION, after S1-A's evaluation — the above is superseded

S1-A implemented and proved the opposite and was right. Recorded rather than quietly replaced, because the
reasoning matters more than the conclusion.

The regression this section feared **cannot occur**, and measurement 3 is why: nothing currently consumes a
workspace-aware resolver, because no existing surface consumer has a workspace id. So "empty" is not a
regression, it is a choice about what a *new* consumer sees — and the only new consumer is the Business OS
console, which is looking at one specific workspace. Showing that panel the *profile's* surfaces would be
precisely the profile/workspace conflation this whole document exists to prevent.

The shipped design is therefore **two separate methods**, not one method with a fallback flag:

- `forWorkspace(workspaceId)` — installation-derived, or **explicitly empty** with
  `source: "no-active-blueprint-installation"`. Never falls back to profile state.
- `withoutWorkspace(profile)` — the legacy answer, taking the profile values as an **argument**, so it is
  structurally incapable of querying memberships and therefore of guessing a workspace.

This is better than the flagged fallback specified above for a reason worth keeping: it moves the
fall-back decision **to the caller, where it is visible**, instead of hiding it inside the resolver behind
a `source` field a caller could ignore while still receiving surfaces. A flag that must be read to avoid a
wrong conclusion is a weaker guarantee than two functions that cannot be confused.

The four-outcome table below is **obsolete in two of its four rows** and is retained only because this
correction refers to it. Independent review pointed out that the sentence previously here — "still
describes the system" — was simply false. Read the authoritative table a few lines down, not this one.

**The `source` VALUES in the table below are superseded too, and the table is left in place only because
this correction refers to it.** S2-A flagged that two vocabularies coexisting in one document is a
confusion hazard, and it was right. The authoritative strings are in
`src/lib/business-os/workspace-surface-types.ts` and are:

| Context | Authoritative `source` |
|---|---|
| workspace, ACTIVE installation | `active-blueprint-installation` |
| workspace, no ACTIVE installation | `no-active-blueprint-installation` |
| no workspace id | `legacy-profile` (from the separate `withoutWorkspace` method) |

`workspace-installation` and `profile-fallback` below are **not real values** and never shipped. Build
against the type file, never against this prose.

So the resolver has four outcomes, and they must be distinguishable rather than collapsed:

| Context | Source of surfaces | `source` |
|---|---|---|
| no workspace id | profile role kit + extras | `profile-legacy` |
| workspace, ACTIVE installation | `configJson.surfaces`, frozen | `workspace-installation` |
| workspace, no ACTIVE installation | **superseded — see the CORRECTION above; the shipped behaviour is an EXPLICITLY EMPTY set with `no-active-blueprint-installation`, never profile extras** | ~~`profile-fallback`~~ |
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


---

## OPEN DEFECT — the shell selects a workspace on the user's behalf (found by independent review)

**Severity: MAJOR. Not a cross-tenant disclosure. Not fixed in this run.**

The resolver honours precedence rule 4 exactly: `forWorkspace` takes an explicit id and
`withoutWorkspace` takes the profile as an argument, so neither can query memberships and neither can
guess. That part is structural and was attacked and held.

The **shell** is where the rule leaks, and the chain is:

- `src/lib/auth-sync.ts:113-117` picks the active profile from a cookie, then falls back to latest/first.
- `src/app/dashboard/business-os/page.tsx:24,29-30` takes `user.profiles[0]`.
- `src/components/business-os/business-os-shell.tsx:274-278` prefers the workspace whose `profileId`
  matches, **then falls back to `workspaces[0]?.id`**.
- `src/lib/persistence/tenancy.ts:53` orders memberships by workspace name and membership id — so `[0]`
  is an alphabetical accident, not a user decision.

A user with authorized memberships in A and B, whose active profile matches neither, is shown A's
installation-derived product configuration because A sorts first. They are a member of A, so nothing
leaks — but they may believe they are looking at B.

### Why it was not fixed here

Removing the auto-selection is not a local change. Twelve panels in the shell take `workspaceId`, and
blanking the selection would empty all of them on load. Doing it properly means an explicit
workspace-selection state with a deliberate "no workspace chosen" rendering across the whole console —
its own package, with its own UI decisions.

### What WAS done, and why it is not a fix

`workspace-surfaces-panel.tsx` now always names the workspace it is showing. That removes the
*ambiguity* which made an implicit selection dangerous rather than merely convenient: an owner can see
which workspace answered. The implicit selection itself remains.

### The package that closes it

Make workspace selection explicit in `business-os-shell.tsx`: no auto-selection when the user has more
than one authorized workspace, a deliberate empty state until they choose, and the choice persisted so
it survives a reload. Then delete the `workspaces[0]` fallback. Check every panel's empty state before
doing it, because they will all start seeing `workspaceId === ""` on first load.
