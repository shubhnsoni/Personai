# P1-014 Server Action authorization inventory

**Reconciled:** 2026-08-28 13:15 +05:30  
**Authoritative base for active packages:** `05ead37ed39a7a926786419f4fc0e108d9a440b9`  
**Source:** audit commit `edb65facb354b2c8bb42a18ffdb9e35e4fee03f2` and its `AUTH_ADVERSARIAL_REVIEW.md` exact static list.

## Reconciliation note

The audit's exact static inventory contains 11 modules. Lane A fixed three modules in that exact list—`content.ts`, `onboarding.ts`, and `short-links.ts`—plus `products.ts`, a fourth Server Action module found in the audit's late critical addendum. The statement “four of the 11” is therefore not literally correct. Of the eight exact-list modules outside Lane A, seven contain owner mutations and `library.ts` contains an intentional anonymous email-capability flow plus an owner-only dashboard resend boundary.

## Required boundary contract

Every owner mutation must execute the real production action and prove: anonymous `401`; foreign tenant `403`; missing and foreign resources have indistinguishable refusal envelopes; refusal causes no database, revalidation, filesystem, network, provider, email, token, or cookie side effect; and a valid owner succeeds. Each package must run normal / `INVERT_ASSERTION=1` / restored as `0 / non-zero / 0`, use transaction-scoped fixtures on only `personalink_phase0_rehearsal_20260826_210704`, and assert rollback leaves zero fixtures.

Intentional public capability actions use the corresponding public contract: existing and missing identities return the same envelope; no token or existence signal is returned; capability delivery goes only to the claimed address; missing identities are not created; and no caller can use the public action to gain another identity's session.

## Exact 11-module inventory

| Module | Severity / decision | Current owner | Required executable evidence |
| --- | --- | --- | --- |
| `src/app/actions/content.ts` | **Critical** — cross-tenant knowledge create/update/delete and chat ingestion | Lane A, integrated in merge `4d24076` | `check-actions-authz.ts`: `addContent`, `updateContent`, `deleteContent`, `syncKnowledgeFromChats`; anonymous/foreign/missing/owner/no-effects plus `0/1/0` |
| `src/app/actions/onboarding.ts` | **Critical** — caller-selected profile owner | Lane A, integrated in merge `4d24076` | `check-actions-authz.ts`: canonical and legacy `createProfile`; server-derived identity, forged/missing user refusal, owner success, no-effects, `0/1/0` |
| `src/app/actions/short-links.ts` | **High** — cross-tenant redirect retarget/delete enables phishing | Lane A, integrated in merge `4d24076` | `check-actions-authz.ts`: create/update/delete; foreign/missing indistinguishable, no redirect mutation on refusal, owner success, `0/1/0` |
| `src/app/actions/communities.ts` | **High** — cross-tenant paid community and invite-link mutation | Catalog package, job `42cba339`, branch `security/actions-catalog-authz` | `check-catalog-actions-authz.ts`: create/update/delete with full owner contract and `0/non-zero/0` |
| `src/app/actions/events.ts` | **High** — cross-tenant event, meeting URL, price and publication mutation | Catalog package, job `42cba339` | New catalog harness: create/update/delete/active toggle with full owner contract and `0/non-zero/0` |
| `src/app/actions/lead-magnets.ts` | **High** — cross-tenant public download/form mutation | Catalog package, job `42cba339` | New catalog harness: create/update/delete with full owner contract and `0/non-zero/0` |
| `src/app/actions/services.ts` | **High** — cross-tenant service/table capacity and price mutation | Catalog package, job `42cba339` | New catalog harness: add/update/delete/active toggle with full owner contract and `0/non-zero/0` |
| `src/app/actions/courses.ts` | **High** — cross-tenant course/module/lesson content, publication and ordering mutation | Course/profile package, job `219c14cd`, branch `security/actions-course-profile-authz` | `check-course-profile-actions-authz.ts`: every exported course/module/lesson create/update/delete/move/import/publish boundary, scoped recounts, full owner contract, `0/non-zero/0` |
| `src/app/actions/profile.ts` | **Critical** — cross-tenant public identity, slug, AI behavior, payment/contact and portfolio mutation | Course/profile package, job `219c14cd` | New course/profile harness: profile update plus every work-experience/project create/update/delete, full owner contract, `0/non-zero/0` |
| `src/app/actions/import.ts` | **Critical** — anonymous fetch/model compute plus broad cross-tenant writes through imported bundles | Import/library package, job `dcbf03b9`, branch `security/actions-import-library-authz` | `check-import-library-actions-authz.ts`: all ingestion boundaries refuse before fetch/model/parse effects; `applyImportBundle` owner contract; nested-effect counters; `0/non-zero/0` |
| `src/app/actions/library.ts` | **Medium / explicit capability design** — public login link is intentional; dashboard resend must not mint/send another tenant's access | Import/library package, job `dcbf03b9` | New import/library harness: public request existing/missing byte-equivalent and no token leak/member creation; resend anonymous/foreign/missing/owner and no email/token effects on refusal; logout caller-cookie only; `0/non-zero/0` |

## Lane A's fourth fixed Server Action module

`src/app/actions/products.ts` is not in the exact 11-module static list; it was a late **Critical** addendum. Lane A integrated ownership checks for product create/update/delete/active-toggle/order-confirmation, with intentional public purchase/tip/review flows separately exercised by `check-actions-authz.ts`.

## Release gate

This inventory is not acceptance. Root must independently inspect each worker commit, rerun its real-boundary harness `0/non-zero/0`, rerun shared auth/tenant regressions and build, merge packages serially, and only then dispatch independent Lane F on pinned `gpt-5.6-sol`. P1-014 remains incomplete until Lane F confirms every Critical/High row closed.