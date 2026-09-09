# Introify plans and billing

Implementation dated 9 September 2026. The owner authorized the Free plan and the four paid tiers across the application and landing pages. `src/lib/billing/catalog.ts` is the source of truth; earlier monetization proposal documents are historical design notes.

| Plan | Monthly | Annual, paid upfront | AI credits/month | Photoreal generations | Businesses | Seats |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Free | $0 | — | 50 | One verified-user trial, once | 1 | 1 |
| Starter | $10 | $108 | 500 | 3/month | 1 | 1 |
| Pro | $20 | $216 | 1,500 | 10/month | 1 | 3 |
| Business | $40 | $432 | 4,000 | 20/month | 3 | 5 |
| Scale | $100 | $1,080 | 10,000 | 50/month | 10 | 15 |

Annual billing saves 10%. Paid allowances refresh monthly on the original UTC anniversary; end-of-month and leap-year anchors do not drift. Annual payment does not issue a year's usage at once. Canceling renewal preserves confirmed paid access until paid-through, then purchased balances pause on Free.

Fast costs 1 AI credit per bounded reply, Smart 20, Reasoning 40. Free has Fast, Starter adds Smart, Pro and above add Reasoning. One successful standard photoreal model costs one separate generation unit. AI credits and model units are never interchangeable. Packs: 1,000 AI credits/$7; 10 3D/$19; 50 3D/$89; 100 3D/$169. Packs require a paid plan and do not auto-renew or auto-refill.

Starter adds custom page styles, assistant instructions and optional removal of Introify's footer. Business names, photos and logos remain available on Free. Pro adds staff access, consented private visitor notes and the 30-day trend/source/funnel reports; basic KPI totals remain available on Free and Starter. Custom domains, automation workflows, consolidated reports and the platform API are explicitly planned, not enabled paid benefits.

## Application surfaces

- Homepage, public pricing, signup/onboarding copy and SEO use the shared catalog.
- `/dashboard/billing` shows account selection, confirmed plan, shared balances, reservations, limits, provider availability and plan/pack checkout. Invoices and payment management require an owner or billing administrator.
- `/dashboard/team` supplies business switching, individual staff roles and private, expiring invitation links. Billing administration does not grant business content access. The same person across several businesses consumes one seat; pending invitations reserve a seat without duplicates.
- AI requests, imports and generation are checked on the server before provider dispatch. Disabled integrations return unavailable states without inventing a payment or consuming a trial.
- Resource limits cover published offerings across products, services, courses, events, communities and lead magnets; knowledge sources/characters; and stored upload derivatives. Counts and writes share an account lock and transaction.
- `/admin/billing` shows subscriptions, retrying payment events, held generations and accounts requiring reconciliation.

## Accounting and provider lifecycle

`BillingAccount` is the payer. Profiles and business workspaces retain separate permissions and data. `PlatformSubscription` is separate from merchant community/customer orders. Existing data and collaborators are backfilled by the additive migration. Existing over-limit data is retained; the release restricts positive resource growth instead of deleting records or revoking legacy collaborators. A subsequent business/seat archival policy needs an explicit customer-facing migration if stricter downgrade behavior is desired.

`BillingCreditGrant`, `BillingReservation` and `BillingLedgerEntry` provide an auditable reserve/consume/release flow. Account locks serialize concurrent tabs and staff. Request keys are idempotent; a repeated accepted key cannot dispatch a second provider call. Expiring monthly units are allocated first, then purchased units. A proven technical failure releases once; an expired monthly reservation receives a seven-day replacement. Unknown provider outcomes keep the reservation for review.

Free trial claims are unique per verified account owner across their billing accounts. A successful paid activation absorbs unused Free trial eligibility. Trial issuance has a configurable daily platform cap, and claiming plus reserving plus queue creation roll back together if the request cannot complete.

Stripe Checkout creates subscriptions and packs from fixed server-owned USD prices. The Stripe portal displays and confirms price changes, invoices prorated upgrades, and schedules decreasing-price or shorter-interval changes at renewal. Quantity is fixed at one base subscription. Checkout return URLs do not grant access. Pending or uncertain earlier checkouts are reconciled before another base subscription can start.

`/api/billing/webhook` verifies its dedicated signature and live/test environment, writes a durable event inbox, then reconciles canonical provider records. Paid invoices determine paid-through and plan access; an unpaid upgrade does not unlock a new plan. Retired subscription events cannot overwrite a newer paid purchase. Reversals place an account on hold before fulfillment, revoke unspent pack units and retain history. PaymentIntent-backed payments are supported; direct-charge/manual out-of-band invoices are not an activation path.

The Node worker starts through Next instrumentation only when `INTROIFY_WORKER_ENABLED=true`. It retries durable payment events and drives 3D jobs without browser polling. Database leases make multiple processes safe. An uncertain 3D POST is never retried; a known supplier task is polled and downloaded again without another purchase. Delivered assets and all generated derivatives are persisted and counted in storage before the unit is consumed.

## Configuration and launch

Use `.env.example` and [the pending launch items](./BILLING_LAUNCH_CHECKLIST.md). No real key belongs in source control. Published AI uses an API key and an approved model mapping, never personal Codex authentication. The separate AI implementation note documents provider-specific output bounds and privacy behavior.

Enable the worker only on a persistent Node process with durable PostgreSQL and upload storage. Serverless request-only hosting needs an external durable worker/queue before generation is enabled. Provider timeouts and account holds require an operator reconciliation procedure; the admin view exposes them but does not guess an outcome or issue automatic refunds.

For validation, use an isolated loopback PostgreSQL test database and dummy providers. Never run `build:hostinger` as a local build check: it applies database migrations. Use `prisma generate`, TypeScript, tests and a Node 20 Next build separately.

Provider references: [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [pending subscription updates](https://docs.stripe.com/billing/subscriptions/pending-updates), [subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules).
