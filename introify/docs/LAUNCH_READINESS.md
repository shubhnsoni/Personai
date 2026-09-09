# Introify launch readiness

**9 September 2026 update:** Use [PENDING_ITEMS.md](PENDING_ITEMS.md) for the current consolidated actions and [BILLING_IMPLEMENTATION.md](BILLING_IMPLEMENTATION.md) for implemented behavior. The Free, Starter, Pro, Business and Scale catalog and platform billing are now implemented; provider activation and approved legal/commercial terms remain pending. `/pricing` is indexable, while the other nine supporting routes remain `noindex`. These facts supersede the earlier free-early-access launch assumptions. The detailed legal, privacy, support and messaging requirements below still apply; implementation is not evidence of production activation.

Reviewed: 8 September 2026. Status: **draft business details and policies; payment-gateway and SMS activation remain pending**.

The requested website pages are implemented. Their presence does not complete legal review, gateway onboarding or telecom registration. The operator name, email, address and refund window have deliberately been left blank at the owner's request. No secrets, private account contacts, registration numbers or commercial terms should be inferred from hosting accounts or example environment values.

## 1. Details for the owner to complete

The single source of public business details is `src/lib/marketing-business.ts`. Enter verified public values there. Optional registration fields should stay blank unless they apply and can be verified.

| Field | Owner's value | Where it is needed |
| --- | --- | --- |
| Legal operator name (`operatorName`) | | Terms, privacy, contact, about and gateway KYC consistency |
| Public support email (`supportEmail`) | | Monitored support, refunds and contact |
| Public business address (`businessAddress`) | | Operator identification and onboarding |
| Public support phone (`supportPhone`) | | Contact and gateway review |
| Refund request window (`refundWindow`) | | Own-service refund policy and checkout |
| Refund processing time (`refundProcessingTime`) | | Approved refund handling; distinguish approval from bank processing |
| Grievance officer name/designation (`grievanceOfficer`) | | Privacy, consumer and content complaints, as applicable |
| Grievance contact email (`grievanceEmail`) | | Verified complaint and escalation channel |
| Governing law / jurisdiction (`jurisdiction`) | | Legal review of final terms; preserve mandatory consumer rights |
| Registration number, if applicable (`registrationNumber`) | | Verified legal identity; no invented company status |
| GST number, if applicable (`gstNumber`) | | Tax and invoice disclosures |
| Approved SMS sender header (`smsSenderId`) | | Messaging only after provider/DLT approval |
| Business form and registration/KYC documents | | Gateway/provider onboarding; keep private documents out of source control |
| Actual products/plans, prices, currency and tax treatment | | Approved offer and checkout; do not invent a price or free trial |
| Billing period, renewal and cancellation rules, if applicable | | Paid-service terms and implementation |
| Refund eligibility, exceptions and request procedure | | Owner and legal review; a window alone is insufficient |
| Digital delivery/access terms and merchant shipping requirements | | Actual fulfilment method, time estimates and customer support |
| Retention schedule and deletion owner | | Account, analytics, chats, orders, uploads, logs and backups |
| Messaging provider, purposes, frequency and withdrawal method | | Functional SMS launch plan |

Keep `policiesApproved: false` until the facts, processes and text have been reviewed. Flipping this value does **not** implement a refund process, consent controls, a mailbox or a messaging service. Policy text containing draft/pending statements must also be revised after completion. The nine supporting routes other than `/pricing` intentionally set `index: false`; update their metadata and the shared `MARKETING_ROUTES` registry only after approval. Noindex is a search preference, not access control.

## 2. Public pages delivered

| Route | Purpose | Remaining approval |
| --- | --- | --- |
| `/pricing` | Implemented Free, Starter, Pro, Business and Scale plans, separate from merchant prices | Approved commercial/tax/refund terms and gateway activation |
| `/about` | Product scope and operator identification | Verified operator details |
| `/contact` | Platform, merchant and grievance contact routes | Real monitored email/phone/address; no inert form |
| `/privacy` | Actual data categories, purposes, sharing and choices | Operator, provider inventory, retention and working request channel |
| `/terms` | Account, content, merchant and platform responsibilities | Legal operator, commercial terms and dispute provisions |
| `/refund-policy` | Cancellation/refund scope and purchase responsibilities | Eligibility, window, process and response/processing periods |
| `/delivery-policy` | Online access, bookings and merchant fulfilment | Real offer-specific timelines and delivery recovery |
| `/cookie-policy` | Current cookies/local storage and their limits | Consent decision/control, inventory and retention verification |
| `/acceptable-use` | Prohibited activity and business responsibilities | Monitored reports, moderation and review process |
| `/sms-policy` | Pending messaging safeguards and activation | Provider, registration, templates, permissions and tested withdrawal |

Content is in `src/lib/marketing-policies.ts`; shared presentation is in `src/components/marketing/policy-page.tsx`. Draft warnings and blank business fields are deliberate. These pages do not claim company incorporation, licensing, GST registration, guaranteed gateway approval or an active SMS programme.

The separate `/pricing` page uses the implemented five-plan catalog. Free includes a once-only verified-user photoreal trial, not a timed trial of a paid subscription. Prices set by independent merchants on their pages remain separate from the cost of using Introify; a merchant's goods or services are not made free by the platform's Free plan. Final paid terms and provider activation remain pending.

## 3. Payment-gateway activation

- [ ] Choose the actual business model, including whether payments are for Introify's own software, directly for independent merchants, or involve any marketplace collection/split settlement. Obtain provider approval for that exact model; ordinary merchant activation is not automatically permission to collect on behalf of others.
- [ ] Complete public operator/contact fields and provide verified KYC/bank/business documentation privately in the gateway's portal. Match the website, legal identity, business category and settlement beneficiary.
- [ ] Publish accurate product/service descriptions, actual pricing, currency, taxes, fulfilment and approved cancellation/refund terms. Show the applicable terms before payment and preserve the accepted version with the transaction.
- [ ] Have the operator/legal adviser confirm applicable consumer, tax, marketplace, intermediary and regulated-business obligations. Do not offer pharmacy, health or other regulated workflows solely because a kit exists in source.
- [ ] Validate the selected gateway integration and server-side payment verification in the actual provider account. Introify's platform Stripe adapter is implemented; a different gateway needs its own implementation. Test successful, failed, abandoned, duplicate and refunded transactions; signed webhooks; idempotency; amounts/currency; receipts; fulfilment and support recovery in the provider's authorised test environment.
- [ ] Check approved refunds can actually be issued and reconciled, including partial refunds or renewals if offered. Do not publish a return window as a substitute for a working process.
- [ ] Recheck the public website and live gateway status after deployment. These draft pages do not justify changing payment feature flags by themselves.

Razorpay's official website review documentation lists pricing, contact, privacy, terms, shipping, and cancellation/refund pages as part of website verification for live payments. Business eligibility and account verification are separate requirements. [Razorpay business website details](https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/)

Cashfree's activation FAQ requires a live public site and contact details including a valid email and phone, plus privacy and refund policies. Its security documentation also identifies terms and cancellation/refund disclosures for website review. Its merchant terms require business/KYC review and clear offers and fulfilment responsibilities. The deliberately blank contact fields therefore remain an onboarding blocker. [Cashfree activation FAQs](https://www.cashfree.com/docs/payments/general-faqs), [Cashfree website security and whitelisting](https://www.cashfree.com/docs/security), [Cashfree merchant terms](https://www.cashfree.com/tnc)

No Razorpay or Cashfree integration is introduced by this website change. Existing source includes optional Stripe functionality and direct merchant UPI/payment-link flows. A UPI QR or recorded manual order is not evidence that a gateway, escrow or automated payout service is active.

## 4. Privacy and data handling

The following are observations from application source, not a promise that every integration is enabled in production. Verify the final deployment with test identities before approving the privacy notice.

| Source area | Observed handling | Required action |
| --- | --- | --- |
| `prisma/schema.prisma` | Accounts, profiles, leads, chats, bookings, orders, member access and analytics | Map controller/processor responsibilities, permissions, purpose and retention per workflow |
| `src/components/profile/tracker.tsx` | `pl_vid` cookie 180 days and local-storage ID without expiry; `pl_ref` cookie 30 days | Decide analytics notice/consent requirements; implement control and prevent recreation after withdrawal where required |
| `src/components/profile/session-probe.tsx`, `src/app/api/events/session/route.ts` | Session/page timing, referral/UTM/device/country context; 15-second heartbeats | Review minimisation, retention, event access and consent gating; no separate preference gate currently exists |
| `src/components/checkout/checkout-sheet.tsx` | Buyer name/email in local storage without expiry; addresses in orders; prescription image/Rx note/doctor name in specialised forms | Clear or expire convenience data appropriately; review or disable sensitive collection until secure access and lawful handling are ready |
| `src/lib/uploads-storage.ts`, `src/app/api/uploads/[...path]/route.ts` | Media served through public upload URLs | Do not use this as private medical/document storage; add authorisation/private storage where needed and review existing uploaded content |
| `src/lib/members.ts` | Member cookie/session 30 days; single-use library link 7 days; digital download token 90 days | Verify recovery and expiry behaviours; token expiry is not a server-record retention policy |
| `src/lib/env.ts`, AI handlers | Optional sign-in, email, payment, AI and media providers | Document providers actually enabled, processing locations, agreements, training/retention terms and transfers; avoid unverified privacy claims |
| `src/lib/email.ts` | Without configured email credentials, messages can be logged and success returned without delivery | Configure and verify sender/domain, real delivery and failure handling before promising emailed access or notices; review logged personal information |

- [ ] Identify the legal operator and publish a monitored privacy/grievance contact. Implement identity checks, request tracking, escalation and the applicable response deadlines.
- [ ] Decide the lawful purpose and required notice/permission for each collection point. Implement access, correction, deletion and withdrawal workflows to match the approved notice; do not describe unavailable self-service controls as active.
- [ ] Approve and implement retention/deletion for database rows, files, analytics, backups and logs, including exceptions for legitimate accounting/security/legal needs. Do not rely on cookie or token expiry to remove server information.
- [ ] Review children's use, guardian permissions where relevant, health information and other sensitive fields. Gate affected flows until collection, access restrictions and required permissions are in place.
- [ ] Review authentication, role access, public uploads, processor contracts, breach response and backup recovery. Verify deployment behaviour; do not claim India-only processing, end-to-end encryption, certification or no provider training without evidence.
- [ ] Record the exact service-provider inventory and privacy terms for enabled integrations. AI requests may include supplied documents and conversation context; disclose this before sending data.

As of this review, India's DPDP regime has phased commencement. The official Act notification brings groups of provisions into force immediately, after one year, and after eighteen months from Gazette publication in November 2025; core processing/consent duties and individual-rights provisions are in the eighteen-month group. The final Rules similarly phase commencement. Do not describe the whole framework as already operative or the site as fully compliant. Prepare a readable purpose/data notice, withdrawal and rights processes, security/incident procedures and any relevant guardian controls, then confirm the applicable commencement and final text before launch. [MeitY Act commencement notification, G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [MeitY final DPDP Rules 2025, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)

The transition is not a reason to defer current privacy obligations. Assess the existing IT Act/SPDI framework, particularly for health records: the 2011 rules address public privacy disclosures, necessary collection, consent, correction/withdrawal, security, sharing and grievance handling. Applicability must be checked for the operator and actual processing. [2011 SPDI Rules, Gazette text hosted by WIPO Lex](https://www.wipo.int/wipolex/en/legislation/details/15063)

Assess the Consumer Protection (E-Commerce) Rules for Introify's actual role and merchants. Where applicable, they require business/contact and grievance disclosures; the consumer complaint process includes acknowledgement within 48 hours and redress within one month. Do not use an unstaffed mailbox or invented support promise. [Department of Consumer Affairs, 2026 parliamentary response](https://fcainfoweb.nic.in/PMS/writereaddata/2026_LS_B_361.pdf), [official consumer legislation and amendments index](https://consumeraffairs.gov.in/index.php/pages/consumer-protection-acts)

## 5. Email, SMS and WhatsApp activation

`src/lib/appointments/providers.ts` currently contains reminder providers that do not send messages. A configured environment variable or a published SMS policy does not implement them. Existing WhatsApp buttons open `wa.me` with selected order/booking details; they are not automated SMS or WhatsApp delivery.

- [ ] Select a provider and confirm the exact sending business/principal entity, business documents and permitted use cases. Keep credentials server-side and out of documentation.
- [ ] Complete DLT principal-entity and header registration, content templates, consent templates/records where required, and the registered telemarketer/provider chain. Supply the approved IDs in actual sends.
- [ ] Classify each message with the provider under current telecom rules: OTP/transactional/service/promotional treatment and recipient preference/consent requirements differ. Do not assume submitting a booking form permits marketing.
- [ ] Register and validate template variables, whitelisted URLs and callback numbers. Do not send arbitrary AI-generated marketing text through a fixed approved template.
- [ ] Add purpose-specific notices and a separate voluntary marketing choice. Persist evidence such as recipient, purpose, template/notice version, timestamp, source and withdrawal state; protect these records with a defined retention policy.
- [ ] Implement and test withdrawal and suppression across all send paths. Choose a real preference link/support method appropriate to the channel. Do not claim “reply STOP” works unless the selected sender can receive it and the handler is tested.
- [ ] Implement the actual send adapter, queue/retry limits, duplicate prevention, failure handling and authenticated delivery callbacks. Test recipient preferences, missing consent, withdrawals, template rejection and incorrect phone numbers before enabling outbound traffic.
- [ ] Verify email sender/domain and delivery independently. Approve WhatsApp business/provider templates and opt-in requirements separately if automated WhatsApp is added.
- [ ] Update `/sms-policy` to identify the real sender, purposes, frequency and working withdrawal method only after these processes are operational. Review the final public text with the selected provider.

TRAI's sender guidance lists principal entity, header and content-template registration, transmission of the relevant IDs, and consent requirements as applicable to the communication. Message classification and the access provider's current code of practice need validation with the chosen provider. [TRAI advice to senders](https://trai.gov.in/advice-to-senders)

TRAI's direction dated 18 November 2025 requires descriptive tagging and validation of SMS template variables; it also addresses permitted URLs, OTT/APK links and callback details. These are template/delivery controls, not something a policy page can satisfy. Confirm the provider's enforcement and approved templates before testing delivery. [TRAI direction of 18 November 2025](https://www.trai.gov.in/sites/default/files/2025-11/Directions_18112025_0.PDF)

## 6. Final acceptance before removing draft status

- [ ] Owner supplies the intentionally blank fields and approves the actual commercial decisions.
- [ ] Relevant legal/provider review is complete for the operator, geography, business categories and data handled. Confirm current rules again at activation.
- [ ] Product flows match the final notices and promises: real support, refunds, delivery recovery, privacy choices and messaging permissions work.
- [ ] Verify each policy route, footer link, canonical and draft/noindex state on desktop and mobile; confirm reserved routes cannot be registered as profile slugs.
- [ ] Review all draft/pending wording in `marketing-policies.ts`, set `policiesApproved` only when warranted, and update route/registry indexing deliberately.
- [ ] Recheck a live deployment with safe test identities and the provider's approved test facilities. Record the reviewer, deployment revision and date below; no real messages or charges are authorised by this checklist.

| Acceptance record | Value |
| --- | --- |
| Operator reviewer | |
| Legal/provider reviewer, where applicable | |
| Approved policy date/version | |
| Verified deployment revision | |
| Payment activation sign-off | |
| Messaging activation sign-off | |
