# Monetization billing audit and release acceptance

> Historical audit snapshot — 9 September 2026, superseded by subsequent implementation. Findings and release criteria below describe the recorded baseline, not a fresh audit of current code. See [billing implementation](BILLING_IMPLEMENTATION.md) for implemented behavior, [pending items](PENDING_ITEMS.md) for later launch status, and the [billing catalog](../src/lib/billing/catalog.ts) for current plan values.

Reviewed: 9 September 2026. Baseline: `27fa151`.

This is a source audit and a release checklist, not evidence that Stripe, a payment gateway, subscriptions or provider credits are enabled in production. No credentials, production database, provider account or live charge was inspected. No prices or commercial terms are established by this document. The overall monetization specification owns those decisions.

## Boundary and ownership

There are three different money flows:

1. **Introify subscriptions:** a payer or team buys platform access and allowances for its workspaces. This requires new billing and entitlement models.
2. **Merchant sales:** a visitor buys a page owner's product, course, event, community or booking. Existing checkout and fulfillment code primarily serves this flow.
3. **3D generation:** a payer buys generation allowance or a batch of work. Current code charges per batch; it does not implement a customer credit wallet.

The planned subscription belongs to a **BillingAccount**, above one or more existing **Workspaces**. It must not be attached directly to an individual User. A User may own multiple billing accounts and belong to many accounts. A user's workspace membership does not automatically confer billing administration privileges. Workspace-to-billing-account association and billing-account roles must be resolved on the server for every billing or credit operation.

Keep the platform's Stripe customer/subscription identifiers separate from `User.stripeConnectAccountId`, which currently represents merchant payout onboarding. Moving a workspace between billing accounts must be an explicit authorized operation with defined treatment of outstanding reservations, credits and subscriptions.

## Existing implementation

| Surface | Source behavior | Implication |
| --- | --- | --- |
| `POST /api/stripe/purchase` | Looks up a merchant product, course, event or community; uses inline prices to create Checkout; can fulfill zero-price items directly. | Merchant sales route, not platform plan checkout. |
| `POST /api/stripe/checkout` | Accepts client `priceId`, product metadata and optional return URLs. | Do not reuse this input contract for plans or credit packs. |
| `POST/GET /api/stripe/connect` | Authenticates the user, creates/loads an Express account and reports onboarding status. | Onboarding exists, but the audited Checkout calls do not route charges to connected accounts or destination transfers. |
| `POST /api/webhooks/stripe` | Verifies the signature; fulfills merchant purchases, bookings and AR batches; contains community cancellation handling. | Primary fulfillment path has incomplete lifecycle and retry handling. |
| `POST /api/stripe/webhook/[uuid]` | Calls a second handler with a different metadata contract; UUID is not used to identify a separate account/secret. | Two overlapping webhook implementations need an explicit canonical contract. |
| `startArCheckout()` | Creates an owned-product batch, then creates a one-time Checkout or follows an unconfigured-Stripe fallback. | Per-batch charging is not a reusable prepaid wallet. |
| `POST /api/image-to-3d` | Requires owned-profile access and applies a durable three-per-hour compute limit. | Separate 3D entry point has a rate limit, not a subscription entitlement or paid-credit debit. |
| `/pricing` | Publishes free early access and says paid plans/card checkout are not currently available. | Future pricing must be kept distinct from currently purchasable offers. |
| `/dashboard/payments` | Lists payments associated with the current profile. | Merchant receipts UI, not billing-account subscription management. |

Relevant source:

- [Stripe configuration helpers](../src/lib/stripe.ts), [environment capability checks](../src/lib/env.ts)
- [Merchant purchase](../src/app/api/stripe/purchase/route.ts), [generic checkout](../src/app/api/stripe/checkout/route.ts), [Connect](../src/app/api/stripe/connect/route.ts)
- [Primary webhook](../src/app/api/webhooks/stripe/route.ts), [secondary webhook handler](../src/lib/webhook-handlers.ts), [purchase fulfillment](../src/lib/members.ts)
- [3D checkout actions](../src/app/actions/ar-builds.ts), [3D batch processing](../src/lib/ar-builds.ts), [3D pricing](../src/lib/ar-price.ts), [image-to-3D handler](../src/app/api/image-to-3d/handler.ts)
- [Pricing page](../src/app/(marketing)/pricing/page.tsx), [payment cards](../src/components/dashboard/payments-list.tsx), [schema](../prisma/schema.prisma)

Stripe configuration currently depends on the secret and public key being present; webhook verification also requires a separate webhook secret. Presence is not proof of successful onboarding, working event delivery or live payment activation.

## Baseline findings and candidate mitigation

### 3D fallback: immediate mitigation implemented

The audited `startArCheckout()` branch treats absent Stripe configuration as permission to mark a batch `PAID`, invoke generation and record a paid money event. It is not guarded as development-only. This permits provider spending without verified payment if the 3D provider is configured.

The immediate change removes this fail-open branch and rejects all new photoreal starts after ownership authentication. Its premium sheet links to coming-soon availability. Seventeen focused tests cover this gate, owner-scoped legacy access, queued local/null reference holds and conditional dispatch claiming. Queued legacy payment references are checked for compatible format only; this is not fresh payment verification. The change does **not** resolve the legacy merchant checkout, webhook, subscription or settlement risks listed here.

The reviewed working-tree candidate now rejects new checkout starts after owner authorization, removes the Pay flow from the sheet, and links to coming-soon plan information. It also holds queued legacy `PAID` rows with missing/`local` references and checks the affected-row count when claiming a provider job. These changes address the immediate new-batch bypass and duplicate-dispatch race described in the baseline below. Test/build acceptance is still required.

The legacy compatibility check recognizes a `cs_`/`pi_` reference shape; it does not verify payment with the provider and can recognize test references. It must not become the authority for future paid entitlements, top-ups or new generation grants. Full payment-state, environment, amount/currency and account reconciliation remains a monetization release requirement. Existing in-flight work and published assets are preserved by this narrow gate.

### Merchant and subscription gaps

- **Annual billing mismatch:** the purchase route creates a monthly recurring price for any community that is not `ONE_TIME`, even when `billingCycle` is `YEARLY`. Fulfillment gives every recurring community 30 days of access.
- **Lifecycle identifiers do not match:** Checkout metadata is not copied into subscription metadata; fulfillment receives `session.payment_intent`, while cancellation tries to find members by `subscription.id`. Subscription renewals, invoice failures and subscription updates are not processed.
- **Webhook retry loss:** the primary webhook catches fulfillment errors and still returns success. A transient database or provider failure can therefore be acknowledged without completing work.
- **No durable Stripe-event deduplication:** signed webhook replay can repeat purchases, payment records and messages. Some enrollment lookup logic reduces duplicate enrollment, but does not make the entire fulfillment operation atomic or idempotent. `Payment.providerPaymentId` is not unique.
- **Payment verification is incomplete:** fulfillment does not reconcile payment status, expected amount/currency, purpose and provider-account context against a durable local purchase intent before granting access or starting work.
- **Metadata contracts diverge:** primary fulfillment expects `itemType/itemId`; the secondary handler expects `type` plus item-specific IDs; generic checkout produces `productType/productId`.
- **Public checkout trust is too broad:** generic checkout accepts client-selected Price IDs and return URLs. Merchant purchase looks up an item but does not consistently enforce the same public/published/active eligibility used by the public catalog.
- **Connect settlement is absent from the audited checkout calls:** creating an Express account does not itself make merchant settlement work. Platform subscription revenue must not be represented as merchant proceeds.
- **Currency accounting is inconsistent:** merchant charging assumes stored amounts are USD for conversion, while fulfillment often writes `USD` regardless of the actual charge currency. Payment cards display a dollar symbol unconditionally.
- **Return origins are derived from request headers in several flows:** billing checkout and receipt links should use an approved configured origin rather than arbitrary client or forwarded-host values.

### 3D accounting and execution gaps

- `ArBuild.credits` describes the provider's generation cost units; it is not a spendable customer balance. No top-up ledger or monthly allowance allocation exists in this path.
- Baseline `startJob()` did not check whether its conditional `PAID` to `RUNNING` update won before calling the external provider. The immediate change now dispatches only when exactly one row was claimed; durable dispatch and ambiguous-outcome reconciliation remain to be implemented.
- `markBatchPaid()` writes a payment-intent value into a field named `stripeSessionId`, weakening the original Checkout-to-batch association.
- Batch work is advanced by browser polling and from webhook fulfillment. There is no durable worker/outbox boundary in this path to isolate payment acknowledgement from long-running generation.
- The batch library contains runtime table-creation logic. New billing, ledger and job state should use tracked schema migrations, not opportunistic request-time DDL.
- Generation failure/retry behavior has no explicit customer-credit reservation, consumption or release policy. Provider credits and customer-visible generation units need distinct names and accounting.

## Recommended incremental design

1. Add BillingAccount, billing-account membership/roles and an explicit Workspace association. Store the Stripe customer and subscription under BillingAccount. Enforce authorized payer/team selection before creating sessions or opening a billing portal.
2. Define a server-owned catalog mapping approved plan, monthly/annual cadence and currency to provider Price IDs. Create a durable local purchase intent before calling the provider. The browser sends an offer identifier, never an amount or arbitrary provider Price ID.
3. Add dedicated platform billing checkout and portal endpoints. Keep merchant purchase routes separate. Use fixed approved return paths and configuration that defaults to purchases disabled until the integration is ready.
4. Establish one canonical billing webhook contract with a durable unique provider-event inbox, transactional entitlement updates and retryable processing. Use an outbox for email or other secondary side effects. Grant access from verified provider state, never from a success URL alone.
5. Track subscription plan, cadence, currency, status, paid-through period and pending cancellation. Handle renewal and failure transitions explicitly, including out-of-order events and reconciliation against current provider state.
6. Add a BillingAccount credit ledger with grant, reserve, consume, release and adjustment entries. Each purchased pack is granted once. Included plan allowance and purchased top-ups remain distinguishable, with explicit expiration and renewal rules.
7. Route both 3D entry points through common entitlement and credit authorization. Reserve allowance atomically before dispatch; claim a job atomically before invoking the provider. Resolve retries and failed generations against the agreed credit policy.
8. Present subscription management separately from merchant receipts. Show the actual annual charge alongside any monthly equivalent. Decide whether an annual subscription receives allowance monthly or annually; do not infer that choice from the billing cadence.

These are architecture recommendations, not authorization to activate a gateway, migrate production, charge a customer or choose commercial terms.

## Release acceptance: platform billing

| ID | Case | Required result |
| --- | --- | --- |
| B01 | Anonymous caller requests Checkout or portal access. | Rejected before any provider request or local billing mutation. |
| B02 | A user supplies another team's BillingAccount or a workspace outside the selected account. | Rejected; ownership is derived from server-side membership. |
| B03 | A user owns two billing accounts and also belongs to a third. | Customer, subscription, invoices and credits stay isolated by account; each operation requires the appropriate billing role. |
| B04 | A client submits a forged Price ID, amount, currency, pack size or return URL. | Input cannot override the server-owned offer or approved destination. |
| B05 | Monthly and annual options are purchased. | Session cadence, actual charged total, stored subscription period and UI disclosure agree. No yearly offer silently creates monthly billing. |
| B06 | A signed completion event has an unexpected amount, currency, purpose, account or unpaid state. | No entitlement or credits granted; discrepancy is recorded for recovery. |
| B07 | The same signed event is delivered repeatedly or concurrently. | One entitlement/credit effect and one logical notification; duplicate deliveries receive an appropriate acknowledgement. |
| B08 | Fulfillment fails after event receipt, or the process crashes between state changes. | Durable retry/recovery completes the work without lost payment or duplicate grants. Failure is not silently acknowledged as completed. |
| B09 | Renewal succeeds, payment fails, cancellation is scheduled, cancellation takes effect, or subscription state changes out of order. | Access and allowance follow the documented paid-through/grace policy and current verified subscription state. |
| B10 | A browser opens or fabricates a success URL without a verified event. | UI may report pending confirmation; it cannot activate a plan or grant credits. |
| B11 | A plan is changed or a workspace moves between billing accounts. | Authorized transition with defined subscription, allowance and in-flight reservation handling; no duplicate or orphaned balance. |
| B12 | Provider configuration or plan mapping is missing, invalid or in the wrong environment. | Checkout stays unavailable without collecting money or claiming activation. Existing free access follows its explicitly defined policy. |
| B13 | A non-USD charge is completed or refunded. | Provider amount/currency, durable records, receipts and displayed totals remain consistent in minor units. |
| B14 | The deployment receives merchant events and platform-subscription events. | Purpose/account routing prevents merchant fulfillment from changing platform entitlements or platform receipts from becoming merchant payouts. |

## Release acceptance: 3D gate and credit spending

| ID | Case | Required result |
| --- | --- | --- |
| G01 | Generation is disabled, payment configuration is absent, or the paid generation path is not released. | Fail before batch/payment writes and before provider work. Never mark a request paid solely because Stripe is missing. |
| G02 | Quote/list/status UI is opened while new paid generation is disabled. | Quote/list actions remain read-only. Owner-scoped polling may advance an existing genuinely paid/in-flight batch under the release policy, but must not elevate a draft or unpaid batch into provider work. Legacy rows marked paid by the old `local` fallback need explicit treatment before they are considered verified payments. |
| G03 | A caller has no billing permission, uses another account/workspace/product, or has insufficient allowance. | No reservation or provider call; the response does not disclose another account's balance. |
| G04 | Two requests attempt to spend the final available generation unit concurrently. | At most one valid reservation succeeds; balance cannot become negative. |
| G05 | A top-up payment event is retried, reordered or delivered concurrently. | Exactly one ledger grant for the purchased pack, with amount/currency and owner verified. |
| G06 | A job is polled, retried or claimed by two workers concurrently. | One logical generation consumes one reservation and starts at most one provider task unless an explicit retry policy authorizes another attempt. |
| G07 | Provider creation fails, times out ambiguously, finishes unsuccessfully, or artifact persistence fails. | Job and reservation enter a recoverable state; the documented consume/release/refund rule is applied once. |
| G08 | The process crashes after reservation, after provider creation, or before recording the provider task ID. | Reconciliation does not strand balance or blindly duplicate paid provider work. |
| G09 | A Checkout session is completed for one batch but metadata names another batch or account. | No batch is released; stored purchase intent and provider identifiers must agree. |
| G10 | A user calls the older `/api/image-to-3d` endpoint to bypass the paid batch UI. | The same intended account entitlement policy applies; rate limiting alone is not accepted as credit enforcement. |
| G11 | Included allowance renews while top-up balance or in-flight reservations exist. | Renewal is applied once; expiration and spending order follow explicit rules without erasing unrelated purchased balance. |
| G12 | A plan expires, a user loses billing membership, or a workspace changes payer during generation. | Existing reservations and artifact ownership follow a defined policy; new spending is authorized against current account state. |

The immediate gate change can satisfy G01/G02 and related owner-isolation cases without implementing the full future ledger. Remaining cases are release gates for subscriptions, top-ups and metered generation, not a claim that those features already exist.

## Evidence and review procedure

- Use isolated local tests with fake provider dependencies and an ephemeral or mocked database. Do not read production secrets or call real payment/generation providers for automated checks.
- Exercise actual server boundaries and durable state transitions; UI-only tests or source-text scans do not prove billing enforcement.
- Include retry, concurrency and intentional refusal cases. Verify that rejected requests do not create batches, money events, grants or external calls.
- Validate the final schema and TypeScript/production build in the disposable validation environment. Apply production migrations and enable paid offers only as part of the separately authorized release workflow.
- Keep the two baseline untracked local handoff/helper files out of this work. This audit document does not authorize editing or committing them.
