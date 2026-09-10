# Introify monetization proposal and implementation specification

> Historical design snapshot — 9 September 2026, superseded by subsequent implementation. Statements below about existing code, proposed work and pending decisions describe that baseline. See [billing implementation](BILLING_IMPLEMENTATION.md) for implemented behavior, [pending items](PENDING_ITEMS.md) for later launch status, and the [billing catalog](../src/lib/billing/catalog.ts) for current plan values.

Prepared 9 September 2026. Prices and limits below are recommendations for owner review, not an active paid offer. No live subscription products, customer charges, database migrations or credit grants are created by this document. The immediate code change locks new photoreal generation behind a premium coming-soon notice and removes the missing-Stripe payment bypass. Existing owner-scoped batch status and published models are preserved.

Delivery status: implementation changes are local and have not been deployed. Validation passed 24 focused tests (17 generation/access tests plus seven SEO tests), targeted lint for the gate changes, and a Node 20 production build with TypeScript in a disposable workspace using dummy services. Database concurrency is covered by mocked claim tests here, not a live PostgreSQL billing-ledger test. Automatic approval review blocked starting the local visual-preview server; no browser visual check was completed for this change.

## Recommended offer — revised Free and AI access

The owner has confirmed that Free should include one trial photoreal generation and limited chats, and that paid tiers need differentiated AI model access and broader business capabilities. The expanded, costed AI rules are in [Free, AI and model entitlements](./monetization-ai-and-free.md). These replace the earlier proposal to give Free no generation allowance or to sell all AI access separately.

Sell the business platform as the subscription; sell expensive generation usage as a metered benefit and optional add-on. A subscription belongs to one **billing account**, which can pay for several isolated business workspaces. Every staff member signs in independently. Business count, staff seats and generation credits are separate limits.

| Plan | Monthly | Annual total paid upfront | Effective monthly | Active businesses | Staff seats, including owner | Standard photoreal generations |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Free | $0 | — | — | 1 | 1 | 1 trial generation, once |
| Starter | $10 | $108 | $9 | 1 | 1 | 3 per month (revised recommendation) |
| Pro | $20 | $216 | $18 | 1 | 3 | 10 per month |
| Business | $40 | $432 | $36 | 3 | 5 | 20 per month |
| Scale | $100 | $1,080 | $90 | 10 | 15 | 50 per month |

Annual billing saves 10%. Always display the annual amount charged prominently; the effective monthly number is a comparison, not a monthly payment. Generation windows remain monthly on both cadences. For example, annual Pro receives 10 at activation and 10 at each monthly anniversary, not 120 on day one.

Free's one trial generation is a genuine, once-only allowance, available after verified email and an eligible completed business profile; no payment card required. Grant it atomically on the first eligible request, preserving redemption history across business creation, subscription changes and account recovery. Technical failure restores that same unit. Downloading or continuing to display the successfully generated model does not consume it again. Do not award the trial separately to every workspace or after cancellation. See the linked AI/Free specification for abuse controls and launch requirements.

I recommend changing Starter from three once-only welcome generations to three every month, now that Free includes a real trial. That gives the $10 plan recurring value. This is a recommendation pending owner confirmation, not a silent change to an existing purchase. On upgrade, unused Free trial eligibility is absorbed into the paid plan; it cannot stack as an extra credit or be redeemed later by downgrading. A paid customer does not receive a new Free trial after cancellation. Remove the old paid WELCOME grant rule before implementation.

The Free limits describe the proposed launch offer, not limits to impose retroactively on current early-access users without migration and notice. Free customers can continue using their existing published models; viewing an asset does not consume a generation.

### What each plan should unlock

All paid plans should include profile editing, share links and QR codes, the relevant offering types, basic bookings/orders and essential security. Do not gate account deletion, billing cancellation, data export or security settings behind a higher price.

| Capability | Free | Starter | Pro | Business | Scale |
| --- | --- | --- | --- | --- | --- |
| Positioning | Launch and try the assistant | Look professional | Convert more enquiries | Run several businesses | Manage a group or agency |
| Monthly AI credits | 50 | 500 | 1,500 | 4,000 | 10,000 |
| AI model access | Fast | Fast + Smart | Fast + Smart + Reasoning | Pro models + approved document workflows | Business models + batch workflows and routing controls |
| Branding | Introify-branded page | Remove promotional branding, full brand styles | Starter + custom domain | One custom domain per included business | One per included business |
| Publishing allowance | 10 active offerings | 100 total | 500 total | 1,500 total | 5,000 total |
| Knowledge sources / extracted text | 5 / 50k characters | 20 / 200k | 100 / 1m | 300 / 3m | 1,000 / 10m |
| Assistant setup | Profile/FAQ answers, presets | Custom tone, instructions and lead questions | Structured qualification, optional visitor memory | Per-business knowledge and routing | Reusable templates and controlled rollout across businesses |
| Enquiries and bookings | Contact capture and basic forms | Lead inbox, tags and manual follow-up | Segments, assignment and follow-up rules | Shared team inboxes and business-level routing | Group oversight and client access |
| Automation proposal | Manual | Manual | 5 rules / 250 runs per month | 20 rules / 1,000 runs | 50 rules / 3,000 runs |
| Reporting | Views and enquiries, 7-day charts | 30-day reports and source tracking | 12-month conversion reports and CSV analysis | Cross-business summary, 24-month reports | Cross-business summary, 36-month reports |
| Team access | Owner | Owner | Owner + two colleagues | Shared team, per-business roles | Shared team, client-specific access |
| 3D workflow | One successful trial | Monthly allowance and packs | Monthly allowance and packs | Bulk queue and business spend caps | Larger bulk queue and approval controls |
| Initial storage budget | 500 MB | 1 GB | 5 GB | 15 GB | 50 GB |
| Initial monthly delivery budget | 5 GB | 10 GB | 50 GB | 150 GB | 500 GB |
| Support target | Help centre and issue reporting | Email | Email with higher queue priority | Priority support | Priority support with onboarding session |

These are proposed product entitlements, not claims that all capabilities are implemented. Custom domains, reporting retention filters, aggregate limits, billing roles, bulk queues, and some team dashboard paths need implementation. Audit logs and critical incident help should remain available across paid plans. Do not promise a response-time SLA or white-label resale until staffing and capabilities exist.

An offering is a published product, service, course, event or menu item, not each variant, lesson or order. Drafts use storage but not publishing quota. Confirm the cross-type counting rules before enforcement. Completed orders/bookings and existing customer access must not disappear when a publishing limit is reached.

Storage includes sources and all model derivatives/backups attributable to an account; generation count does not guarantee unlimited storage or bandwidth. Warn at 80% and 100%. At the limit, block new uploads/jobs; avoid breaking existing paid storefronts immediately. At sustained high delivery usage, use a disclosed grace allowance and an opt-in delivery add-on or plan upgrade. Abuse/attack traffic should be handled separately. Measure actual costs before activating these budgets.

AI is included in every proposed tier, using the credit allowances above: a bounded Fast reply costs 1 credit, Smart 20, and Reasoning 40. Therefore 50 Free credits can provide up to 50 Fast replies; a ten-turn conversation consumes ten, not one. These are initial model-recipe weights, not unlimited-length promises. Larger contexts and paid tools require an explicit higher quote. Account-wide limits are pooled, with owner preview and public visitor use visibly separated. See the linked AI specification for cost caps, quotas, tool calls and model routing. AI is not currently publicly active; do not market these allowances as enabled before release.

SMS/WhatsApp and voice need separate balances and country/template-sensitive quotes; do not exchange them implicitly with AI or 3D credits. Transactional billing receipts do not spend the customer's marketing-message balance. A workflow run counts one accepted rule execution, not every retry; any AI step reserves its displayed AI credits and any paid message reserves its own balance. Do not advertise unlimited workflows, agent steps or messages.

### Extra generation packs

Proposed starting points, conditional on measured unit economics:

| Pack | One-time price | Price per standard generation |
| --- | ---: | ---: |
| 10 | $19 | $1.90 |
| 50 | $89 | $1.78 |
| 100 | $169 | $1.69 |

Packs do not renew automatically and do not create another subscription. Require an active paid plan to buy or use new-generation packs. Purchased units do not expire while the account exists, including during cancellation; they pause when the account is Free and resume on reactivation. This dependency must be explicit at purchase, and account deletion/refund terms must be settled before sale. A later optional standalone 3D offer could remove the subscription requirement with its own storage/hosting price; do not mix the two offers silently.

Monthly included credits expire at their generation-window boundary with no rollover. Spend eligible expiring monthly units first, then purchased units, unless an existing reservation already owns specific units. The Free trial is its own single-use grant type and is not fungible with paid packs or AI credits. Top-ups are pooled across businesses. No automatic overage charge or automatic purchase by default. If auto-refill is introduced later, require billing-owner opt-in, a per-purchase amount and a monthly spend cap.

One generation means one successfully delivered standard textured model from a submitted source. GLB plus its normal AR/USDZ derivatives are one generation, not separate purchases. A download, embed, camera rotation or existing-model view costs no new generation. User-requested regeneration with a new attempt is a new generation. Technical failure returns the reserved unit; subjective dissatisfaction goes through a separately disclosed support policy, not an unlimited free regeneration loop. Do not promise a guaranteed exact replica from one image.

## Costs and margin checks

The current code assumes 30 provider credits per model, a default cost of two US cents per provider credit, and a 3x markup: estimated **$0.60 cost / $1.80 charge per model**. These are code defaults, not a verified account-specific supplier quote. `MESHY_CREDIT_USD_CENTS` also rounds fractional cents; replace this with precise micro-dollar accounting before using it for production margin decisions. `ai_model: "latest"` leaves quality/cost subject to provider changes; pin a verified model and quality recipe when selling a fixed unit.

The current official API table lists 30 credits for a textured Meshy-6 or Meshy-7 image-to-3D call, with extra cost for 8K/Ultra options. Do not apply the consumer web-app credit economics to the API without checking the account's API purchase terms. Source: [Meshy API pricing](https://docs.meshy.ai/en/api/pricing), checked 9 September 2026.

Budget using total delivered-model cost: actual API credits, paid retries, source processing, conversion/optimization compute, storage/delivery allocation and a support allowance. Payment fees, FX, chargebacks and tax obligations also reduce the money available. Do not treat a 3x markup as a 300% profit margin.

| Plan | Annual effective revenue/month | Included models/month | Supplier cost at the code's $0.60 assumption | Cost at an illustrative $0.80 delivered-model budget |
| --- | ---: | ---: | ---: | ---: |
| Pro | $18 | 10 | $6 | $8 |
| Business | $36 | 20 | $12 | $16 |
| Scale | $90 | 50 | $30 | $40 |

The $0.80 figure is a planning assumption, not a vendor price. At full usage, generation alone uses about 44% of annual-plan revenue under that assumption. These tiers can be viable, but they leave less room for unlimited AI, storage or human support. Measure actual usage before increasing included allowances. Avoid 100 included models on the $100 plan at launch: under the same assumption that spends $80 of $90 effective monthly revenue before the rest of the platform.

For the proposed 100-pack at $169, modeled generation cost is $60 at $0.60/model, $80 at $0.80/model, or $120 at $1.20/model. Contribution before payment fees and other unallocated costs is respectively $109, $89 or $49. Price floor formula: `(pack generation cost + allocated fixed transaction costs) / (1 - variable payment fee rate - target contribution margin)`, using revenue net of any included taxes. Do not activate packs until a real invoice and representative successful/failed tasks validate the assumptions.

## One payer, multiple businesses and separate logins

Example: Maya buys Business for $40, creates a cafe, a furniture shop and a consulting practice. She is the billing owner. Four colleagues can join within the five-seat total. Someone helping in two businesses consumes one seat across this billing account. Cafe staff cannot see furniture orders. The account receives 20 included generations total, and Maya can cap the cafe at five per window. A 100-pack adds 100 shared units; it does not add 100 to each business.

Reuse `Workspace` as the business boundary and `Membership` for business roles; do not introduce a duplicate business entity. Add `BillingAccount` above workspaces, and separate billing roles from operational roles. A billing administrator may pay invoices without seeing every business's customer data. A business administrator does not automatically gain permission to buy packs, change subscription or transfer ownership. All generation requests require both workspace permission and billing entitlement.

Count distinct active BillingAccountMember users, including owners, billing-only administrators and viewers, toward the seat limit, even when they have no workspace assignment. Count an outstanding invitation as a reserved seat until accepted, revoked or expired; deduplicate inviting the same verified email to several businesses in that billing account. Business customers, visitors, course students and community members are not staff seats. Do not add a free 'guest' role that silently allows unlimited internal staff; external client viewers can be designed as a separate, deliberately limited feature later.

One user can own or belong to multiple billing accounts. Separate legal payers need separate billing accounts and invoices even when one person administers them. Paying for a group subscription does not pool the businesses' sales proceeds or replace their separate merchant onboarding/KYC and tax settings. Agency clients can have independent workspaces while an agency pays; if a client takes over billing, use an explicit transfer flow.

The repository already contains workspaces and memberships, but much of the dashboard resolves `user.profiles[0]`. Invited users cannot be assumed to have a full working dashboard yet. Replace that assumption with an explicit, server-validated active-workspace context. See [account migration design](./monetization-account-migration.md).

## Data model and boundaries to implement

| Entity | Purpose and required constraints |
| --- | --- |
| BillingAccount | Payer, currency, billing owner, commercial identity, status; linked to multiple workspaces |
| BillingAccountMember | Unique account/user; OWNER, BILLING_ADMIN or MEMBER role; does not itself grant business-data access |
| Workspace billing link | Exactly one current payer; transfers recorded historically rather than rewriting old financial records |
| Invitation | Hashed single-use token, normalized email, roles, expiry, seat reservation; transactional acceptance |
| PlanVersion / PriceVersion | Immutable approved limits and integer minor-unit prices; cadence/currency/provider mappings; effective dates |
| PlatformSubscription | Provider/account/environment IDs, plan version, status, service paid-through, billing period, cancellation and pending change; one effective base subscription per account |
| CheckoutAttempt | Server-owned expected purchase, currency, price version, account, idempotency key, provider session; no client-controlled amount |
| BillingEventInbox | Unique provider + merchant account + environment + event ID; payload reference/hash, attempts, processed state and reconciliation status |
| PlatformInvoice / PlatformPayment | Immutable provider references, amount, currency, settlement/refund state and legal billing snapshot |
| CreditGrant | Kind (FREE_TRIAL, MONTHLY, PACK, ADJUSTMENT), account, explicit unit type (AI_CREDIT or PHOTOREAL_GENERATION), integer units, verified payment or authorized promotional source, validity and original plan/recipe version |
| CreditLedgerEntry | Append-only grant/reserve/consume/release/expire/reverse record with unique business operation key |
| CreditReservation | Unique job/operation; allocated grant IDs and quantities, state, creation/deadline; transactional balance checks |
| GenerationJob | Account/workspace/product/requester, source hash, pinned recipe, reservation, vendor task, actual costs, delivery state and historical payer |
| JobOutbox / WorkerLease | Durable dispatch and retry state; compare-and-set claiming, heartbeat, reconciliation and spend limits |
| AuditEvent | Billing changes, invites, role changes, transfers, adjustments and abuse decisions; actor and reason |

Do not reuse merchant `Member`, community subscriptions, inventory credits, `User.stripeConnectAccountId` or `ArBuild.credits` as platform subscription state. In the old 3D table, credits are provider cost units, not customer generation units. Keep both measures with explicit names. Retain legacy paid batches under their original purchase contract; never retroactively debit the new wallet for them. Review historical `stripeSessionId = 'local'` records before treating them as genuinely paid revenue.

Money is integer minor units with a stored currency; supplier costs may need micro-units for fractional cents. Never silently recompute a subscription invoice using the current USD/INR display conversion or the visitor's language. Publish separate fixed USD/INR price versions; obtain the actual billing country and show currency/tax treatment before payment. Provider customer IDs and webhook IDs must be scoped to provider, merchant account and test/live environment.

## Subscription and generation flows

**Checkout:** authenticated billing owner chooses a catalog plan/cadence/currency → server checks permissions, existing subscription and approved catalog ID → create durable CheckoutAttempt → create provider session with an idempotency key and fixed return URLs → signed payment events reconcile the expected purchase → transaction persists payment, subscription and exactly one initial grant. The success page only reads server state. It must never activate access because `?success=true` is present.

**Renewal:** settled invoice maps to the correct account/period → update paid-through and enqueue due generation window → unique `(subscription, allowance-window, grant-kind)` prevents duplicate units. Annual subscriptions have a scheduler that issues each due monthly grant only while covered by the paid annual term. Use anniversary calendar arithmetic in UTC with end-of-month clamping, preserve the original anchor, and support leap years. A delayed scheduler must not bank already-expired missed windows.

**Generate:** authenticate → resolve business role and current payer → check paid coverage or an authorized unused Free-trial grant, account/business caps, source validity, storage, provider health and spend budget → in a serializable transaction lock the account/buckets and reserve one unit plus create job/outbox → worker claims job once → dispatch provider task → persist vendor ID and reconcile → download, validate and persist required outputs → atomically consume the reservation and mark READY → expose URLs. Notifications happen through an outbox after commit.

Reserve a whole selected batch atomically if affordable; otherwise show exactly how many items fit and request an explicit smaller selection or pack purchase. Do not silently submit half a batch. Once accepted, each item settles independently. Enforce the same reservation service in UI actions, APIs, bulk imports and admin job tools. Basic approximate 3D generation can remain a separate, explicitly named feature with its own budget; it must never silently fall back to paid photoreal generation.

Start with one concurrent provider job for Starter, two for Pro, three for Business and five for Scale, bounded further by global supplier capacity. A 100-pack is an allowance, not permission to start 100 simultaneous vendor jobs. Queue limits, hourly spend ceilings and a global kill switch prevent one account exhausting supplier funds.

Vendor request timeout after acceptance is an **unknown outcome**, not proof of failure. Keep the reservation held, reconcile task identity, and retry only with supported idempotency or a proven no-task result. If there is no safe reconciliation mechanism, move to manual review instead of issuing another potentially paid request. A successful vendor task whose download/conversion failed must retry delivery of the same asset, not buy a new generation.

Standard API assets may be retained by Meshy for only three days outside Enterprise; persist outputs in Introify-controlled durable storage promptly. Do not depend on a customer's browser staying open to poll. Source: [Meshy asset retention](https://docs.meshy.ai/en/api/asset-retention), checked 9 September 2026.

## Edge-case decisions

| Situation | Recommended behavior |
| --- | --- |
| Two tabs spend the final unit | Transactional reservation lets only one succeed; retry conflicts safely |
| Double click or retried HTTP request | Same account/request key returns the same job; conflicting payload under that key is rejected |
| Credit expires while a job runs | Reserved unit remains attached to that job; no double expiry/debit |
| Technical failure after the window closes | Release purchase credit to its bucket; for expired included credit, create a single replacement usable for seven days, with an immutable link preventing repeat grants |
| Customer cancels while queued/running | Before vendor dispatch, release reservation; after dispatch, finish/reconcile. Do not promise cancellation of supplier work already started |
| Product/image deleted or edited during generation | Use captured source/version; persist result in the account asset library, and attach to the product only if its expected version still matches |
| Duplicate/out-of-order payment events | Durable inbox plus unique payment/grant keys; fetch authoritative provider state where needed; old events never overwrite a newer effective entitlement |
| App fails while handling a webhook | Acknowledge only after durable inbox storage. Retry processing; reconciliation repairs missing events. Do not swallow fulfillment failures as completed |
| Checkout completed but payment pending | Show pending; no grants or paid access until settled payment is verified |
| Missing keys, vendor funds or billing state | Fail closed before generation and before accepting a new sale; no pretend PAID records |
| Upgrade mid-month | Quote proration first; after successful payment, grant only the positive quota difference proportional to remaining allowance-window time, once per change. Keep used units and the current anchor |
| Upgrade then downgrade then upgrade | Track granted quota adjustments for the same window/version transition; do not mint a fresh allowance on each switch. Downgrades take effect at period end |
| Annual upgrade | Prorate remaining paid term through provider-supported rules; apply future monthly quotas at their anchors and a single bounded adjustment for the current window |
| Monthly/yearly cadence change | Initially schedule at paid term end to avoid overlapping charges and reset abuse; show date/amount and preserve current allowance window |
| Downgrade above business/seat/storage limit | Give advance notice and let owner choose active businesses/users. Freeze excess editing/new usage after a disclosed grace period; preserve data, existing purchases and exports. Never silently delete businesses |
| Cancellation | End renewal immediately, retain paid access and scheduled monthly allowance grants through the paid-through date, then Free; stop grants after paid-through. Keep pack units paused and downloadable assets available under published retention rules |
| Renewal payment fails or mandate revoked | No new paid generation grant. Disclosed seven-day grace for existing storefront/editing; new paid vendor calls paused. Retry according to provider policy, then restrict account |
| Partial refund | Reverse unused units attributable to refunded grant/payment, without rewriting history. Handle consumed units under the agreed refund policy and show a transparent calculation |
| Chargeback after units consumed | Suspend new paid operations, retain evidence and ledger, reverse unspent units. Track recoverable loss; no silent charge to another card or destructive data deletion |
| Coupon, gifted access or fully discounted invoice | Grant only benefits explicitly authorized for that promotion. The explicit once-only Free trial is an authorized exception to paid generation; zero-payment promotions never implicitly create fresh trial eligibility |
| Several subscriptions accidentally created | Serialize purchase changes; reject duplicate active base subscriptions and reconcile orphan sessions/refunds, never sum base allowances |
| Repeated Free trial claims | Tie redemption to durable verified-user/account history; use risk checks and aggregate trial budgets. Never use IP alone to accuse shared networks of abuse. New businesses, account recovery and cancel/resubscribe do not reset eligibility |
| Invite accepted at the seat limit | Reserve/claim seats transactionally; expired/revoked invitations release reservation; re-invite does not duplicate it |
| Staff works in three businesses | One seat within the same billing account; business role permissions remain independent |
| Staff removed or role downgraded | Recheck authorization on every server mutation; cancel pending unsubmitted jobs if required, finish owned paid jobs safely; actor remains in audit history |
| Billing owner leaves | Require accepted ownership transfer and recent authentication first. At least one owner must remain; never let ordinary business admins take billing control |
| Business transferred to another payer | Require both sides' permission, destination capacity and a job drain/settlement check. Keep invoices, credits and historical usage with original payer; assets and business data move under an explicit transfer scope |
| Two billing accounts merge | Reconcile subscriptions and unused prepaid value explicitly; no automatic duplicate trials/quotas or customer-data sharing |
| Business archived then recreated | Active business count can change, but trial-redemption history, jobs, storage and consumed credits are not reset |
| Subscription payer differs from merchant owner | Subscription invoice uses payer identity; customer-order payments use the merchant's own settlement account |
| Account deleted | Offer export, cancel renewals, reconcile outstanding work and apply published prepaid-credit/refund policy; retain financial records only under an established retention policy |
| Higher quality/model introduced | Version the recipe and quote a clear unit multiplier or separate SKU; never silently increase debit for existing standard units |
| Supplier changes prices | Stop unprofitable new sales if needed, measure impact, publish new future price/plan versions with notice; preserve already-purchased benefits unless terms provide an agreed alternative |
| Manual support correction | Authorized admin records compensating ledger entries with reason/ticket; no direct balance edits or hidden unlimited bypass |

## Payment provider choice

For an India-based founder without an incorporated company, investigate Razorpay onboarding first. Its docs provide an Individual/Unregistered path and KYC requirements; approval and activation of subscriptions/international methods still depend on the account. Incorporation and gateway eligibility are different questions. [Razorpay account setup](https://razorpay.com/docs/payments/set-up/?preferred-country=IN), [KYC requirements](https://razorpay.com/docs/payments/business-types-kyc-documents/?preferred-country=IN).

Razorpay documents recurring cards, eMandate and UPI Autopay. Actual methods/limits must be checked on the enabled merchant account. In particular, large annual bills can exceed ordinary UPI mandate limits; present eligible card/eMandate or another approved payment method instead of promising every cadence works over UPI. [Supported banks and apps](https://razorpay.com/docs/payments/subscriptions/supported-banks-apps/?preferred-country=IN).

Stripe is already in the repository, but its India onboarding is invite-only. Its international-payment guidance requires a registered Indian business, which can include a sole proprietorship, and excludes an individual account. Do not assume a test integration means Introify can collect live international subscriptions. [Stripe India requirements](https://docs.stripe.com/india-accept-international-payments).

Build a small provider adapter (`createCheckout`, `fetchSubscription`, `changePlan`, `cancelRenewal`, `refund`, `verifyEvent`) over the shared internal ledger; implement and test one enabled provider first. Provider-neutral domain records are useful, but building two complete gateways at once is unnecessary. Merchant payouts/Connect remain separate from collecting Introify subscription fees.

Stripe documents invoice-driven subscription updates, signed events and subscription change behavior; use the chosen provider's equivalent lifecycle and authoritative paid state. [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [webhook delivery](https://docs.stripe.com/webhooks), [subscription changes](https://docs.stripe.com/billing/subscriptions/change-price).

## Build order and release criteria

1. **Immediate premium gate:** block new photoreal starts on the server and replace per-batch Pay UI with an honest premium availability notice. Remove the missing-Stripe bypass. Preserve published models and owned legacy batch visibility. No real purchases enabled.
2. **Account foundation:** add billing accounts, workspace payer links, memberships/invitations and active-workspace context; backfill with audited, repeatable migrations. Keep early-access rights until chosen migration date. Test isolation across business, payer and role boundaries.
3. **Credit foundation:** database ledger/reservations plus durable job worker and outbox. Fix duplicate vendor dispatch, task reconciliation and delivery retry before assigning valuable credits. Dry-run grants in test data only.
4. **One gateway in sandbox:** catalog versions, checkout, invoices, cancellation/changes, event inbox, signed webhooks and reconciliation. Run monthly/yearly renewal, duplicate/late-event, refund and failed-payment tests; never use a success redirect to fulfill.
5. **Billing UI:** plan comparison, cadence selector, invoice list, next payment date, usage by business, per-business caps, packs, seat invitations and explicit upgrade/refund disclosures. UI reads the same server catalog and entitlement service as the API.
6. **Limited live release:** completed operator details and provider onboarding, approved prices/costs, monitoring/budget alarms, support runbook and refunds process. Roll out to selected accounts with a kill switch, then expand after measured reconciliation and costs are stable.

Acceptance tests must use real PostgreSQL transactions for race cases, not just mocked sequential balance arithmetic: simultaneous last-credit jobs; duplicate grant sources; concurrent invitation acceptance; annual month-end/leap-year grants; worker crash around dispatch; ambiguous vendor timeout; failure after expiry; partial batch delivery; stale role access; forged account/price IDs; missing and replayed payment events; canceled annual subscription; failed proration; pack pause/reactivation; and transferred business history. Validate the hosted worker and scheduler actually keep running independently of web requests.

The existing merchant billing defects and detailed migration risks are recorded in [billing audit](./monetization-billing-audit.md) and [account migration](./monetization-account-migration.md). Those remaining flows are not made production-ready by the premium gate.

## Pending owner decisions and external requirements

- [x] Free includes one successful trial photoreal generation and limited monthly AI use, with stronger models in paid tiers (owner direction).
- [ ] Confirm the revised recommendation that Starter includes three generations every month, replacing the earlier once-only allowance.
- [ ] Approve monthly AI credits, model-class weights, knowledge quotas and automation limits in the revised table; validate actual combined costs before selling them.
- [ ] Approve tier names, business/seat limits, 10% annual discount and 10/20/50 recurring generations.
- [ ] Verify real API credit purchase cost, supplier licensing/commercial output terms, pinned model recipe and representative delivery/failure costs.
- [ ] Approve pack prices, no-expiry/active-plan requirement, Free-trial eligibility and technical-failure replacement rules.
- [ ] Choose gateway after confirming account eligibility, recurring methods, international acceptance and settlement currencies.
- [ ] Set final INR prices, tax treatment, invoice numbering and billing currency policy with appropriate professional input.
- [ ] Legal operator name: **blank — owner to supply**.
- [ ] Public support email: **blank — owner to supply**.
- [ ] Business mailing address: **blank — owner to supply**.
- [ ] Confirm subscription, consumed-generation, annual-cancellation and prepaid-pack refund rules; existing public drafts set no approved refund window.
- [ ] Set storage/asset/financial-record retention and cancellation/deletion rules; budget backups and delivery.
- [ ] Complete migrations, ledger, worker, subscriptions, multi-business dashboard and gateway acceptance checks above before paid activation.
- [ ] Audit early-access users/legacy paid batches; communicate transition rather than deleting or silently restricting existing work.

Public wording once the Free-trial ledger is live: **“Your first photoreal 3D model is on us.”** After that trial is consumed: **“Keep creating with a paid plan.”** Show exact remaining AI/3D units, renewal dates and authorized upgrade/pack actions. Until the trial and entitlement ledger is implemented, keep the existing coming-soon server lock; do not bypass it just because a user is Free. New public claims must match actual enabled benefits.
