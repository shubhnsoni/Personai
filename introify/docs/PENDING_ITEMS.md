# Introify pending items

Updated: 10 September 2026. Read the `x-introify-release` header from `/api/health` for the version currently serving production. The 9 September deployment evidence below is historical; owner-dependent activation items remain listed separately.

## 1. Latest release and remaining verification

The 10 September chat update includes a single bounded conversation viewport, aligned header actions, readable small action chips, preserved reading position during streaming, a darker Retro LCD palette, mode-aware browser canvas/theme metadata, and mobile keyboard/safe-area handling. The root deploy launcher validates the exact selected source before publishing and rejects files changed by another editor during validation.

All application changes and ready regression tests belong in the release queue. The historical Codex operator handoff and authenticated browser helper are intentionally local-only because they contain private account details. The older AR stash is preserved as historical work; it is not part of this application's deployment queue.

### Historical verification — 9 September 2026, release `7f1f6d8e4babb0de47573dcab01e8ddb238ad5a2`

The root **deploy.cmd** launcher validated an isolated copy, committed the selected files, pushed main and verified the exact production commit through the health response header. Hostinger marked this release **Completed / Current at 15:04 IST**, after 6m27s. Its build compiled in 72s, passed TypeScript in 34.4s, reported no pending migrations and zero dependency vulnerabilities.

Delivered and verified:

- Public dark styling uses the dashboard's near-black surfaces and cyan accents. Desktop and 390px mobile landing checks passed; the mobile page measured 380px inside a 390px viewport.
- The mobile business selector sits above drawer navigation. The drawer logo is 88px (20% smaller). The actual-component preview passed long-name, light/dark, scrolling, keyboard closure and successful business-switch checks without touching production businesses.
- Zomato, Swiggy and Uber Eats imports are restricted to restaurant/cafe businesses in the interface and on the server, including redirects and related links.
- Photoreal 3D is discoverable at **Dashboard → Shop/Menu → Photoreal 3D**, and directly inside a saved product's editor. Opening it does not start a generation. Provider activation remains pending below.
- Codex is configured privately in Hostinger with explicit Fast/Smart/Reasoning mappings. The live demo completed a real Fast-mode reply and a same-conversation services follow-up with actual listed prices. Both reached post-response suggestions, which the server emits after successful usage settlement. Plan credits, permissions and tool restrictions remain enforced.
- **231 isolated release tests passed**, followed by a Node 20.20.2 Webpack build (77s compile, 65s TypeScript). Nine live route/asset checks returned HTTP 200, including pricing, auth, legal pages, demo, health and a bundled upload. The public health header matched the complete release SHA.

Remaining verification:

- Remove the local temporary credential-transfer file `.local/introify-production-setup/.env.codex-production` after setup. Automatic approval review rejected the attempted deletion with “blocked by policy”; no alternative deletion was attempted. The folder is Git-ignored. The original Codex login and private Hostinger configuration must remain intact.
- Test Smart and Reasoning with appropriately entitled production accounts before treating their configuration as live readiness. No paid plan or generation was activated during this release.
- Review Codex account capacity and held reservations as traffic grows. All assistants share the connected Codex account's provider limits. Subscription usage does not have an API dollar-cost estimate.
- Complete owner-specific business/resource and durable-upload checks; the current platform-owner session does not have an active business. The mobile drawer was tested with actual components in an isolated preview.
- Consider replacing public branding's billing initialization/storage backfill with a read-only entitlement lookup. Public demo loads were temporarily slow during overlapping builds, then completed successfully; no persistent failure was reproduced.
- Verify durable worker operation when payments/photoreal are activated. A flag or credential alone is not delivery/recovery evidence.

Public legal/contact values remain intentionally blank at the owner's request. Do not fill them from private account details or assumptions. Previous deployment records remain in DEPLOYMENT_VERIFICATION.md.

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
| AI | Codex Fast production chat and a same-conversation services reply are verified on 7f1f6d8. Smart and Reasoning are explicitly mapped but still need appropriately entitled live-account tests. Monitor shared Codex account limits and login renewal. |
| AI cost reporting | Codex token usage is recorded when returned; dollar cost remains unknown for subscription access. If switching to API billing, enter verified model input/output rates rather than treating missing settings as zero. |
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
| Earlier deployment guidance excluded Codex from metered chat. | **Updated at the owner's request:** production Codex now uses explicit approved mode mappings, private server authentication and the same credit ledger. Fast chat is verified; legacy diagnostics remain separate. |
| The older monetization proposal/audit documents say implementation is local, credit-ledger work is missing, or only mocked database tests exist. | `ceec052` was pushed and real PostgreSQL migration/concurrency validation passed. Keep those documents as historical design/audit records or update their status headers before using them as a current release checklist. |

Historical monetization drafts remain unchanged. Follow the updated operational guides and implementation record: [`BILLING_IMPLEMENTATION.md`](BILLING_IMPLEMENTATION.md), [`BILLING_LAUNCH_CHECKLIST.md`](BILLING_LAUNCH_CHECKLIST.md), [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md), [`DEPLOYMENT.md`](DEPLOYMENT.md), [`billing/config.ts`](../src/lib/billing/config.ts), [`marketing-business.ts`](../src/lib/marketing-business.ts) and [`marketing-seo.ts`](../src/lib/marketing-seo.ts).
