# Introify pending items

Updated: 9 September 2026, 13:19 IST. Deployed baseline: `026c2da` (includes billing `ceec052` and navigation `c15c8ed`). This status update is local only.

**The migration blocker is resolved, Hostinger deployment completed, and the new public frontend passed HTTP and scoped live Edge checks.** Hostinger marked `026c2da` **Completed / Current at 13:13 IST** (4m29s), following successful recovery, migrations and bootstrap at 13:10 IST. HTTP checks passed at 13:15 IST. Edge confirmed annual pricing, the visible logo transition clearing on arrival, readable inspected mobile sections and light/dark pricing. Live keyboard/reduced-motion/back-forward checks, signed-out auth-screen acceptance, authenticated business checks and provider activation remain pending. See [`DEPLOYMENT_VERIFICATION.md`](DEPLOYMENT_VERIFICATION.md) for evidence and limits.

This is the consolidated action list. Public legal/contact values remain intentionally blank at the owner's request. Do not fill them from private account details, example configuration or assumptions.

## 1. Verify the release

| Pending action | Completion evidence |
| --- | --- |
| Hostinger deployment of `026c2da`. | **Complete:** Hostinger showed Completed / Current at 13:13 IST (4m29s); live HTTP checks at 13:15 IST returned the new pricing/homepage and transition assets. Migration and bootstrap stages also succeeded. |
| Verify existing business access after the production migration. | **Migration application verified in Hostinger logs:** `20260909110000_ar_build_foundation` and `20260909120000_platform_billing` applied successfully. Confirm existing profiles, collaborators and resources remain accessible in the running app; this functional check remains pending. |
| Finish live functional checks beyond the public HTTP smoke. | **HTTP complete at 13:15 IST:** `/`, `/pricing`, `/demo`, `/sign-in`, `/sign-up`, `/privacy`, `/terms` and `/api/health` returned 200; unauthenticated `/dashboard` returned 307 to `/sign-in`. New pricing/allowances and homepage teaser were present. Public upload delivery and authenticated dashboard/resource access remain to be verified. |
| Finish remaining navigation/accessibility checks. | **Scoped live Edge checks passed on `026c2da`:** Introify orb/wordmark transition appeared from pricing to home and cleared on arrival; inspected 390×844 homepage/pricing sections were readable without observed overlap; all five plan titles aligned in one column; light/dark pricing checked. Live keyboard focus, reduced motion, back/forward and slow-route behavior remain to be verified. |
| Finish signed-out auth-screen visual acceptance. | HTTP sign-in/sign-up responses passed. The existing authenticated Edge session redirected signup to admin, so signup form appearance was not verified; no account mutations were made. |
| Confirm durable uploads and worker operation. | Upload and generated files survive restart/redeployment; a worker resumes durable payment-event and generation work without duplicate effects. A configured flag alone is insufficient. |
| Close the earlier Hostinger vulnerability alert against the deployed revision. | Review a fresh Hostinger scan and record unresolved findings, if any. The email's 8 September counts are historical; this review did not obtain a current scan. |

The billing, Stripe reconciliation and AR implementation already passed **29 tests against a migrated disposable PostgreSQL database**, including quota races, payment replay, refunds, clock ordering and generation settlement. That database was stopped after validation. Recreating the ledger or redoing the implementation is not a pending launch task; verifying the actual deployment is.

The missing `ArBuild` migration prerequisite was repaired in `026c2da`. **105 recovery guard/orchestration tests and three real PostgreSQL migration rehearsals passed** before production recovery: the complete tracked migration chain, preservation of existing AR rows/foreign-key policies, and recovery of the exact first-statement missing-table failure with existing business data preserved. The production guard and normal migration deployment then succeeded at 13:10 IST. This was a narrowly checked migration-record recovery followed by additive migrations, not a database reset.

The new shared logo transition is implemented across navigation and route loading states. **32 transition behavior tests and 35 existing auth/marketing/billing UI tests passed**, along with TypeScript, targeted ESLint and an isolated Node 20 production build. Live Edge subsequently captured the actual orb/wordmark transition and confirmed it cleared on arrival. Annual selection showed paid monthly equivalents **$9/$18/$36/$90**, with yearly totals **$108/$216/$432/$1,080**. At 390×844, inspected homepage/pricing sections were readable without observed overlap; DOM page scrollWidth was 380 versus innerWidth 390. Light and dark pricing were visually checked. The operator restored System theme and reset the viewport, leaving the live homepage open as the deliverable. These observations apply to the inspected views, not every route or device.

## 2. Supply and approve public business details

The source of these values is [`src/lib/marketing-business.ts`](../src/lib/marketing-business.ts). Every owner-value cell below remains blank deliberately.

| Field | Owner's value |
| --- | --- |
| Legal operator name (`operatorName`) | |
| Public support email (`supportEmail`) | |
| Public mailing address (`businessAddress`) | |
| Public support phone (`supportPhone`) | |
| Refund request window (`refundWindow`) | |
| Refund processing time (`refundProcessingTime`) | |
| Grievance officer/name and designation (`grievanceOfficer`) | |
| Grievance email (`grievanceEmail`) | |
| Governing law/jurisdiction (`jurisdiction`) | |
| Registration number, only if applicable (`registrationNumber`) | |
| GST/tax identifier, only if applicable (`gstNumber`) | |
| Approved SMS sender/header, before SMS activation (`smsSenderId`) | |

- [ ] Confirm the actual operator/business form and complete gateway KYC privately with the provider. Do not imply company incorporation or gateway eligibility from the existence of the site.
- [ ] Approve tax treatment, renewal/cancellation terms, refund eligibility/exceptions/request process, and digital delivery/access promises for the actual plans.
- [ ] Review the final policies for the operator, geography, merchants and data handled. Replace remaining draft wording only when the described processes work.
- [ ] Establish monitored support and grievance/privacy channels, with a person responsible for responding.
- [ ] Keep `policiesApproved: false` until these details, policies and processes are approved. The current checkout gate also requires operator name, address, support email and refund window; this minimum code check is not a substitute for the full review.

## 3. Activate paid plans and generation services

| Service | Pending activation work |
| --- | --- |
| Introify subscriptions | Confirm an eligible production Stripe account for Introify's own software subscriptions, complete provider onboarding, and configure matching live secret/publishable keys plus the separate platform webhook secret in hosting. If a different gateway is chosen, implement and verify its own subscription/webhook adapter. |
| Provider-account payment verification | Exercise the actual provider's test facilities for checkout, authentication/failure, renewal, upgrade/downgrade, cancellation, refunds, disputes and duplicate/out-of-order webhooks. Automated Stripe fixtures do not establish that this provider account is correctly configured. |
| Billing enablement | Enable `INTROIFY_BILLING_ENABLED`, live billing mode and `INTROIFY_WORKER_ENABLED` only after the preceding release/provider/policy checks. Production test mode is intentionally refused. The app can be deployed while checkout remains disabled. |
| AI | Choose and fund OpenAI or xAI API access; configure explicitly approved Fast, Smart and Reasoning mappings, then test every advertised mode. Current public commercial chat uses the API path in `ai-runtime.ts`; the older Codex credential handoff is not its activation procedure. The public availability summary checks Fast only, so it does not prove Smart/Reasoning health. |
| AI cost reporting | Enter verified input/output price settings for each enabled model when reporting costs. Missing settings remain unknown; do not report them as zero. |
| Photoreal 3D | Configure/fund the Meshy provider, verify the pinned recipe and current provider cost, set the free-trial/daily/concurrency caps, and test one authorized generation plus delivery/recovery. `INTROIFY_PHOTOREAL_ENABLED` also requires the worker and a usable provider key. |
| Billing operations | Assign responsibility for `/admin/billing`, failed events, held/unknown generations, refunds/disputes and account restoration. Resolve uncertain outcomes from provider records before any resend. Refund/dispute holds intentionally do not reactivate accounts automatically. |

The implemented catalog is Free, Starter **$10/month**, Pro **$20/month**, Business **$40/month** and Scale **$100/month**, with annual pricing in [`catalog.ts`](../src/lib/billing/catalog.ts). These are implemented offers awaiting activation and approved commercial terms, not a claim that live checkout works. Independent merchant sales, Stripe Connect/settlement and appointment deposits require their own provider approval and end-to-end verification; platform subscriptions do not activate those flows.

## 4. Complete support, privacy and messaging operations

- [ ] Verify the email sender/domain, actual delivery, failure handling and access-link recovery before relying on emailed purchases or notices. `src/lib/email.ts` currently logs a preview and returns success when no Resend client is configured; that is not delivery evidence. Review this behavior and logged personal information before enabling those flows.
- [ ] Define and implement the data retention/deletion schedule across accounts, chats, analytics, files, logs and backups; assign an owner for access/correction/deletion requests and incident response.
- [ ] Confirm the actual provider inventory and processing terms for the privacy notice. Review analytics notices/consent and the absence of a dedicated cookie-preference control against the intended deployment.
- [ ] Review sensitive collection and publicly served upload URLs. Keep affected medical/confidential-document flows disabled until suitable private storage, authorization and handling are verified.
- [ ] Before SMS or automated WhatsApp is offered, select the provider, complete applicable sender/template/consent registration, implement the send adapter and authenticated delivery callbacks, and test withdrawal/suppression, retries and failures. Appointment notification adapters are currently inert; `wa.me` links are not automated delivery.
- [ ] Review each supporting page's final wording, links, metadata and indexing after approval. `/pricing` is already indexable; the nine other supporting routes currently remain `noindex` in the shared marketing registry.

These items block the relevant paid, messaging or sensitive-data flows. SMS and future integrations need not prevent a website release that clearly keeps them unavailable.

## 5. Planned features, not current launch blockers

The following are explicitly marked as planned in the live source catalog and should not be sold as implemented capabilities:

- Custom domains.
- Automated follow-up and advanced automation workflows.
- Consolidated conversion reporting across a business group.
- Reusable business templates and bulk workflow approvals.
- Platform API access and platform webhooks.

A stricter downgrade policy that archives excess businesses/seats is also a future product decision. Current behavior retains existing access/data and blocks further quota growth; do not silently remove businesses or colleagues during launch.

## Documentation reconciliation

| Earlier discrepancy | Status and current source position |
| --- | --- |
| `LAUNCH_READINESS.md` described `/pricing` as free early access and paid-plan implementation as future work. | **Resolved:** the guide now links the current implementation/actions and describes the implemented five-plan catalog. Provider activation and approved commercial terms remain pending. |
| `LAUNCH_READINESS.md` said all ten supporting routes were `noindex`. | **Resolved:** it now records `/pricing` as indexable and the other nine supporting routes as `noindex`. |
| `DEPLOYMENT.md` emphasized production Codex credentials as the chat setup. | **Resolved:** the guide now documents funded OpenAI/xAI API access, explicit mode mappings, cost settings and commercial-runtime checks. Legacy diagnostics are described separately; the personal-Codex activation walkthrough was removed. |
| The older monetization proposal/audit documents say implementation is local, credit-ledger work is missing, or only mocked database tests exist. | `ceec052` was pushed and real PostgreSQL migration/concurrency validation passed. Keep those documents as historical design/audit records or update their status headers before using them as a current release checklist. |

Historical monetization drafts remain unchanged. Follow the updated operational guides and implementation record: [`BILLING_IMPLEMENTATION.md`](BILLING_IMPLEMENTATION.md), [`BILLING_LAUNCH_CHECKLIST.md`](BILLING_LAUNCH_CHECKLIST.md), [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md), [`DEPLOYMENT.md`](DEPLOYMENT.md), [`billing/config.ts`](../src/lib/billing/config.ts), [`marketing-business.ts`](../src/lib/marketing-business.ts) and [`marketing-seo.ts`](../src/lib/marketing-seo.ts).
