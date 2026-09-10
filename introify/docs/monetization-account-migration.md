# Shared billing, business workspaces and independent logins

> Historical design snapshot — 9 September 2026, superseded by subsequent implementation. Statements below about existing code, proposed work and pending decisions describe that baseline. See [billing implementation](BILLING_IMPLEMENTATION.md) for implemented behavior, [pending items](PENDING_ITEMS.md) for later launch status, and the [billing catalog](../src/lib/billing/catalog.ts) for current plan values.

Status: proposed design, not implemented. Read-only code audit dated 9 September 2026. The proposed $10 / $20 / $40 / $100 plans need the account model below before their business and login allowances can be enforced. Prices and tier allowances belong in the [main monetization specification](./monetization-plan.md); this document does not create subscriptions, entitlements, migrations or charges.

## What exists today

| Entity or boundary | Current behavior | Implication |
| --- | --- | --- |
| `User` | Unique local ID, unique Clerk ID and email; `profiles: Profile[]`; global `CREATOR`/`ADMIN` role | One independent platform login already has a stable identity. Global platform admin is distinct from business admin. |
| `Profile` | Business/public-page content, unique slug, required `userId`, many profile-scoped operational records | A user can own multiple profiles in the database. `createProfile` has no numeric business quota, but `/onboarding` redirects users who already own a profile. |
| `Workspace` | Business tenant with nullable, unique `profileId`, unique slug and many locations/memberships | Reuse this as one business; preserve its one-to-one public-profile bridge. Do not turn it into the umbrella subscription account. |
| `Membership` | Unique `(workspaceId, userId)` and business role | Already represents platform staff access, not a customer subscription. There is no status, invitation lifecycle or billed-seat representation. |
| `Location` / `MembershipLocation` | Locations belong to a workspace; memberships can be limited to locations | Locations are branches inside a business, not additional businesses or logins. Empty membership-location links mean unrestricted location scope. |
| `Member` / `MemberSession` / `LibraryLink` | Merchant customers and their purchase-library sessions | These are not platform team seats. Keep their counts and authentication separate. |
| `CommunityMember`, `CohortMembership`, `CourseAccessGrant` | Access to a merchant's community, classes or courses | Their subscriptions, renewal state and course prices are not Introify SaaS plans. |
| `Payment`, `MoneyEvent`, `CaseInvoice`, retainers | Merchant transactions and operational accounting records | Keep platform subscription invoices in a separate billing model. |

Sources: `prisma/schema.prisma` (`User` around line 157; `Profile` 172; `Member` 935; `Workspace` 1352; `Membership` 1397), `src/app/actions/onboarding.ts`, `src/app/onboarding/page.tsx`, `src/lib/members.ts`.

No platform `BillingAccount`, subscription, plan/seat entitlement, general invitation or business-quota model was found. Existing Stripe checkout supports purchases and recurring merchant offerings. The subscription-deleted handler expires merchant community access; it does not manage SaaS plans. `User.stripeConnectAccountId` represents merchant payout onboarding and must not become the SaaS billing-customer identifier. Sources: `src/app/api/stripe/{checkout,purchase,connect}/route.ts`, `src/app/api/webhooks/stripe/route.ts`.

## Two active-business mechanisms must be reconciled

The old dashboard resolves the signed-in owner in `src/lib/auth-sync.ts`. `withActiveProfile` checks the `pl-active-profile` cookie against that user's owned profiles, otherwise chooses the latest updated non-try profile, and reorders `profiles` so the selected one is first. Its admin impersonation path is separate privileged behavior. `src/lib/security/server.ts` feeds this owner list into `src/lib/security/ownership.ts`; `requireOwnedProfile` defaults to `profiles[0]`. The dashboard layout redirects an invited user with no owned profiles to onboarding.

The persisted platform API already uses memberships: `src/lib/persistence/tenancy.ts` maps the authenticated Clerk identity to local `User.id`, lists explicit memberships, and checks permissions and location scopes per requested workspace. Its entry points are `src/lib/persistence/index.ts`, `src/lib/persistence/service.ts` and `src/app/api/platform/workspaces/route.ts`. Domain adapters such as `src/lib/appointments/engine.ts` and `src/lib/reservations/engine.ts` resolve the authorized workspace's `profileId` before accessing old records.

`src/components/business-os/business-os-shell.tsx` persists an explicit choice in `business-os:selected-workspace-id`, accepts it only if it appears in the authorized workspace response, and auto-selects only when exactly one workspace is available. That client-side choice is not the old dashboard's profile cookie. Its page and registry/copilot gates still use the owner-oriented active profile: `src/app/dashboard/business-os/page.tsx`, `src/lib/business-os/api/guard.ts`, `src/app/api/copilot/runs/_shared.ts`. Workspace switching can therefore leave these surrounding gates bound to a different business.

Do not solve this by appending invited businesses to `User.profiles`. Existing owner helpers and writes would then treat team members as owners or fail inconsistently. For example, `updateProfile` in `src/app/actions/profile.ts` still constrains its write by `Profile.userId === actor.userId`.

Distributor desks are a partial collaboration implementation: `src/app/actions/distribute.ts` can assign a membership to an already registered email, with no pending invitation or seat limit. `src/lib/distribute/desks.ts` recognizes SALES/WAREHOUSE/ACCOUNTS. Those roles exist in Prisma but are absent from `KNOWN_ROLES` in `src/lib/tenancy/types.ts`; general platform permissions deny them by default. Unify the role contract before advertising those seats as working across the dashboard. Some domain engines also check broad `profile.update` instead of their advertised booking/order permissions, so review capability-to-role behavior explicitly.

## Recommended account contract

1. Add `BillingAccount`: the subscription and payer container. One account funds many existing `Workspace` businesses; each business retains its profile, slug, data, locations and business permissions. A person may belong to more than one billing account without mixing their businesses.
2. Add `BillingAccountMember`: unique `(billingAccountId, userId)`, account role (OWNER, BILLING_ADMIN or MEMBER) and lifecycle status. Separate account-owner/billing administration from business-data access. Merely paying an invoice must not silently grant access to every business. Give the creating owner explicit workspace memberships.
3. Extend workspace membership with active/revoked state and a link to the corresponding account member. Every business membership must reference a user in that workspace's billing account. Use transactional validation and suitable composite foreign keys/uniqueness to prevent cross-account links. Keep the existing `(workspaceId, userId)` uniqueness.
4. Add `Invitation`: normalized email, inviter, allowed target workspaces/roles, hashed single-use token, expiry and pending/accepted/revoked status. Creation reserves capacity; acceptance requires the matching verified Clerk identity and atomically converts the reservation into active membership. Reissuing or accepting twice must not allocate a second seat.
5. Add a versioned plan/entitlement catalog and `PlatformSubscription`: account ID, provider customer/subscription IDs scoped by provider, merchant account and environment, currency, plan version, status, periods and cancellation state. Permit only one effective base subscription per billing account. Record provider events idempotently in a separate billing-event/invoice history. Resolve authoritative plan prices server-side. Never reuse merchant product checkout metadata as an account entitlement.

Count a seat once per distinct active local `User.id` in `BillingAccountMember`, including the owner, billing-only administrators and read-only viewers. An active internal account user occupies a seat even without a business membership. The same person in three businesses under that account still counts once; the same person in two unrelated billing accounts counts once in each. Never count merchants' customers, library members, students or visitors.

Every outstanding invitation reserves capacity until accepted, revoked or expired. Deduplicate invitations by normalized email/account, including invitations targeting several businesses, and reconcile the reservation to the verified local user on acceptance. Inviting an already active account member to another business does not reserve a second seat. Enforce `active distinct account users + outstanding distinct unallocated invite reservations <= seat limit` transactionally. Acceptance converts a reservation rather than adding a second allocation. This is a capacity allowance within the plan, not an automatic per-seat overage charge.

Business allowance counts active business workspaces, not locations or a user's total memberships. Define treatment of archived businesses and internal try/demo profiles before backfill. Aggregate metered AI/storage/other usage under the billing account while retaining workspace attribution. Enforce limits on the server, including simultaneous create/invite requests. A subscription is a commercial entitlement, not an authorization bypass.

## Phased migration

### 1. Inventory and additive schema

Run a read-only inventory of profiles, workspaces, owners, memberships and location links. Find unbridged profiles, workspaces with null/missing profiles, missing user IDs, differing profile-owner and OWNER-membership records, and try/demo data. Do not assume every old profile has a workspace: current onboarding creates both transactionally, while legacy adapters and try-kit creation can remain profile-only.

Add nullable account links and the new billing/invitation tables without changing access or charging anyone. `Membership.userId` currently has no declared User relation or database foreign key in the foundation migration. `Workspace.profileId` has a manually added database foreign key even though Prisma exposes it as a scalar. Check real constraints and retain them when generating the migration; do not erase hand-written SQL constraints through schema drift.

### 2. Deterministic backfill

Create billing accounts from a reviewed payer-to-business mapping. One provisional account per existing business owner is a starting point only when that person represents a single payer; separate legal payers require separate billing accounts even when the same person administers them. Create missing workspace/profile bridges and explicit owner memberships idempotently, preserving all existing profile IDs and public slugs. Preserve existing invited users as account members and workspace members; do not merge unrelated owners because they share a collaborator. Conflicting owners, orphan bridges and sample data require a reviewed mapping, not an automatic reassignment. Existing records receive a documented legacy/early-access entitlement, not an inferred paid subscription.

Do not use `workspaceIdFromProfileId` in `src/lib/tenancy/adapters.ts` as if it were a real database workspace lookup: it is a legacy projection; persisted workspace IDs can differ from profile IDs.

### 3. One server access context

Introduce a server resolver returning authenticated user, authorized account membership, workspace membership, profile bridge, role/capabilities and permitted location scope. Require explicit workspace identity for reads and mutations; validate any stored selection every time. Prefer workspace-bound URLs/requests so a switch in one browser tab cannot silently redirect a form submission from another business. The selection cookie/localStorage is a convenience, never authorization.

Move the dashboard layout, owner helpers, first-profile actions, registry/copilot gates and background jobs to this context in measured groups. Preserve public-profile routing. Invited-only staff must reach their assigned businesses without creating their own profile. Keep privileged platform support/impersonation explicit, separately authorized and audited. Do not infer billing access from the global `User.role`.

Change the destructive ownership lifecycle before enabling collaboration: `Profile.userId` currently cascades on User deletion, which can delete a shared business and its profile-scoped records. Retain it only as a legacy creator/owner reference during migration, with a restrictive or nullable deletion policy and an explicit business ownership-transfer process. Removing one login or seat must never delete the business or cancel its subscription.

### 4. Invitations, quotas and subscription lifecycle

Ship general invitations, acceptance, revocation, role changes, business creation and account/business switching against the unified access context. Reconcile distributor-specific roles and location-restricted endpoints. Add atomic account-level business/seat/usage enforcement and authoritative subscription webhooks. Keep renewal failure, cancellation-at-period-end and downgrade behavior explicit. Over-limit downgrades should block new allocations and follow the selected grace policy; never silently delete businesses, customers or operational data. Preserve billing repair and data export access as defined in that policy.

Move merchant payout ownership to an explicit business/merchant entity if independent businesses need independent payout accounts. That is a separate change from SaaS subscription collection; retaining today's single user-level Connect account would otherwise couple unrelated businesses' payout onboarding.

### 5. Cutover and cleanup

Compare old/new owner access in shadow mode before enabling team access. Roll out by capability with audit logs and a migration reconciliation report. Once all dashboard/API/job paths use explicit workspace authorization, remove the first-profile fallback from protected workflows. Add non-null/composite constraints only after backfill reconciliation passes. Rollback must retain new memberships/billing history and preserve access to data; it must not reactivate revoked members or drop subscription records.

## Acceptance scenarios

- One account owner buys one plan and creates two allowed businesses. Each has its own slug, profile, records and settings; there is one payer/subscription.
- The owner plus two colleagues have three separate Clerk logins and consume three seats. A colleague assigned to both businesses consumes one seat, not two. A billing-only administrator or read-only viewer also consumes a seat; billing-only access does not grant business data. A merchant customer purchase or course enrollment does not consume a platform seat.
- A collaborator with no owned profile signs in and reaches only assigned businesses. A person in two billing accounts switches explicitly and cannot expose one account's data through the other's selected context.
- Changing localStorage, the active-profile cookie, request IDs or resource IDs never grants another workspace's data. A stale form from business A cannot write to B after a switch. Revoked access fails on the next protected request, including queued work authorization where applicable.
- Role checks cover read/write, invite, role change, billing, ownership transfer and destructive actions. A viewer cannot mutate; a business admin cannot escalate to account owner; distributor roles and location-restricted members get exactly their documented capabilities.
- Concurrent invitations, duplicate invite acceptance and two simultaneous final-slot allocations cannot exceed account allowances. Outstanding invitations reserve seats; expiry/revocation releases them; acceptance converts them to active seats. Case variants of one verified email, invitations to several businesses and inviting an existing account member do not allocate duplicate seats.
- A signed billing event changes only its matched billing account. Replayed or out-of-order events are reconciled safely. Checkout redirects alone do not unlock a paid plan; merchant subscription events cannot change SaaS access.
- Subscription cancellation, failed renewal and downgrade follow the documented grace/over-limit policy without deleting business records. Removing a user or transferring ownership preserves the business, subscription and audit history.
- An idempotent backfill run twice creates no duplicate accounts, workspaces, memberships or seats. All real profile IDs/public URLs survive; orphan/conflicting rows are reported rather than silently merged.

These are required future acceptance checks, not tests claimed to have run. This audit read source and migration files only; it did not inspect production rows or credentials.

## Direct first-profile call-site inventory

Snapshot of source files containing `profiles[0]` on 9 September 2026 follows. This is a migration checklist, not the entire authorization surface: also inspect `requireOwnedProfile` consumers, `Profile.userId` predicates and jobs that accept a profile ID. Test helpers must be updated with the new actor/context fixtures rather than shipped as access controls.

```text
src/app/actions/availability.ts
src/app/actions/bookings.ts
src/app/actions/calendar-sync.ts
src/app/actions/inbox.ts
src/app/actions/leads.ts
src/app/actions/orders.ts
src/app/actions/story.ts
src/app/actions/tables.ts
src/app/api/copilot/runs/_shared.ts
src/app/api/live/pending/route.ts
src/app/dashboard/business-os/page.tsx
src/app/dashboard/business-os/vertical-candidates/page.tsx
src/app/dashboard/calendar/page.tsx
src/app/dashboard/community/[id]/edit/page.tsx
src/app/dashboard/community/page.tsx
src/app/dashboard/courses/[id]/edit/page.tsx
src/app/dashboard/courses/new/page.tsx
src/app/dashboard/courses/page.tsx
src/app/dashboard/events/[id]/edit/page.tsx
src/app/dashboard/events/page.tsx
src/app/dashboard/inbox/page.tsx
src/app/dashboard/layout.tsx
src/app/dashboard/lead-magnets/[id]/edit/page.tsx
src/app/dashboard/lead-magnets/page.tsx
src/app/dashboard/leads/page.tsx
src/app/dashboard/links/[id]/edit/page.tsx
src/app/dashboard/links/page.tsx
src/app/dashboard/money/page.tsx
src/app/dashboard/orders/[id]/receipt/page.tsx
src/app/dashboard/orders/page.tsx
src/app/dashboard/page.tsx
src/app/dashboard/payments/page.tsx
src/app/dashboard/products/[id]/edit/page.tsx
src/app/dashboard/products/new/page.tsx
src/app/dashboard/products/page.tsx
src/app/dashboard/profile/page.tsx
src/app/dashboard/services/page.tsx
src/lib/auth-sync.ts
src/lib/business-os/api/guard.ts
src/lib/security/ownership.ts
src/lib/testing/auth-fakes.ts
```
