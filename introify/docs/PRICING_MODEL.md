# Introify pricing model and capability assessment

9 September 2026. Internal assessment of the implementation deployed in `026c2da`; pricing presentation may evolve separately. **Keep the approved prices, 10% annual discount, allowances and existing entitlement rules.** This document proposes packaging and copy, not new functionality or additional restrictions. No provider prices, revenue or margins have been assumed.

## Position the tiers around the work they support

| Plan | Customer and outcome | Existing reasons to choose it | Concise feature copy for the card |
| --- | --- | --- | --- |
| Free | An individual testing a first business page and gathering initial interest. | A usable public presence, publishing/contact tools, basic activity totals and a small service allowance. | “Your page, photo, logo and social links”; “Downloadable QR card”; “Publish up to 10 offerings”; “Enquiries and booking tools”; “Basic activity totals”. |
| Starter | A solo operator who wants a more distinctive page and assistant. | Custom welcome styles, removal of the Introify footer, custom assistant instructions and Smart access; larger catalog/knowledge capacity. | “Everything in Free”; “Custom welcome orb and styles”; “Remove the Introify footer”; “Set your assistant’s instructions”; “Fast + Smart model access”; “100 published offerings”. |
| Pro | A business with a small team that wants to understand activity and handle more involved conversations. | Three total seats, role-based business access, Reasoning access, private conversation notes and per-business analytics. | “Everything in Starter”; “3 seats, including you”; “Business access by role”; “Reasoning model access”; “Private conversation notes, with consent”; “30-day trends, traffic sources and funnel”. |
| Business | An owner operating several businesses with a small shared team. | Three business pages/workspaces under one billing account, five total seats and pooled allowances. Includes Pro capabilities. | “Everything in Pro”; “3 businesses under one plan”; “5 seats across your businesses”; “Choose each teammate’s business access”; “Shared AI and 3D allowances”; “1,500 published offerings across the account”. |
| Scale | An established business group with a larger catalog and team. | Ten businesses, fifteen total seats, more shared AI/3D, knowledge and storage capacity. No unique premium workflow is implemented exclusively for this tier. | “Everything in Business”; “10 businesses under one plan”; “15 seats across your businesses”; “5,000 published offerings”; “1,000 knowledge sources”; “50 GB shared storage”. |

Keep the current credit/generation allowances beside these benefit rows. A shared “Included with every plan” block avoids making higher tiers appear to be the only way to publish, receive enquiries or use a calendar. Business and Scale principally sell capacity and account consolidation; do not invent exclusive features to fill their cards.

## Exact approved catalog

Amounts are USD. Annual equivalents are presentation values; the whole annual amount is billed upfront. Annual billing retains monthly service allowances.

| Limit or price | Free | Starter | Pro | Business | Scale |
| --- | ---: | ---: | ---: | ---: | ---: |
| Monthly subscription | $0 | $10 | $20 | $40 | $100 |
| Annual monthly equivalent | $0 | $9 | $18 | $36 | $90 |
| Annual charge | $0 | $108 | $216 | $432 | $1,080 |
| AI credits / month | 50 | 500 | 1,500 | 4,000 | 10,000 |
| Included photoreal generations | 1 trial, once | 3 / month | 10 / month | 20 / month | 50 / month |
| Businesses | 1 | 1 | 1 | 3 | 10 |
| Seats, including owner | 1 | 1 | 3 | 5 | 15 |
| Published offerings | 10 | 100 | 500 | 1,500 | 5,000 |
| Knowledge sources | 5 | 20 | 100 | 300 | 1,000 |
| Extracted knowledge characters | 50,000 | 200,000 | 1,000,000 | 3,000,000 | 10,000,000 |
| Stored file allowance | 500 MB | 1 GB | 5 GB | 15 GB | 50 GB |

Source: [`catalog.ts`](../src/lib/billing/catalog.ts). Storage is accounted in bytes; the implementation uses binary MB/GB units. Monthly included credits reset without rollover. There are no automatic overage purchases. The Free 3D trial is once per eligible verified user, not per month, new business or billing account, and remains subject to availability and platform trial limits.

| AI mode | Credits per accepted bounded reply | Included tiers |
| --- | ---: | --- |
| Fast | 1 | All |
| Smart | 20 | Starter and above |
| Reasoning | 40 | Pro and above |

Model **access** is distinct from provider availability and remaining credits. One shared balance pays for the selected mode: 500 credits can fund up to 500 Fast replies or 25 Smart replies, or a mixture. Do not describe this as unlimited chats, unlimited models or access to every provider model. Provider mappings are explicit configuration, not a promise attached to a provider's current marketing name. Source: [`ai-usage.ts`](../src/lib/ai-usage.ts), [`ai-runtime.ts`](../src/lib/ai-runtime.ts).

| One-time pack | Price | Conditions |
| --- | ---: | --- |
| 1,000 AI credits | $7 | Active paid plan; only that plan's included AI modes. |
| 10 photoreal generations | $19 | Active paid plan; standard generation recipe. |
| 50 photoreal generations | $89 | Same. |
| 100 photoreal generations | $169 | Same. |

Packs do not renew. Purchased units do not expire while the account exists; unused units pause on Free and resume with an active paid plan. AI credits and photoreal generations are separate balances. Existing model viewing/downloading does not consume a new generation, although stored files occupy storage. One photoreal unit is consumed on successful delivery; uncertain provider outcomes remain held for reconciliation rather than being automatically retried. Sources: [`service.ts`](../src/lib/billing/service.ts), [`ar-builds.ts`](../src/lib/ar-builds.ts).

## Built inventory and boundaries

| Capability | Current implementation / tier boundary | Code evidence and wording limit |
| --- | --- | --- |
| Public business identity and sharing | Shared basics: name, photo/logo, biography/social links, public page, short links and downloadable QR card. | [`profile.ts`](../src/app/actions/profile.ts), [`profile-editor.tsx`](../src/components/dashboard/profile-editor.tsx), [`short-links.ts`](../src/app/actions/short-links.ts), [`qr-card.tsx`](../src/components/profile/qr-card.tsx). A business's own name/photo/logo is already available on Free; do not call that a Starter-only upgrade. |
| Publishing/catalog | Products, service offerings, courses, events, communities and lead magnets use the common published-offering allowance. Courses include modules/lessons. | [`resource-limits.ts`](../src/lib/billing/resource-limits.ts), [`products.ts`](../src/app/actions/products.ts), [`courses.ts`](../src/app/actions/courses.ts), [`events.ts`](../src/app/actions/events.ts). Published counts are combined, not a separate full quota per type. Draft edits do not consume publishing slots. |
| Enquiry management | Lead statuses, notes and manually assigned follow-up dates are built and not paid-tier gates. | [`leads.ts`](../src/app/actions/leads.ts). “Organize enquiries and follow-ups” is accurate; “automated follow-up campaigns” is not. |
| Bookings/calendar | Available slots, booking records, confirmation/cancellation and blocked time; calendar feed integration is present. | [`bookings.ts`](../src/app/actions/bookings.ts), [`calendar-sync.ts`](../src/app/actions/calendar-sync.ts). Sell “booking and calendar tools”; do not promise two-way external calendar sync, SMS reminders or automatic payment confirmation. |
| Commerce and business-specific tools | Listing/order/course/event/menu flows are built; visible tools depend on business type and enabled surfaces. | [`surfaces.ts`](../src/lib/surfaces.ts), [`sidebar.tsx`](../src/components/dashboard/sidebar.tsx), [`products.ts`](../src/app/actions/products.ts). Use “Products, services, courses or events for your business.” Merchant checkout/Connect/deposits have independent provider requirements; an Introify plan does not establish live payment acceptance. Business OS is explicit opt-in and excluded from default surfaces; do not sell every blueprint as a universal tier benefit. |
| Branding upgrade | Starter+: configurable welcome animation/orb styles and optional Introify footer removal. Public rendering and saves enforce access. | [`profile-branding.ts`](../src/lib/profile-branding.ts), [`ai-settings.ts`](../src/lib/ai-settings.ts), [`[slug]/layout.tsx`](../src/app/[slug]/layout.tsx). “Custom welcome styles + remove Introify branding” is safer than “complete white-label website” or “custom domain”. |
| Assistant instructions | Starter+: custom instructions; allowed model selection is enforced server-side. | [`ai-settings.ts`](../src/lib/ai-settings.ts), [`ai-usage.ts`](../src/lib/ai-usage.ts). Preserve the provider-readiness notice; the current live rollout has AI disabled. |
| Private conversation notes | Pro+: explicit owner setting, visitor consent and conversation/visitor scope; notes count toward knowledge limits. | [`memory.ts`](../src/lib/memory.ts), [`api/chat/handler.ts`](../src/app/api/chat/handler.ts). Notes are deterministic private excerpts, not a claim of autonomous learning, unrestricted permanent memory or shared public knowledge. |
| Activity and analytics | Every tier: basic activity totals. Pro+: per-business 30-day trends, traffic sources and aggregate funnel. | [`analytics.ts`](../src/lib/analytics.ts), [`home-pulse.tsx`](../src/components/dashboard/home-pulse.tsx). The funnel is aggregate activity, not person-level conversion attribution; consolidated cross-business conversion reporting is planned. |
| Team and business access | Pro+ capacity for additional people; Business+ capacity for multiple businesses. Invitations and separate workspace roles are implemented. | [`billing-team.ts`](../src/app/actions/billing-team.ts), [`workspace-access.ts`](../src/lib/workspace-access.ts). Invitations return private shareable links; automatic invitation-email delivery is not established. Role permissions and data isolation are baseline controls, not paid security add-ons. |
| Knowledge/files | Sources, extracted characters and stored bytes are enforced against the billing account; uploaded/generated derivatives count. | [`resource-limits.ts`](../src/lib/billing/resource-limits.ts), [`service.ts`](../src/lib/billing/service.ts), [`upload/handler.ts`](../src/app/api/upload/handler.ts), [`ar-builds.ts`](../src/lib/ar-builds.ts). Capacity is not a promise of unlimited uploads, backup retention or a particular ingestion format. |

## Account and seat logic

The subscription belongs to a **BillingAccount**, above its business profiles/workspaces. All businesses in that account share its credits, generations, offerings, knowledge and storage limits. A user can own multiple billing accounts and belong to other accounts; credits are not a global personal wallet. The owner counts as one seat, active colleagues count once across businesses, and outstanding invitations reserve seat capacity. Pro's three seats mean the owner plus up to two other people, not three employees plus the owner.

Owners choose invited businesses and roles: Admin, Manager, Staff or Viewer, with billing administration separate. Team and multi-business capacity is enforced through seat/business limits; the catalog booleans are not a reason to add separate gates to existing shared tools. Existing data/access is retained after downgrade and growth is blocked above the effective plan's limits. Do not promise automatic archival or remove existing business access as a pricing change.

## Unit economics: measure before activation

For each enabled mode, calculate actual request cost from measured usage and verified provider prices:

`request cost = input tokens × input price / 1,000,000 + output tokens × output price / 1,000,000 + separately billed provider/tool costs`

For full included AI usage, a conservative allowed-mode bound is `monthly credits × max(Fast request cost / 1, Smart request cost / 20, Reasoning request cost / 40)`, using only modes included in the tier and the configured bounded request budgets. Sum measured failed/uncertain provider spend as well; refunded app credits do not prove zero vendor cost. [`ai-runtime.ts`](../src/lib/ai-runtime.ts) retains unknown price/usage as unknown, not zero. For photoreal, use verified standard-recipe supplier cost and measured delivery/recovery overhead; provider consumed credits and the internal cost estimate are recorded separately in [`ar-builds.ts`](../src/lib/ar-builds.ts).

`monthly contribution = net monthly revenue − AI cost − photoreal cost − storage/egress − hosting/worker cost − payment fees − refunds/disputes − support allocation`

Use subscription revenue net of taxes; include payment and currency-conversion costs once in the fee term. For annual plans, assess this against **$9/$18/$36/$90 per month before those deductions**, not the undiscounted monthly price. Free is an acquisition cost: 50 monthly Fast credits, hosting/storage/support and one eligible lifetime trial. Bound the platform-wide Free budget and trial/concurrency limits. One-time packs need their own contribution calculation: net pack price minus the cost of all purchased units and associated fees/overhead. Breakage, future upgrades and “most people won't use it” are not a substitute for checking full-use exposure.

Before paid activation: approve public operator/policy details, confirm gateway eligibility/live configuration and signed reconciliation, fund and test every advertised AI mode, validate standard 3D cost/delivery with the worker, verify persistent storage, and assign an owner for held events/support. Current paid checkout, AI and photoreal flags remain unavailable in the verified public rollout. Keep that separate from the implemented catalog. [`config.ts`](../src/lib/billing/config.ts) defines the availability gates.

## Product decisions to revisit after measured use

1. First expose existing value clearly: shared basics, exact Starter/Pro unlocks, and Business/Scale pooling. Do not change prices or quotas during this presentation update.
2. Measure activation, active businesses/seats, publishing capacity, AI mix, actual generation delivery cost and support burden. Use these to evaluate future packaging; no unapproved margin target or new price is assumed here.
3. Shared publishing, QR sharing, lead notes, booking tools and basic totals currently have no exclusive higher-plan gate. Charging separately for those would require an explicit future product decision, migration policy and implementation—not a marketing copy change.
4. Keep custom domains, automated follow-up/advanced workflows, consolidated reporting, reusable business templates, bulk approvals, and a platform API/webhooks visibly on the roadmap with no promised delivery date. They are not included available features or reasons to charge today.
5. Do not imply priority support, service-level guarantees, unlimited traffic/storage/models, automatic emails/SMS, two-way calendar sync, enterprise security certification or guaranteed sales outcomes without the corresponding service and evidence. Source availability does not establish end-to-end provider readiness.

## Local presentation update

The shared cards now show existing feature benefits before usage allowances on the homepage, pricing route and billing screen. Pricing and billing also include an expandable, grouped feature comparison with sticky labels and internally scrolling mobile layout. Pricing metadata reflects the broader business tools. Rates, quotas and server entitlements are unchanged.

Validation: 30 targeted pricing, billing, marketing and SEO tests passed; full TypeScript and targeted ESLint passed. Edge inspection covered the actual components in an isolated HTTP preview at desktop and 390px mobile widths, light/dark themes, annual/compact toggles and the feature disclosure. The expanded mobile table stays within the page width. This is component-preview validation; the update has not been deployed and no provider was activated.
