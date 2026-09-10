# Free tier, AI models and meaningful upgrades

> Historical design snapshot — 9 September 2026, superseded by subsequent implementation. Statements below about existing code, proposed work and pending decisions describe that baseline. See [billing implementation](BILLING_IMPLEMENTATION.md) for implemented behavior, [pending items](PENDING_ITEMS.md) for later launch status, and the [billing catalog](../src/lib/billing/catalog.ts) for current plan values.

Revision: 9 September 2026. Owner direction: include a real Free plan with one trial photoreal generation, limited chats and stronger-model access in paid plans. This is a revised commercial and engineering proposal. It does not activate AI, a Free generation, paid subscriptions or a new provider model. The existing local rollout lock remains until durable grants and metering are implemented. The main [monetization specification](./monetization-plan.md) now includes this revision.

## The value ladder

Free should let a real person publish a useful page, answer their first enquiries and produce one usable 3D model. Paid plans should help them look professional, convert enquiries, collaborate and operate several businesses. More expensive model names alone are not a sufficient reason to pay.

| Plan | Price monthly / annual total | Main job | Monthly AI credits | Included photoreal | Businesses / staff |
| --- | --- | --- | ---: | --- | --- |
| Free | $0 | Launch, share and try | 50 | 1 successful trial, once | 1 / 1 |
| Starter | $10 / $108 | Build a professional presence | 500 | 3/month | 1 / 1 |
| Pro | $20 / $216 | Qualify and convert enquiries | 1,500 | 10/month | 1 / 3 |
| Business | $40 / $432 | Coordinate several businesses | 4,000 | 20/month | 3 / 5 |
| Scale | $100 / $1,080 | Manage a group or agency | 10,000 | 50/month | 10 / 15 |

Starter's move from three once-only generations to three monthly is a deliberate recommendation requiring confirmation. Annual billing is 10% cheaper, charged upfront, while both AI and paid 3D allowances refill monthly. Canceling annual renewal does not end already-paid monthly allowance grants before the paid-through date.

### Free: useful without a card

- One business page, profile, links and QR sharing, with Introify branding.
- Ten published offerings, enquiry capture and basic booking/contact forms; ordinary visitors do not need to become staff members.
- Fifty AI credits each month for Fast-model customer replies. A short visitor conversation with five AI replies uses five credits; a new thread does not reset usage.
- Basic assistant personality presets and answers drawn from the profile, offerings and up to five approved knowledge sources (50,000 extracted characters total).
- One successful standard textured 3D generation, with its normal export formats. No payment card required. Continuing to view, download or display that model does not consume new generation units.
- Basic views/enquiries charts for seven days, 500 MB storage and 5 GB monthly delivery as starting budgets.
- Account security, access to one's data, deletion controls, consent controls, billing help and issue reporting. Never make these premium privileges.

At the AI limit, retain the live page, contact form and normal booking links. Show a short static handoff to the business instead of producing a fake AI answer or disabling the business. Notify the owner and provide an upgrade/pack option when billing is enabled. A Free user who has consumed their 3D trial can retain the result and see the paid plan benefits.

The trial is once per eligible verified person, not once per business, billing account, email alias or month. Implementation can only enforce this to the strength of identity and abuse signals: do not claim perfect real-person uniqueness from email verification. Require verified email, a completed business profile and a valid source image before reserving the trial; add risk-based challenges, velocity checks and a platform trial-spend budget. Shared IPs and legitimate business groups must not be automatically treated as fraud. Retain only the minimal redemption history supported by the privacy/deletion policy. Account recovery and subscription switching must not reset eligibility.

Reserve the trial transactionally, using the same job/ledger path as paid generations. Technical failure releases that same unit; a vendor timeout with unknown outcome remains reserved pending reconciliation. A delivered model consumes the trial even if the user later deletes it or requests another artistic variation. At the first paid subscription activation, the account's unused trial eligibility is absorbed rather than stacked. A new paid account cannot later cancel to acquire a bonus Free generation.

### Starter: make the business yours

Free capabilities plus removal of promotional branding, full colors/styles, custom assistant tone/instructions and welcome text, lead questions, inbox/tags, 100 offerings, 20 knowledge sources/200,000 characters, 30-day reports and source tracking. Fast and Smart models become selectable. Three recurring 3D generations and the ability to buy packs provide ongoing value for the subscription.

### Pro: turn conversations into action

Starter capabilities plus a custom domain, three staff seats, 500 offerings, 100 sources/one million characters, lead qualification/assignment, conversion reporting, segmented views and more detailed analytics. Add Reasoning model access for complex comparisons and owner planning. Optional visitor memory requires consent and visitor-specific isolation. Proposed automation allowance: five enabled rules and 250 executions/month. Human handoff is a quality feature; essential contact access remains available on Free.

### Business: coordinate several teams

Pro capabilities across three businesses and five distinct internal people, with isolated data and knowledge per business. Add business-level AI/model budgets, pooled credits, consolidated reporting, role-based routing, 300 sources/three million characters, approved document-comparison workflows and 20 enabled rules/1,000 executions monthly. Staff access must be implemented across the complete dashboard before it is advertised as working. One person in all three businesses counts once toward seats, while each business retains its own permissions.

### Scale: operate a group or agency

Business capabilities across ten businesses and fifteen staff seats. Add reusable page/assistant templates, controlled bulk setup, generation queues, request approvals, consolidated usage/invoices, routing policies, client-specific access and eventual API/webhook access with independent scopes/rate limits. Proposed allowance: 1,000 sources/ten million characters and 50 rules/3,000 executions monthly. API access does not create a quota bypass. Custom SLAs, SSO/SCIM and unlimited agency resale are enterprise work to price separately, not promises automatically included for $100.

Across all tiers, source counts and character limits are pooled per billing account, with separate business partitions. One uploaded document or approved URL snapshot is one source; extracted text is the second cap. Live profile/catalog fields are business data rather than arbitrary uploaded source files, but their indexed text and retrieval costs still need limits. Store content hashes so editing a title does not cause needless full re-embedding. Use bounded ingestion/refresh quotas; a thousand huge or constantly changing files cannot be treated as free unlimited training.

## Chat units and stronger models

Do not publish an ambiguous '1,500 chats' promise. A conversation can have one reply or hundreds. Show **AI credits/month**, then the familiar comparison **up to 1,500 everyday replies**. The plan picker, model picker and usage screen must explain the same conversion.

| Mode | Access | Proposed units for a bounded reply | Purpose | Candidate to evaluate |
| --- | --- | ---: | --- | --- |
| Fast | Every plan | 1 AI credit | Grounded FAQs, product/menu questions, basic lead capture | GPT-5.6 Luna or an evaluated equivalent |
| Smart | Starter and above | 20 AI credits | Nuanced recommendations, mixed constraints and better instruction following | GPT-5.6 Terra or equivalent |
| Reasoning | Pro and above | 40 AI credits | Complex comparisons, document reasoning and owner-side planning | GPT-5.6 Sol or equivalent |

These are candidate mappings, not models activated in Introify. Verify actual API account availability and benchmark them on the business tasks before selecting snapshots. The current app exposes older profile model names and has a provider resolver rather than a plan model catalog. Customer-facing settings should show the actual selected model as well as its friendly mode; do not imply that an untested model is present or secretly substitute a cheaper model after selling a named one. Additional top-tier models can be added with their own published multiplier once costs and quality are validated; 'all future models included' is not a sound $100 promise.

Current official standard text rates per million tokens, checked 9 September 2026: [Luna $0.20 input / $1.20 output](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Terra $2 / $12](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Sol $4 / $20](https://developers.openai.com/api/docs/models/gpt-5.6-sol). Sol's page identifies its current pricing as promotional; re-check before fixing commercial rates. Tool calls and larger contexts can add cost. These API rates do not establish availability on the owner's account or include all Introify service costs.

Simple text-only cost illustrations, excluding caching benefits, tools, retrieval, memory and retries:

| Mode | Total input budget across billed calls | Total output budget, including billed reasoning | Token-only cost at those rates | Cost per proposed AI credit |
| --- | ---: | ---: | ---: | ---: |
| Fast | 2,000 | 500 | $0.001 | $0.001 |
| Smart | 4,000 | 1,000 | $0.020 | $0.001 |
| Reasoning | 4,000 | 1,000 | $0.036 | $0.0009 |

The budgets are across all calls supporting the quoted operation, not fresh allowances for each tool loop. Billed reasoning consumes the output allowance even when it is not visible prose. Real usefulness under these bounds must be evaluated; long reasoning or document tasks often need more. If the workload cannot fit a mode's standard recipe, show a higher bounded quote before it starts rather than hiding the difference or promising arbitrary length at a flat message price.

Example: a Pro account could spend 1,500 credits on 1,500 Fast replies, 75 Smart replies, 37 Reasoning replies with 20 credits remaining, or a mixture. One possible mixture is 1,000 Fast + 15 Smart + 5 Reasoning = 1,500 credits. Those quantities are alternatives within one pool, not three additive allowances. 3D units are completely separate and never silently converted into chat credits.

The business owner sets the public assistant's default mode, allowed escalation and a per-visitor/per-business spending cap. Anonymous visitors must not have an unrestricted paid-model picker. The owner can enable Auto with a maximum approved unit cost; any escalation stays inside that authorization and is recorded. Owner-side drafting and public customer replies share the disclosed account balance but have separate usage attribution and optional sub-budgets, so one cannot silently consume the other's entire allocation.

When Reasoning is unavailable or not affordable, offer a visibly labeled lower-cost mode if the owner has allowed it. Do not retry through several expensive providers with a fresh unmetered budget. Requested model access, actual billed model, fallback, recipe version and consumed credits belong in the usage audit. Higher tiers can receive greater concurrency and queue priority; never promise the same model is inherently smarter solely because the customer pays more.

## Combined unit economics

Using $0.80 per delivered standard 3D model as the earlier conservative planning assumption, plus the maximum standard token cost per AI credit above ($0.001), full consumption of both allowances produces:

| Plan | Effective monthly revenue on annual billing | 3D cost | Maximum token-only cost across standard AI mix | Remaining before other costs |
| --- | ---: | ---: | ---: | ---: |
| Free | $0 | $0.80 once | $0.05/month | Acquisition/retention spend |
| Starter | $9 | $2.40 | $0.50 | $6.10 |
| Pro | $18 | $8.00 | $1.50 | $8.50 |
| Business | $36 | $16.00 | $4.00 | $16.00 |
| Scale | $90 | $40.00 | $10.00 | $40.00 |

These are NOT gross profit or all-in ceilings. The 3D number is an assumption and the AI number excludes embeddings, memory, extra provider calls, tools, platform hosting, storage/delivery, payment fees, taxes, support and refunds. At high simultaneous usage, Business and Scale leave about 44% of annual revenue before those other costs. Keeping the owner-requested 10 generations on Pro costs more than a leaner five-generation tier; this proposal preserves those ten and uses higher model-credit weights to protect the remaining budget. The proposed generous quotas therefore need a margin check before publication. If observed auxiliary costs are material, reduce launch AI credits or revise annual discount/pack pricing openly; do not sell these quotas and then silently impose a hidden lower spending cap. Paid commitments require capacity budgeting; operator incidents get transparent status and service handling.

At 10,000 active Free accounts, 50 Fast replies each cost roughly $500/month in model tokens under the bounded Fast example; one successful trial for each costs roughly $8,000 once under the 3D assumption. Fraud, delivery, support and processing add to that. Stage Free-trial availability against an acquisition budget with clearly disclosed eligibility/availability, rather than treating each free signup as costless. An owner must be able to see activation cost and free-to-paid conversion by cohort.

Keep 3D packs proposed at 10/$19, 50/$89 and 100/$169 until verified costs settle. A separate AI pack could start at **1,000 credits for $7**, valid on the account's currently entitled models, subject to the same margin review. Buying an AI pack on Starter must not unlock Reasoning; buying credits changes quantity, upgrading changes capabilities. At launch, keep pack purchases on paid plans to simplify support and clearly disclose paused prepaid balances after cancellation. SMS, WhatsApp, voice and unusually large document/research jobs need separate quotes rather than hidden deductions from normal replies.

## Implementation requirements

1. **Catalog and entitlements:** version the Free/paid plan limits, named model allowlist, mode weights, source/storage caps and tool permissions together. The owner or browser submits an approved mode/offer ID; the server resolves the model and price. The existing arbitrary `aiModel` profile field must not be sufficient authorization. Read a billing account entitlement with an explicit Free tier, not a Boolean `isPaid` test.
2. **Separate ledgers:** AI_CREDIT and PHOTOREAL_GENERATION units use distinct grants/reservations. A FREE_TRIAL grant is authorized promotional usage with a unique redemption source, not a pretend paid invoice. AI monthly grants renew even on Free; the 3D Free trial never renews. Annual monthly grants require paid coverage, and Free grants use a stable monthly anchor with duplicate/missed-window protection.
3. **Atomic chat metering:** authorize business and allowed mode; budget token context, output/reasoning and permitted tools; reserve quoted credits once using a client request ID; stream the reply and persist its result/usage durably; consume once on successful delivery or restore eligible technical failures. A browser disconnect does not prove the provider stopped: reconcile it before releasing reserved units. A completed persisted reply can be retrieved without buying it again. A manually requested regenerated answer is new work with a new quote.
4. **Bound every cost path:** public replies, owner preview, imports, embeddings, re-indexing, memory summaries, copilot calls, multimodal attachments, scheduled workflows and provider fallbacks. Tool orchestration is inside the total operation budget. A displayed reply must not hide an unlimited sequence of paid follow-up calls. Store actual provider token usage and tool cost in addition to customer units.
5. **Keep identities and knowledge isolated:** aggregate budgets at billing-account level, while retrieval and operational access remain at workspace/visitor level. Personal visitor memory must not become common business knowledge automatically. Private prompts, customer records and provider keys are never shared across businesses merely because one subscription pays for them. All tiers get the same permission checks and privacy baseline.
6. **Usage UI and controls:** show remaining monthly versus purchased units, exact renewal date, model unit cost, usage by business/actor, and owner-selected budgets. Notify at 80% and 100%, with no automatic overage charge. At zero, retain static enquiry/booking access. Billing-owner permission is required to buy a pack or raise an automatic spending limit.
7. **Evaluate before selling:** grounded answer accuracy, hallucinated prices/availability, tool correctness, multilingual quality, latency and actual P50/P95 cost per recipe. Ensure high-model improvements are useful for the product. Cache public business answers only within the proper tenant/content version; never cache private visitor replies across people.

## Existing code versus proposed benefits

Existing building blocks include profile personality/welcome settings, document retrieval, lead capture, catalog presentation, conversational tools, human handoff controls, memory helpers and basic analytics. They are not currently metered per plan. Source: `src/lib/rag.ts`, `src/lib/memory.ts`, `src/lib/llm.ts`, `src/lib/admin/ai-settings.ts`, `src/app/api/chat/handler.ts` and `src/components/dashboard/profile-editor.tsx`.

The public chat handler does not currently apply a plan model allowlist, monthly balance or aggregate token ceiling. One reply can create the initial model call and multiple tool follow-ups. Memory may add two summaries and embeddings. The routing code can use a Codex authentication source as well as OpenAI/xAI: commercial production economics must use a supported, explicitly authorized provider integration with measured billing. Do not assume the founder's interactive subscription is an unlimited free upstream API for customers.

Independent audit also found that manual knowledge syncing can copy visitor names/emails into general documents eligible for retrieval in other conversations. **Fix consent, redaction and visitor-specific retrieval boundaries before advertising learning memory.** Smart models are not an access-control boundary.

Full shared-team dashboards, subscriptions/credit ledgers, custom domain provisioning, conversion reports, automation orchestration and API entitlement controls need implementation or further validation. Google Calendar currently has a placeholder alongside one-way ICS support; scheduled notification/deposit adapters are incomplete. Do not publish two-way calendar sync, delivered SMS/WhatsApp reminders or working deposits as paid benefits until end-to-end behavior exists. Higher prices must buy actual capabilities.

## Acceptance and pending choices

- [x] Free includes one successful trial generation plus limited monthly AI, per owner direction.
- [ ] Confirm Starter's revised recurring three-generation allowance.
- [ ] Approve credit counts, model weights, knowledge limits and included workflows after combined cost review.
- [ ] Select available provider snapshots and evaluate the bounded model recipes; determine charges for longer contexts, reasoning and tools.
- [ ] Build Free trial grants and monthly AI accounting before changing the current coming-soon gate to a working free-generation button.
- [ ] Test forged premium model IDs, direct API calls, simultaneous last-credit chats, duplicate Free claims, browser disconnects, tool-loop overspend, memory/embedding charges, and anonymous-visitor quota abuse.
- [ ] Test upgrade/downgrade without duplicate Free/monthly grants; paid term cancellation, leap-year/month-end resets, pack pause/reactivation and multi-business pooled usage.
- [ ] Test that exhausting AI credits leaves contact/booking forms usable and never produces invented provider-backed answers.
- [ ] Complete privacy/memory isolation, multi-business role migration, provider activation and existing operator/contact/refund details before paid launch.

No migration, live payment, model API call or change to the rollout lock is made by this document revision.
