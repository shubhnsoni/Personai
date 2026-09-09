# Pending launch items

The owner asked that unknown operator/contact details stay blank. They remain blank in `src/lib/marketing-business.ts`; `policiesApproved` remains false. The code must not invent these details or advertise checkout as ready while they are missing.

## Information to supply

- Legal operator name and business mailing address.
- Public support email and phone, grievance/privacy contact, and jurisdiction.
- Refund window and processing time, cancellation terms and approved policy text.
- Registration/tax details only where applicable to the actual operator and gateway.
- SMS sender registration, provider, approved templates and consent policy before SMS activation. SMS delivery is not included as a working paid-plan feature.

## Provider activation

- Confirm an eligible production payment-provider account for the operator. Current platform adapter is Stripe; a different gateway needs its own verified subscription and webhook adapter.
- Add matching Stripe live secret/publishable keys and the separate `INTROIFY_STRIPE_WEBHOOK_SECRET` in hosting. Configure terms, billing address/tax treatment and webhook events listed in `.env.example`.
- Exercise a real sandbox checkout, payment authentication/failure, annual renewal, plan change, cancellation, refund, dispute and duplicate/out-of-order delivery before enabling live charges. Automated provider fixtures do not replace this provider-account check.
- Choose and fund the published AI API provider; set explicit approved Fast/Smart/Reasoning mappings. Add current input/output cost settings if cost reporting is required. Missing costs are recorded as unknown, never zero.
- Configure the photoreal provider, verify the pinned standard recipe and its current cost, and fund the provider balance. Set realistic daily free-trial and total generation caps.
- Configure durable upload storage and confirm that the Node worker runs and recovers across a hosting restart. Set `INTROIFY_WORKER_ENABLED=true` only after this check.
- After policy approval and provider checks, enable `INTROIFY_BILLING_ENABLED`, live mode and generation readiness flags. The application can be deployed with these disabled.

## Release operations

- Apply the additive billing migration through the normal release process after verifying database recovery/backups. It retains existing profiles, collaborators and resources.
- Check `/admin/billing` for pending events, held generations and reversed-payment accounts. Reconcile uncertain supplier/payment outcomes from provider records; do not resend an unknown generation.
- Decide the operational refund and account-restoration workflow. Refund/dispute holds require an operator review; automated negative balances and silent reactivation are intentionally absent.
- Decide whether future downgrades should archive excess businesses/seats. This release preserves existing access/data and blocks further quota growth; it does not silently delete customer businesses or staff.
- Custom domains, automation, consolidated group reporting and API access remain planned. They need separate implementations before being sold as live capabilities.

## Validation record

An exact pre-billing schema was migrated in a disposable PostgreSQL 17 database. Concurrency, pooled limits, one-time Free trial, anniversary grants, paused packs and release behavior were tested there. Provider signatures, catalog validation and application flows also have automated tests. Final build/regression results are recorded with the implementation delivery; no live charges or real provider generations are used for validation.
